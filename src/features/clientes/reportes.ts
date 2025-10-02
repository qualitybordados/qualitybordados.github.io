import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  DocumentReference,
  FirestoreError,
} from 'firebase/firestore'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import dayjs from 'dayjs'
import { db } from '@/config/firebase'
import { Cliente, Pedido, PedidoItem, Abono, MetodoPago } from '@/lib/types'
import { fetchPedidos, fetchPedidoItems } from '@/features/pedidos/api'
import { formatCurrency } from '@/lib/format'
import { getDocumentId } from '@/lib/firestore'

const abonosRef = collection(db, 'abonos')

const metodoLabels: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
}

export type ClienteReporteRango = {
  desde: Date
  hasta: Date
}

type PedidoConItems = Pedido & { items: PedidoItem[] }

type AbonoConPedido = Omit<Abono, 'fecha'> & {
  id: string
  fecha: Date
  pedidoId: string
  pedidoFolio: string
}

type CarteraBucket = {
  label: string
  monto: number
  pedidos: number
}

export type ClienteReporteDatos = {
  rango: ClienteReporteRango & { label: string }
  pedidosPeriodo: PedidoConItems[]
  pedidosConSaldo: Pedido[]
  abonosPeriodo: AbonoConPedido[]
  totales: {
    ventas: number
    anticipos: number
    abonos: number
    ingresos: number
    variacionCartera: number
    saldoActual: number
  }
  abonosPorMetodo: Array<{ metodo: MetodoPago; monto: number }>
  pedidosTotales: {
    total: number
    saldo: number
  }
  abonosTotales: number
  carteraBuckets: CarteraBucket[]
  foliosPeriodo: string[]
  tieneMovimientos: boolean
}

async function fetchAbonosCliente(clienteId: string) {
  const clienteRef = doc(db, 'clientes', clienteId)
  const possibleValues: Array<DocumentReference | string> = [clienteRef, clienteId, clienteRef.path]

  const mapAbonoDoc = (docSnap: QueryDocumentSnapshot<DocumentData>): Abono => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      pedido_id: data.pedido_id as DocumentReference,
      cliente_id: data.cliente_id as DocumentReference,
      fecha: data.fecha,
      monto: data.monto,
      metodo: data.metodo,
      ref: data.ref ?? '',
      notas: data.notas ?? '',
      registrado_por: data.registrado_por,
      creado_en: data.creado_en,
      ...(data.movimiento_caja_id ? { movimiento_caja_id: data.movimiento_caja_id as DocumentReference } : {}),
    } satisfies Abono
  }

  const abonosMap = new Map<string, Abono>()

  const isMissingIndexError = (error: unknown): error is FirestoreError =>
    typeof error === 'object' &&
    error !== null &&
    'code' in (error as Record<string, unknown>) &&
    (error as FirestoreError).code === 'failed-precondition'

  const isInvalidValueError = (error: unknown): error is FirestoreError =>
    typeof error === 'object' &&
    error !== null &&
    'code' in (error as Record<string, unknown>) &&
    (error as FirestoreError).code === 'invalid-argument'

  async function fetchByClienteId(value: DocumentReference | string) {
    const results: QueryDocumentSnapshot<DocumentData>[] = []
    try {
      const snapshot = await getDocs(query(abonosRef, where('cliente_id', '==', value), orderBy('fecha', 'desc')))
      results.push(...snapshot.docs)
    } catch (error) {
      if (isMissingIndexError(error)) {
        const snapshot = await getDocs(query(abonosRef, where('cliente_id', '==', value)))
        results.push(...snapshot.docs)
      } else if (isInvalidValueError(error)) {
        return results
      } else {
        throw error
      }
    }
    return results
  }

  const snapshots = await Promise.all(possibleValues.map((value) => fetchByClienteId(value)))
  snapshots.flat().forEach((docSnap) => {
    const abono = mapAbonoDoc(docSnap)
    abonosMap.set(abono.id, abono)
  })

  return Array.from(abonosMap.values()).sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis())
}

export async function fetchClienteReporteDatos({
  cliente,
  rango,
}: {
  cliente: Cliente
  rango: ClienteReporteRango
}): Promise<ClienteReporteDatos> {
  const desde = dayjs(rango.desde).startOf('day')
  const hasta = dayjs(rango.hasta).endOf('day')
  const desdeMs = desde.valueOf()
  const hastaMs = hasta.valueOf()
  const pedidosCliente = await fetchPedidos({ clienteId: cliente.id })
  const pedidosPeriodo = pedidosCliente.filter((pedido) => {
    const fechaPedidoMs = dayjs(pedido.fecha_pedido.toDate()).valueOf()
    const fechaCompromisoMs = dayjs(pedido.fecha_compromiso.toDate()).valueOf()
    const dentroDeRangoPorPedido = fechaPedidoMs >= desdeMs && fechaPedidoMs <= hastaMs
    const dentroDeRangoPorCompromiso = fechaCompromisoMs >= desdeMs && fechaCompromisoMs <= hastaMs
    return dentroDeRangoPorPedido || dentroDeRangoPorCompromiso
  })

  const pedidosConItems: PedidoConItems[] = await Promise.all(
    pedidosPeriodo.map(async (pedido) => ({
      ...pedido,
      items: await fetchPedidoItems(pedido.id),
    })),
  )

  const pedidosConSaldo = pedidosCliente.filter((pedido) => pedido.saldo > 0)

  const abonosCliente = await fetchAbonosCliente(cliente.id)
  const abonosPeriodo: AbonoConPedido[] = abonosCliente
    .filter((abono) => {
      const fechaMs = dayjs(abono.fecha.toDate()).valueOf()
      return fechaMs >= desdeMs && fechaMs <= hastaMs
    })
    .map((abono) => {
      const pedidoId = getDocumentId(abono.pedido_id)
      const pedidoRelacionado = pedidosCliente.find((pedido) => pedido.id === pedidoId)
      return {
        ...abono,
        fecha: abono.fecha.toDate(),
        pedidoId,
        pedidoFolio: pedidoRelacionado?.folio ?? 'N/A',
      }
    })

  const ventas = pedidosPeriodo.reduce((sum, pedido) => sum + pedido.total, 0)
  const anticipos = pedidosPeriodo.reduce((sum, pedido) => sum + pedido.anticipo, 0)
  const abonos = abonosPeriodo.reduce((sum, abono) => sum + abono.monto, 0)
  const ingresos = abonos + anticipos
  const saldoActual = pedidosConSaldo.reduce((sum, pedido) => sum + pedido.saldo, 0)
  const variacionCartera = ventas - ingresos

  const pedidosTotales = {
    total: pedidosPeriodo.reduce((sum, pedido) => sum + pedido.total, 0),
    saldo: pedidosPeriodo.reduce((sum, pedido) => sum + pedido.saldo, 0),
  }
  const abonosTotales = abonos

  const abonosPorMetodo = Object.entries(
    abonosPeriodo.reduce<Record<MetodoPago, number>>((acc, abono) => {
      acc[abono.metodo] = (acc[abono.metodo] ?? 0) + abono.monto
      return acc
    }, {} as Record<MetodoPago, number>),
  )
    .map(([metodo, monto]) => ({ metodo: metodo as MetodoPago, monto }))
    .sort((a, b) => b.monto - a.monto)

  const bucketsConfig: Array<{ label: string; max?: number; min: number }> = [
    { label: '0-30 días', min: 0, max: 30 },
    { label: '31-60 días', min: 31, max: 60 },
    { label: '61-90 días', min: 61, max: 90 },
    { label: '90+ días', min: 91 },
  ]

  const carteraBuckets: CarteraBucket[] = bucketsConfig.map((bucket) => ({ label: bucket.label, monto: 0, pedidos: 0 }))
  const cierre = hasta
  pedidosConSaldo.forEach((pedido) => {
    const compromiso = dayjs(pedido.fecha_compromiso.toDate()).startOf('day')
    const diff = Math.max(0, cierre.diff(compromiso, 'day'))
    const bucketIndex = bucketsConfig.findIndex((bucket) => {
      if (bucket.max === undefined) {
        return diff >= bucket.min
      }
      return diff >= bucket.min && diff <= bucket.max
    })
    const index = bucketIndex === -1 ? 0 : bucketIndex
    carteraBuckets[index].monto += pedido.saldo
    carteraBuckets[index].pedidos += 1
  })

  const foliosPeriodo = pedidosPeriodo.map((pedido) => pedido.folio).filter(Boolean)

  return {
    rango: {
      ...rango,
      label: `${desde.format('DD/MM/YYYY')} – ${hasta.format('DD/MM/YYYY')}`,
    },
    pedidosPeriodo: pedidosConItems,
    pedidosConSaldo,
    abonosPeriodo,
    totales: {
      ventas,
      anticipos,
      abonos,
      ingresos,
      variacionCartera,
      saldoActual,
    },
    abonosPorMetodo,
    pedidosTotales,
    abonosTotales,
    carteraBuckets,
    foliosPeriodo,
    tieneMovimientos: pedidosPeriodo.length > 0 || abonosPeriodo.length > 0,
  }
}

function drawText(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  x: number,
  y: number,
  options: { font: any; size?: number; color?: [number, number, number] },
) {
  const { font, size = 11, color = [0.13, 0.14, 0.17] } = options
  page.drawText(text, { x, y, size, font, color: rgb(color[0], color[1], color[2]) })
}

function ensureSpace(
  pdfDoc: PDFDocument,
  context: {
    cursorY: number
    page: ReturnType<PDFDocument['addPage']>
    margin: number
    pageWidth: number
    pageHeight: number
    font: any
    boldFont: any
  },
  height: number,
) {
  if (context.cursorY - height < context.margin) {
    context.page = pdfDoc.addPage([context.pageWidth, context.pageHeight])
    context.cursorY = context.pageHeight - context.margin
  }

  return context.page
}

export async function generateClienteReportePdf({
  cliente,
  rango,
  usuarioEmail,
}: {
  cliente: Cliente
  rango: ClienteReporteRango
  usuarioEmail: string
}) {
  const datos = await fetchClienteReporteDatos({ cliente, rango })
  const pdfDoc = await PDFDocument.create()
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 36
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let cursorY = pageHeight - margin
  const generadoEn = new Date()

  const context = { cursorY, page, margin, pageWidth, pageHeight, font, boldFont }

  function updateCursor(amount: number) {
    cursorY -= amount
    context.cursorY = cursorY
  }

  function drawSectionTitle(text: string) {
    page = ensureSpace(pdfDoc, context, 32)
    drawText(page, text, margin, cursorY, { font: boldFont, size: 14 })
    updateCursor(24)
  }

  function drawParagraph(text: string, size = 10, color: [number, number, number] = [0.35, 0.38, 0.45]) {
    const lines = wrapText({ text, font, size, maxWidth: pageWidth - margin * 2 })
    const height = lines.length * (size + 2)
    page = ensureSpace(pdfDoc, context, height + 6)
    lines.forEach((line, index) => {
      drawText(page, line, margin, cursorY - index * (size + 2), { font, size, color })
    })
    updateCursor(height + 8)
  }

  function drawKpiCards(items: Array<{ label: string; value: string; highlight?: boolean; subtext?: string }>) {
    const gutter = 12
    const boxWidth = (pageWidth - margin * 2 - gutter * (items.length - 1)) / items.length
    const boxHeight = items.some((item) => item.subtext) ? 78 : 64
    page = ensureSpace(pdfDoc, context, boxHeight + 8)
    items.forEach((item, index) => {
      const boxX = margin + index * (boxWidth + gutter)
      const boxY = cursorY - boxHeight
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0.96, 0.98, 1),
        borderWidth: 0,
        opacity: 0.95,
      })
      drawText(page, item.label, boxX + 12, boxY + boxHeight - 18, {
        font,
        size: 9,
        color: [0.35, 0.38, 0.45],
      })
      drawText(page, item.value, boxX + 12, boxY + boxHeight - 36, {
        font: boldFont,
        size: 15,
        color: item.highlight ? [0.0, 0.5, 0.3] : [0.13, 0.14, 0.17],
      })
      if (item.subtext) {
        const subLines = wrapText({ text: item.subtext, font, size: 8, maxWidth: boxWidth - 24 })
        subLines.forEach((line, lineIndex) => {
          drawText(page, line, boxX + 12, boxY + boxHeight - 52 - lineIndex * 10, {
            font,
            size: 8,
            color: [0.45, 0.48, 0.55],
          })
        })
      }
    })
    updateCursor(boxHeight + 14)
  }

  function drawTableHeader(headers: string[], columnWidths: number[]) {
    page = ensureSpace(pdfDoc, context, 20)
    let x = margin
    headers.forEach((header, index) => {
      drawText(page, header, x, cursorY, { font: boldFont, size: 9, color: [0.35, 0.38, 0.45] })
      x += columnWidths[index]
    })
    updateCursor(16)
  }

  function drawTableRow(values: string[], columnWidths: number[], options: { bold?: boolean } = {}) {
    const cells = values.map((value, index) => {
      const cellFont = options.bold ? boldFont : font
      const lines = wrapText({ text: value, font: cellFont, size: 9, maxWidth: columnWidths[index] - 6 })
      return {
        lines,
        width: columnWidths[index],
        font: cellFont,
        height: Math.max(16, lines.length * 12),
      }
    })

    const rowHeight = Math.max(...cells.map((cell) => cell.height))
    page = ensureSpace(pdfDoc, context, rowHeight + 4)

    let x = margin
    cells.forEach((cell) => {
      cell.lines.forEach((line, lineIndex) => {
        drawText(page, line, x, cursorY - lineIndex * 12, {
          font: cell.font,
          size: 9,
          color: [0.13, 0.14, 0.17],
        })
      })
      x += cell.width
    })

    updateCursor(rowHeight + 4)
  }

  function drawBulletList(items: string[]) {
    if (!items.length) return
    const height = items.length * 12 + 4
    page = ensureSpace(pdfDoc, context, height)
    items.forEach((item) => {
      drawText(page, `• ${item}`, margin + 8, cursorY, { font, size: 8, color: [0.4, 0.43, 0.5] })
      updateCursor(12)
    })
    updateCursor(4)
  }

  // Encabezado
  drawText(page, 'Quality Bordados', margin, cursorY, { font: boldFont, size: 18, color: [0.03, 0.2, 0.45] })
  updateCursor(24)
  drawText(page, `Reporte Financiero por Cliente — ${cliente.alias}`, margin, cursorY, { font: boldFont, size: 14 })
  updateCursor(18)
  drawText(page, datos.rango.label, margin, cursorY, { font, size: 11, color: [0.35, 0.38, 0.45] })
  updateCursor(18)

  drawParagraph(
    `Generado el ${dayjs(generadoEn).format('DD/MM/YYYY HH:mm')} por ${usuarioEmail}. Límite de crédito: ${formatCurrency(
      cliente.limite_credito,
    )}. Días de crédito: ${cliente.dias_credito}.`,
  )

  // Sección A — Resumen Ejecutivo
  drawSectionTitle('Sección A — Resumen Ejecutivo')
  const metodoBreakdown = datos.abonosPorMetodo
    .map((item) => `${metodoLabels[item.metodo]}: ${formatCurrency(item.monto)}`)
    .join(' · ')
  drawKpiCards([
    { label: 'Ventas del período', value: formatCurrency(datos.totales.ventas) },
    {
      label: 'Abonos del período',
      value: formatCurrency(datos.totales.abonos),
      subtext: metodoBreakdown || 'Sin abonos registrados',
    },
    {
      label: 'Saldo actual del cliente',
      value: formatCurrency(datos.totales.saldoActual),
      highlight: true,
    },
    {
      label: 'Variación de cartera',
      value: formatCurrency(datos.totales.variacionCartera),
    },
  ])

  drawParagraph(
    `Ingresos cobrados en el período: ${formatCurrency(datos.totales.ingresos)}. Este cálculo considera abonos y anticipos aplicados a los pedidos del rango seleccionado.`,
  )

  // Sección B — Pedidos del período
  drawSectionTitle('Sección B — Pedidos del período')
  if (!datos.pedidosPeriodo.length) {
    drawParagraph('Sin pedidos registrados en el rango seleccionado.')
  } else {
    const columnWidths = [70, 80, 80, 90, 90, 90]
    drawTableHeader(['Folio', 'F. Pedido', 'F. Compromiso', 'Estatus', 'Total', 'Saldo'], columnWidths)
    datos.pedidosPeriodo.forEach((pedido) => {
      page = ensureSpace(pdfDoc, context, 24)
      drawTableRow(
        [
          pedido.folio,
          dayjs(pedido.fecha_pedido.toDate()).format('DD/MM/YYYY'),
          dayjs(pedido.fecha_compromiso.toDate()).format('DD/MM/YYYY'),
          pedido.status,
          formatCurrency(pedido.total),
          formatCurrency(pedido.saldo),
        ],
        columnWidths,
      )
      const conceptos = pedido.items.map(
        (item) => `${item.descripcion_item} x${item.cantidad} — ${formatCurrency(item.importe)}`,
      )
      drawBulletList(conceptos)
    })

    drawTableRow(
      ['Totales', '', '', '', formatCurrency(datos.pedidosTotales.total), formatCurrency(datos.pedidosTotales.saldo)],
      columnWidths,
      { bold: true },
    )
  }

  // Sección C — Abonos del período
  drawSectionTitle('Sección C — Abonos del período')
  if (!datos.abonosPeriodo.length) {
    drawParagraph('Sin abonos registrados en el rango seleccionado.')
  } else {
    const columnWidths = [80, 90, 90, 80, 120]
    drawTableHeader(['Fecha', 'Pedido', 'Método', 'Monto', 'Referencia'], columnWidths)
    datos.abonosPeriodo.forEach((abono) => {
      drawTableRow(
        [
          dayjs(abono.fecha).format('DD/MM/YYYY'),
          abono.pedidoFolio,
          metodoLabels[abono.metodo],
          formatCurrency(abono.monto),
          abono.ref || '—',
        ],
        columnWidths,
      )
    })
    drawTableRow(['Total', '', '', formatCurrency(datos.abonosTotales), ''], columnWidths, { bold: true })
  }

  // Sección D — Cartera al cierre
  drawSectionTitle('Sección D — Cartera al cierre')
  drawParagraph(
    `Saldo total del cliente al ${datos.rango.label.split('–')[1]?.trim() ?? datos.rango.label}: ${formatCurrency(
      datos.totales.saldoActual,
    )}.`,
  )
  const bucketColumnWidths = [120, 120, 120]
  drawTableHeader(['Antigüedad', 'Monto', '# Pedidos'], bucketColumnWidths)
  datos.carteraBuckets.forEach((bucket) => {
    drawTableRow(
      [bucket.label, formatCurrency(bucket.monto), bucket.pedidos.toString()],
      bucketColumnWidths,
    )
  })

  page = ensureSpace(pdfDoc, context, 40)
  drawText(page, `Documento generado por Quality Bordados — ${dayjs(generadoEn).format('DD/MM/YYYY HH:mm')}`, margin, cursorY, {
    font,
    size: 9,
    color: [0.35, 0.38, 0.45],
  })
  updateCursor(14)
  drawText(page, 'Reporte emitido automáticamente desde la plataforma CRM.', margin, cursorY, {
    font,
    size: 8,
    color: [0.45, 0.48, 0.55],
  })

  const pdfBytes = await pdfDoc.save()
  const filename = `Reporte-${cliente.alias.replace(/\s+/g, '-')}-${dayjs(rango.desde).format('YYYYMMDD')}-${dayjs(
    rango.hasta,
  ).format('YYYYMMDD')}.pdf`

  return { pdfBytes, filename, datos, generadoEn }
}

export function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string
  font: any
  size: number
  maxWidth: number
}) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    const tentative = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(tentative, size)
    if (width <= maxWidth) {
      currentLine = tentative
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      let fragment = ''
      for (const char of word) {
        const tentativeFragment = fragment + char
        if (font.widthOfTextAtSize(tentativeFragment, size) > maxWidth && fragment) {
          lines.push(fragment)
          fragment = char
        } else {
          fragment = tentativeFragment
        }
      }
      currentLine = fragment
    }
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

export function buildClienteReporteWhatsAppMensaje({
  cliente,
  datos,
  origen,
}: {
  cliente: Cliente
  datos: ClienteReporteDatos
  origen: string
}) {
  const folios = datos.foliosPeriodo.length ? datos.foliosPeriodo.join(', ') : 'Sin pedidos en el período'
  const lines = [
    `Hola ${cliente.alias} 👋`,
    '',
    `Te compartimos tu reporte financiero del ${datos.rango.label}.`,
    '',
    `Ventas emitidas: ${formatCurrency(datos.totales.ventas)}`,
    `Cobrado en el período: ${formatCurrency(datos.totales.ingresos)}`,
    `Saldo pendiente al cierre: ${formatCurrency(datos.totales.saldoActual)}`,
    '',
    `Pedidos del período: ${folios}`,
    '',
    `Consulta más detalles en ${origen}`,
  ]

  return lines.join('\n')
}
