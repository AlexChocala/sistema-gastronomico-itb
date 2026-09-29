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

// Con BOM al principio para que Excel lea bien los acentos si se abre ahí.
export async function descargarCsv(nombreArchivo: string, columnas: string[], filas: ValorCelda[][]) {
  const { default: Papa } = await import('papaparse')
  descargarArchivo('﻿' + Papa.unparse({ fields: columnas, data: filas }), 'text/csv;charset=utf-8', nombreArchivo)
}

export function descargarJson(nombreArchivo: string, datos: unknown) {
  descargarArchivo(JSON.stringify(datos, null, 2), 'application/json', nombreArchivo)
}
