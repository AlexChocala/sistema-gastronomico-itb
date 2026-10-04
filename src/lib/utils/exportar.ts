// Descarga de listados desde el navegador: CSV (papaparse) y JSON. Genérico: lo usan
// Reportes, Productos y Usuarios. papaparse se carga recién al exportar.

export type ValorCelda = string | number

export function descargarArchivo(contenido: BlobPart, tipo: string, nombreArchivo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// El CSV con encabezado conserva el BOM para Excel; sin encabezado empieza con el primer dato.
export async function descargarCsv(nombreArchivo: string, columnas: string[], filas: ValorCelda[][], conEncabezado = true) {
  const { default: Papa } = await import('papaparse')
  const contenido = conEncabezado ? '\uFEFF' + Papa.unparse({ fields: columnas, data: filas }) : Papa.unparse(filas)
  descargarArchivo(contenido, 'text/csv;charset=utf-8', nombreArchivo)
}

export function descargarJson(nombreArchivo: string, datos: unknown) {
  descargarArchivo(JSON.stringify(datos, null, 2), 'application/json', nombreArchivo)
}
