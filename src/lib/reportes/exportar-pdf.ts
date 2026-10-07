// PDF de la pestaña visible de Reportes: encabezado con el negocio, datos del reporte,
// resumen, imagen del gráfico y tabla. jspdf y jspdf-autotable se cargan recién al exportar.

import { momentoEnArgentina } from './fechas'
import { formatear, type Pestana, type Valor } from './pestanas'
import type { ResumenVentas } from './tipos'

export type NegocioReporte = { nombre: string; descripcion: string | null }

type OpcionesPdf = {
  negocio: NegocioReporte
  pestana: Pestana
  filas: Valor[][]
  resumen: ResumenVentas
  // Textos del encabezado, ej. "Del 01/09/2026 al 28/09/2026" y "Avellaneda".
  periodo: string
  sucursal: string
  // PNG del gráfico tal como se ve en pantalla; null si la pestaña no tiene.
  imagenGrafico: string | null
  nombreArchivo: string
}

const MARGEN = 14
const ALTO_MAXIMO_GRAFICO = 90
const GRIS: [number, number, number] = [82, 82, 91]

export async function exportarPdf({ negocio, pestana, filas, resumen, periodo, sucursal, imagenGrafico, nombreArchivo }: OpcionesPdf) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const acento = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()

  const doc = new jsPDF({ orientation: pestana.columnas.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const anchoUtil = doc.internal.pageSize.getWidth() - MARGEN * 2

  // Negocio: nombre grande y descripción chica.
  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(negocio.nombre, MARGEN, y)
  doc.setFont('helvetica', 'normal')
  if (negocio.descripcion) {
    doc.setFontSize(10)
    doc.setTextColor(...GRIS)
    const lineas: string[] = doc.splitTextToSize(negocio.descripcion, anchoUtil)
    doc.text(lineas, MARGEN, y + 6)
    y += 6 + (lineas.length - 1) * 4.5
  }
  y += 5
  doc.setDrawColor(acento)
  doc.setLineWidth(0.5)
  doc.line(MARGEN, y, MARGEN + anchoUtil, y)

  // Reporte: título, sucursal, período, cuándo se generó y resumen.
  y += 9
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.text(pestana.titulo, MARGEN, y)
  doc.setFontSize(10)
  doc.setTextColor(...GRIS)
  for (const linea of [
    `Sucursal: ${sucursal}`,
    `Período: ${periodo} · Pedidos entregados`,
    `Generado el ${momentoEnArgentina()}`,
  ]) {
    y += 5.5
    doc.text(linea, MARGEN, y)
  }
  y += 7
  doc.setTextColor(0, 0, 0)
  doc.text(
    `Total vendido: ${formatear(resumen.totalVendido, 'precio')}    ` +
      `Pedidos: ${formatear(resumen.cantidadPedidos, 'numero')}    ` +
      `Ticket promedio: ${formatear(resumen.ticketPromedio, 'precio')}`,
    MARGEN,
    y,
  )

  y += 7
  if (imagenGrafico) {
    const { width, height } = doc.getImageProperties(imagenGrafico)
    const alto = Math.min((anchoUtil * height) / width, ALTO_MAXIMO_GRAFICO)
    const ancho = (alto * width) / height
    doc.addImage(imagenGrafico, 'PNG', MARGEN, y, ancho, alto)
    y += alto + 6
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [pestana.columnas.map((columna) => columna.titulo)],
    body: filas.map((fila) => fila.map((valor, i) => formatear(valor, pestana.columnas[i].formato))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: acento },
    // Números a la derecha, también en el encabezado.
    didParseCell: ({ cell, column }) => {
      cell.styles.halign = pestana.columnas[column.index].formato === 'texto' ? 'left' : 'right'
    },
  })

  doc.save(nombreArchivo)
}
