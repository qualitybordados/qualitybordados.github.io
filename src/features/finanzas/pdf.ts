import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import dayjs from 'dayjs'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0)
}

function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string
  font: PDFFont
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
      const wordWidth = font.widthOfTextAtSize(word, size)
      if (wordWidth <= maxWidth) {
        currentLine = word
      } else {
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
    }
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

export type FinanzasPdfPayload = {
  rangoLabel: string
  generadoEl: Date
  usuario: string
  filtros: {
    tipo: string
    categoria: string
  }
  totales: {
    ingresos: number
    egresos: number
    neto: number
  }
  resumenCategorias: Array<{
    categoria: string
    ingresos: number
    egresos: number
    neto: number
  }>
  serieTemporal: {
    agrupacion: 'diaria' | 'semanal'
    datos: Array<{
      label: string
      ingresos: number
      egresos: number
      neto: number
    }>
  }
  topClientes: Array<{
    cliente: string
    monto: number
    porcentaje: number
  }>
  cartera: {
    total: number
    buckets: Array<{
      label: string
      monto: number
      pedidos: number
    }>
  }
  movimientos: Array<{
    fecha: string
    tipo: string
    categoria: string
    monto: number
    referencia: string | null
    notas: string
  }>
}

export async function generateFinanzasPdf(payload: FinanzasPdfPayload) {
  const pdfDoc = await PDFDocument.create()
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 36
  const sectionSpacing = 18

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let cursorY = pageHeight - margin

  function ensureSpace(height: number) {
    if (cursorY - height < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      cursorY = pageHeight - margin
    }
  }

  function drawText(
    text: string,
    options: { x?: number; size?: number; bold?: boolean; color?: [number, number, number] } = {},
  ) {
    const { x = margin, size = 11, bold = false, color = [0.13, 0.14, 0.17] } = options
    page.drawText(text, {
      x,
      y: cursorY,
      size,
      font: bold ? boldFont : font,
      color: rgb(color[0], color[1], color[2]),
    })
  }

  function moveCursor(amount: number) {
    cursorY -= amount
  }

  function drawSectionTitle(text: string) {
    ensureSpace(28)
    drawText(text, { size: 12, bold: true })
    moveCursor(20)
  }

  function drawKpiGrid(items: Array<{ label: string; value: string; highlight?: boolean }>) {
    const gutter = 12
    const boxWidth = (pageWidth - margin * 2 - gutter * (items.length - 1)) / items.length
    const boxHeight = 64
    ensureSpace(boxHeight + 12)

    items.forEach((item, index) => {
      const boxX = margin + index * (boxWidth + gutter)
      const boxY = cursorY - boxHeight
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0.95, 0.97, 0.99),
        borderWidth: 0,
        opacity: 0.95,
      })
      const valueColor = item.highlight ? rgb(0.03, 0.55, 0.36) : rgb(0.13, 0.14, 0.17)
      page.drawText(item.label, {
        x: boxX + 12,
        y: boxY + boxHeight - 18,
        size: 10,
        font,
        color: rgb(0.38, 0.43, 0.5),
      })
      page.drawText(item.value, {
        x: boxX + 12,
        y: boxY + boxHeight - 38,
        size: 16,
        font: boldFont,
        color: valueColor,
      })
    })

    moveCursor(boxHeight + 16)
  }

  function drawTable({
    headers,
    rows,
    columnWidths,
  }: {
    headers: string[]
    rows: string[][]
    columnWidths: number[]
  }) {
    const rowHeight = 20
    const headerHeight = 24
    const tableWidth = columnWidths.reduce((sum, value) => sum + value, 0)

    ensureSpace(headerHeight + rows.length * rowHeight + 10)

    page.drawRectangle({
      x: margin,
      y: cursorY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.93, 0.95, 0.97),
      borderWidth: 0,
    })

    let currentX = margin
    headers.forEach((header, index) => {
      page.drawText(header, {
        x: currentX + 6,
        y: cursorY - 16,
        size: 10,
        font: boldFont,
        color: rgb(0.18, 0.2, 0.24),
      })
      currentX += columnWidths[index]
    })

    moveCursor(headerHeight)

    rows.forEach((row) => {
      ensureSpace(rowHeight + 2)
      let columnX = margin
      row.forEach((cell, index) => {
        const width = columnWidths[index]
        const textLines = wrapText({ text: cell, font, size: 10, maxWidth: width - 8 })
        const baseY = cursorY - 14
        textLines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: columnX + 4,
            y: baseY - lineIndex * 12,
            size: 10,
            font,
            color: rgb(0.23, 0.26, 0.3),
          })
        })
        columnX += width
      })
      const rowMaxHeight = Math.max(...row.map((cell, index) => {
        const width = columnWidths[index]
        const lineCount = wrapText({ text: cell, font, size: 10, maxWidth: width - 8 }).length
        return Math.max(lineCount, 1) * 12 + 6
      }))
      moveCursor(rowMaxHeight)
    })

    moveCursor(10)
  }

  // Encabezado principal
  drawText('Quality Bordados', { size: 14, bold: true })
  moveCursor(18)
  drawText(`Reporte Financiero — ${payload.rangoLabel}`, { size: 16, bold: true })
  moveCursor(20)
  drawText(`Generado: ${dayjs(payload.generadoEl).format('DD/MM/YYYY HH:mm')} · Usuario: ${payload.usuario}`)
  moveCursor(14)
  drawText(`Filtros: Tipo ${payload.filtros.tipo} · Categoría ${payload.filtros.categoria}`)
  moveCursor(sectionSpacing)

  // KPIs
  drawSectionTitle('Sección A — KPIs del período')
  drawKpiGrid([
    { label: 'Ingresos (MXN)', value: formatCurrency(payload.totales.ingresos) },
    { label: 'Egresos (MXN)', value: formatCurrency(payload.totales.egresos) },
    { label: 'Flujo Neto (MXN)', value: formatCurrency(payload.totales.neto), highlight: true },
  ])
  moveCursor(sectionSpacing)

  // Resumen por categoría
  drawSectionTitle('Sección B — Resumen por categoría')
  if (payload.resumenCategorias.length) {
    drawTable({
      headers: ['Categoría', 'Ingresos', 'Egresos', 'Neto'],
      columnWidths: [180, 120, 120, 120],
      rows: payload.resumenCategorias.map((item) => [
        item.categoria,
        formatCurrency(item.ingresos),
        formatCurrency(item.egresos),
        formatCurrency(item.neto),
      ]),
    })
  } else {
    drawText('Sin movimientos en el período.', { color: [0.45, 0.5, 0.55] })
    moveCursor(sectionSpacing)
  }

  moveCursor(sectionSpacing)

  // Serie temporal
  drawSectionTitle('Sección C — Flujo en el tiempo')
  if (payload.serieTemporal.datos.length) {
    drawText(`Agrupación ${payload.serieTemporal.agrupacion}`, { size: 10, color: [0.4, 0.45, 0.5] })
    moveCursor(14)
    drawTable({
      headers: ['Periodo', 'Ingresos', 'Egresos', 'Neto'],
      columnWidths: [200, 120, 120, 120],
      rows: payload.serieTemporal.datos.map((dato) => [
        dato.label,
        formatCurrency(dato.ingresos),
        formatCurrency(dato.egresos),
        formatCurrency(dato.neto),
      ]),
    })
  } else {
    drawText('No se registraron movimientos en el rango seleccionado.', { color: [0.45, 0.5, 0.55] })
    moveCursor(sectionSpacing)
  }

  moveCursor(sectionSpacing)

  // Top clientes
  drawSectionTitle('Sección D — Top clientes del período')
  if (payload.topClientes.length) {
    drawTable({
      headers: ['Cliente', 'Ingresos', 'Participación'],
      columnWidths: [220, 160, 120],
      rows: payload.topClientes.map((cliente) => [
        cliente.cliente,
        formatCurrency(cliente.monto),
        `${cliente.porcentaje.toFixed(1)}%`,
      ]),
    })
  } else {
    drawText('Sin clientes asociados a los ingresos en este período.', { color: [0.45, 0.5, 0.55] })
    moveCursor(sectionSpacing)
  }

  moveCursor(sectionSpacing)

  // Cartera
  drawSectionTitle('Sección E — Cartera al cierre del período')
  drawText(`Saldo total: ${formatCurrency(payload.cartera.total)}`, { bold: true })
  moveCursor(16)
  if (payload.cartera.buckets.length) {
    drawTable({
      headers: ['Antigüedad', 'Monto', '# Pedidos'],
      columnWidths: [220, 180, 120],
      rows: payload.cartera.buckets.map((bucket) => [
        bucket.label,
        formatCurrency(bucket.monto),
        `${bucket.pedidos}`,
      ]),
    })
  } else {
    drawText('No hay pedidos con saldo al cierre del período.', { color: [0.45, 0.5, 0.55] })
    moveCursor(sectionSpacing)
  }

  moveCursor(sectionSpacing)

  // Detalle de movimientos
  drawSectionTitle('Sección F — Detalle de movimientos')
  if (payload.movimientos.length) {
    payload.movimientos.forEach((movimiento) => {
      const referenciaTexto = movimiento.referencia ? `Referencia: ${movimiento.referencia}` : 'Sin referencia'
      const notasTexto = movimiento.notas?.trim() ? `Notas: ${movimiento.notas.trim()}` : 'Notas: —'
      const lines = [
        `${movimiento.fecha} · ${movimiento.tipo} · ${movimiento.categoria} · ${formatCurrency(movimiento.monto)}`,
        referenciaTexto,
        notasTexto,
      ]

      const textHeight = lines.reduce((height, line) => {
        const wrapped = wrapText({ text: line, font, size: 10, maxWidth: pageWidth - margin * 2 })
        return height + wrapped.length * 12 + 4
      }, 0)

      ensureSpace(textHeight + 6)
      lines.forEach((line) => {
        const wrapped = wrapText({ text: line, font, size: 10, maxWidth: pageWidth - margin * 2 })
        wrapped.forEach((fragment) => {
          drawText(fragment)
          moveCursor(12)
        })
      })
      moveCursor(6)
    })
  } else {
    drawText('No hay movimientos registrados en este rango.', { color: [0.45, 0.5, 0.55] })
    moveCursor(sectionSpacing)
  }

  ensureSpace(40)
  drawText(`Documento generado por Quality Bordados — ${dayjs(payload.generadoEl).format('DD/MM/YYYY HH:mm')}`, {
    size: 10,
    color: [0.4, 0.45, 0.5],
  })
  moveCursor(14)
  drawText('Contacto: hola@qualitybordados.mx', { size: 10, color: [0.4, 0.45, 0.5] })

  const pdfBytes = await pdfDoc.save()
  const buffer = pdfBytes.buffer.slice(0, pdfBytes.byteLength) as ArrayBuffer
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const fileName = `reporte-finanzas-${dayjs(payload.generadoEl).format('YYYYMMDD-HHmm')}.pdf`

  return { blob, fileName }
}
