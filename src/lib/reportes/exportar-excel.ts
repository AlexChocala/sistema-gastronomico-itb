// Excel de Reportes: hoja "Resumen" y una hoja por reporte disponible. Los números van
// como números (se pueden sumar y ordenar) y los montos con formato de pesos.
// SheetJS se carga recién al exportar.

import type { NegocioReporte } from './exportar-pdf'
import { momentoEnArgentina } from './fechas'
import { PESTANAS } from './pestanas'
import type { Agrupacion, DatosReportes } from './tipos'

type OpcionesExcel = {
  negocio: NegocioReporte
  datos: DatosReportes
  agrupacion: Agrupacion
  periodo: string
  sucursal: string
  nombreArchivo: string
}

const FORMATO_PESOS = '"$" #,##0'

export async function exportarExcel({ negocio, datos, agrupacion, periodo, sucursal, nombreArchivo }: OpcionesExcel) {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()

  const { totalVendido, cantidadPedidos, ticketPromedio } = datos.resumen
  const resumen = XLSX.utils.aoa_to_sheet([
    ['Negocio', negocio.nombre],
    ['Sucursal', sucursal],
    ['Período', `${periodo} · Pedidos entregados`],
    ['Generado', momentoEnArgentina()],
    ['Total vendido', totalVendido],
    ['Pedidos entregados', cantidadPedidos],
    ['Ticket promedio', ticketPromedio],
  ])
  resumen.B5.z = FORMATO_PESOS
  resumen.B7.z = FORMATO_PESOS
  resumen['!cols'] = [{ wch: 20 }, { wch: 32 }]
  XLSX.utils.book_append_sheet(libro, resumen, 'Resumen')

  for (const pestana of PESTANAS) {
    if (pestana.disponible && !pestana.disponible(datos)) continue
    const filas = pestana.filas(datos, agrupacion)
    const hoja = XLSX.utils.aoa_to_sheet([pestana.columnas.map((columna) => columna.titulo), ...filas])

    pestana.columnas.forEach((columna, c) => {
      if (columna.formato !== 'precio') return
      for (let r = 1; r <= filas.length; r++) hoja[XLSX.utils.encode_cell({ r, c })].z = FORMATO_PESOS
    })
    hoja['!cols'] = pestana.columnas.map((columna) => ({ wch: Math.max(columna.titulo.length + 2, 14) }))

    // Excel admite hasta 31 caracteres en el nombre de la hoja.
    XLSX.utils.book_append_sheet(libro, hoja, pestana.titulo.slice(0, 31))
  }

  XLSX.writeFile(libro, nombreArchivo)
}
