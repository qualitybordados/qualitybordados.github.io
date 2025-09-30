import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import dayjs from 'dayjs'
import { Cliente, Pedido, PedidoItem } from '@/lib/types'

export type PedidoPdfPayload = {
  pedido: Pedido
  cliente: Cliente | null
  items: PedidoItem[]
}

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0)
}

function formatDate(date: Date) {
  return dayjs(date).format('DD/MM/YYYY')
}

function wrapText({
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
      const wordWidth = font.widthOfTextAtSize(word, size)
      if (wordWidth <= maxWidth) {
        currentLine = word
      } else {
        // Force break long words
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

export async function generatePedidoPdf({ pedido, cliente, items }: PedidoPdfPayload) {
  const pdfDoc = await PDFDocument.create()
  const pageMargin = 40
  const pageWidth = 595.28
  const pageHeight = 841.89
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const lineHeight = 14
  const tableHeaderHeight = 24
  const descriptionColumnWidth = 250
  const quantityColumnWidth = 70
  const unitPriceColumnWidth = 110
  const subtotalColumnWidth = 110
  const tableWidth = descriptionColumnWidth + quantityColumnWidth + unitPriceColumnWidth + subtotalColumnWidth
  const tableStartX = pageMargin

  const resumenHeight = 100

  let cursorY = pageHeight - pageMargin

  function ensureSpace(height: number) {
    if (cursorY - height < pageMargin + resumenHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      cursorY = pageHeight - pageMargin
      drawTableHeader()
      cursorY -= tableHeaderHeight
    }
  }

  function drawTextLine(text: string, options: { x?: number; y?: number; fontSize?: number; bold?: boolean }) {
    const { x = pageMargin, y = cursorY, fontSize = 12, bold = false } = options
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font: bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    })
  }

  function drawTableHeader() {
    const headerY = cursorY
    page.drawRectangle({
      x: tableStartX,
      y: headerY - tableHeaderHeight,
      width: tableWidth,
      height: tableHeaderHeight,
      color: rgb(0.93, 0.95, 0.97),
      borderWidth: 0,
    })

    page.drawText('Descripción', {
      x: tableStartX + 10,
      y: headerY - 16,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.17),
    })

    page.drawText('Cantidad', {
      x: tableStartX + descriptionColumnWidth + 10,
      y: headerY - 16,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.17),
    })

    page.drawText('P. Unitario', {
      x: tableStartX + descriptionColumnWidth + quantityColumnWidth + 10,
      y: headerY - 16,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.17),
    })

    page.drawText('SubTotal', {
      x: tableStartX + descriptionColumnWidth + quantityColumnWidth + unitPriceColumnWidth + 10,
      y: headerY - 16,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.17),
    })
  }

  // Header
  drawTextLine('Pedido ' + pedido.folio, { fontSize: 20, bold: true })
  cursorY -= lineHeight * 1.8

  drawTextLine(`Fecha del pedido: ${formatDate(pedido.fecha_pedido.toDate())}`, { fontSize: 11 })
  cursorY -= lineHeight
  drawTextLine(`Fecha compromiso: ${formatDate(pedido.fecha_compromiso.toDate())}`, { fontSize: 11 })
  cursorY -= lineHeight * 1.2

  if (cliente) {
    drawTextLine('Cliente', { fontSize: 12, bold: true })
    cursorY -= lineHeight
    drawTextLine(`Nombre: ${cliente.alias} (${cliente.nombre_legal})`, { fontSize: 11 })
    cursorY -= lineHeight
    if (cliente.telefono) {
      drawTextLine(`Teléfono: ${cliente.telefono}`, { fontSize: 11 })
      cursorY -= lineHeight
    }
    if (cliente.email) {
      drawTextLine(`Email: ${cliente.email}`, { fontSize: 11 })
      cursorY -= lineHeight
    }
    if (cliente.direccion) {
      drawTextLine(`Dirección: ${cliente.direccion}, ${cliente.ciudad}, CP ${cliente.cp}`, { fontSize: 11 })
      cursorY -= lineHeight
    }
  }

  cursorY -= lineHeight * 0.5

  drawTableHeader()
  cursorY -= tableHeaderHeight

  const columnPositions = [
    tableStartX,
    tableStartX + descriptionColumnWidth,
    tableStartX + descriptionColumnWidth + quantityColumnWidth,
    tableStartX + descriptionColumnWidth + quantityColumnWidth + unitPriceColumnWidth,
  ]

  items.forEach((item) => {
    ensureSpace(lineHeight * 2)
    const descriptionLines = wrapText({
      text: item.descripcion_item.trim() || 'Sin descripción',
      font,
      size: 10,
      maxWidth: descriptionColumnWidth - 12,
    })

    const rowHeight = Math.max(descriptionLines.length * (lineHeight - 2), lineHeight)

    page.drawRectangle({
      x: tableStartX,
      y: cursorY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderWidth: 0.3,
      borderColor: rgb(0.85, 0.85, 0.85),
    })

    descriptionLines.slice(0, 5).forEach((line, index) => {
      page.drawText(line, {
        x: tableStartX + 8,
        y: cursorY - 12 - index * (lineHeight - 2),
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
    })

    if (descriptionLines.length > 5) {
      page.drawText('…', {
        x: tableStartX + 8,
        y: cursorY - 12 - 5 * (lineHeight - 2),
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
    }

    page.drawText(String(item.cantidad), {
      x: columnPositions[1] + 10,
      y: cursorY - 12,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(formatCurrency(item.precio_unitario), {
      x: columnPositions[2] + 10,
      y: cursorY - 12,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(formatCurrency(item.importe), {
      x: columnPositions[3] + 10,
      y: cursorY - 12,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })

    cursorY -= rowHeight
  })

  if (!items.length) {
    ensureSpace(lineHeight)
    page.drawRectangle({
      x: tableStartX,
      y: cursorY - lineHeight,
      width: tableWidth,
      height: lineHeight,
      color: rgb(1, 1, 1),
      borderWidth: 0.3,
      borderColor: rgb(0.85, 0.85, 0.85),
    })
    page.drawText('Sin items registrados.', {
      x: tableStartX + 8,
      y: cursorY - 12,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    cursorY -= lineHeight
  }

  cursorY -= lineHeight

  const summaryStartY = cursorY
  const summaryX = tableStartX + descriptionColumnWidth + quantityColumnWidth
  const summaryWidth = unitPriceColumnWidth + subtotalColumnWidth

  page.drawRectangle({
    x: summaryX,
    y: summaryStartY - 130,
    width: summaryWidth,
    height: 130,
    color: rgb(0.98, 0.98, 0.99),
    borderWidth: 0.3,
    borderColor: rgb(0.85, 0.85, 0.85),
  })

  const summaryLines: Array<[string, number]> = [
    ['Subtotal', pedido.subtotal],
    ['Descuento', pedido.descuento],
    ['Impuestos', pedido.impuestos],
    ['Total', pedido.total],
    ['Anticipo', pedido.anticipo],
    ['Saldo', pedido.saldo],
  ]

  let summaryCursorY = summaryStartY - 18
  summaryLines.forEach(([label, value], index) => {
    page.drawText(label + ':', {
      x: summaryX + 12,
      y: summaryCursorY,
      size: 11,
      font: index >= 3 ? boldFont : font,
      color: rgb(0.2, 0.2, 0.2),
    })
    const formatted = formatCurrency(value)
    const textWidth = font.widthOfTextAtSize(formatted, 11)
    page.drawText(formatted, {
      x: summaryX + summaryWidth - textWidth - 12,
      y: summaryCursorY,
      size: 11,
      font: index >= 3 ? boldFont : font,
      color: rgb(0.2, 0.2, 0.2),
    })
    summaryCursorY -= 20
  })

  const notesY = summaryStartY - 150
  page.drawText('Notas', {
    x: tableStartX,
    y: notesY,
    size: 12,
    font: boldFont,
    color: rgb(0.15, 0.15, 0.17),
  })

  const notas = (pedido.notas ?? '').trim() || 'Sin notas adicionales.'
  const notesLines = wrapText({ text: notas, font, size: 11, maxWidth: tableWidth })
  notesLines.forEach((line, index) => {
    page.drawText(line, {
      x: tableStartX,
      y: notesY - 16 - index * 14,
      size: 11,
      font,
      color: rgb(0.25, 0.25, 0.25),
    })
  })

  const footerText = 'Generado el ' + dayjs().format('DD/MM/YYYY HH:mm')
  page.drawText(footerText, {
    x: pageMargin,
    y: pageMargin - 10,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save()
  const pdfBuffer = pdfBytes.buffer.slice(0, pdfBytes.byteLength) as ArrayBuffer
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
  const fileName = `pedido-${pedido.folio.replace(/\s+/g, '-').toLowerCase()}.pdf`

  return {
    blob,
    fileName,
  }
}
