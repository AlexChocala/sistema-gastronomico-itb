// PDF de la pestaña visible de Reportes: encabezado, resumen, imagen del gráfico y tabla.
// jspdf y jspdf-autotable se cargan recién al exportar.

import { formatear, type Pestana, type Valor } from './pestanas'
import type { ResumenVentas } from './tipos'

type OpcionesPdf = {
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

export async function exportarPdf({ pestana, filas, resumen, periodo, sucursal, imagenGrafico, nombreArchivo }: OpcionesPdf) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const acento = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()

  const doc = new jsPDF({ orientation: pestana.columnas.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const anchoUtil = doc.internal.pageSize.getWidth() - MARGEN * 2

  doc.setFontSize(16)
  doc.text(pestana.titulo, MARGEN, 18)
  doc.setFontSize(10)
  doc.setTextColor(82, 82, 91)
  doc.text(`${periodo} · ${sucursal} · Pedidos entregados`, MARGEN, 25)
  doc.text(
    `Total vendido: ${formatear(resumen.totalVendido, 'precio')}    ` +
      `Pedidos: ${formatear(resumen.cantidadPedidos, 'numero')}    ` +
      `Ticket promedio: ${formatear(resumen.ticketPromedio, 'precio')}`,
    MARGEN,
    31,
  )

  let y = 38
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
