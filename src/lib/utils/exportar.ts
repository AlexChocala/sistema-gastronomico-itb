// Descarga de listados desde el navegador: CSV (papaparse) y JSON. Genérico: lo usan
// Reportes, Productos y Usuarios. papaparse se carga recién al exportar.
// También define las opciones de exportación: el menú de Reportes (components/ui/MenuExportar.tsx)
// y el modal de Productos y Usuarios (components/ui/ExportarImportar.tsx).

export type ValorCelda = string | number

// Una opción del menú "Exportar". El texto dice qué se descarga (ej. "PDF de esta pestaña").
export type OpcionExportar = { texto: string; generar: () => Promise<void> | void }

// El título del grupo dice para qué sirven sus archivos (ej. "Para leer o imprimir").
export type GrupoExportar = { titulo: string; opciones: OpcionExportar[] }

// filas: lo que va al CSV, con los títulos de `columnas`. json: los datos crudos, pensados
// para otro sistema.
export type DatosExportables = { filas: ValorCelda[][]; json: unknown }

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
  const contenido = conEncabezado ? '﻿' + Papa.unparse({ fields: columnas, data: filas }) : Papa.unparse(filas)
  descargarArchivo(contenido, 'text/csv;charset=utf-8', nombreArchivo)
}

export function descargarJson(nombreArchivo: string, datos: unknown) {
  descargarArchivo(JSON.stringify(datos, null, 2), 'application/json', nombreArchivo)
}

// CSV vacío, solo con las columnas: el "Descargar ejemplo" de ExportarImportar.
export function descargarPlantillaCsv(nombreArchivo: string, columnas: string[]) {
  return descargarCsv(nombreArchivo, columnas, [])
}

// CSV para Excel, y CSV sin encabezado y JSON para otro sistema. `nombreArchivo` va sin
// extensión. obtenerDatos se llama al elegir la opción, así puede pedir datos al servidor.
export function gruposDatosDelListado(
  nombreArchivo: string,
  columnas: string[],
  obtenerDatos: () => Promise<DatosExportables> | DatosExportables,
): GrupoExportar[] {
  return [
    {
      titulo: 'Para Excel o Sheets',
      opciones: [
        { texto: 'CSV', generar: async () => descargarCsv(`${nombreArchivo}.csv`, columnas, (await obtenerDatos()).filas) },
      ],
    },
    {
      titulo: 'Para otro sistema',
      opciones: [
        // Para sistemas que toman la primera fila como dato y fallan al leer "ID" como número.
        {
          texto: 'CSV sin encabezado',
          generar: async () => descargarCsv(`${nombreArchivo}_sin_encabezado.csv`, columnas, (await obtenerDatos()).filas, false),
        },
        { texto: 'JSON', generar: async () => descargarJson(`${nombreArchivo}.json`, (await obtenerDatos()).json) },
      ],
    },
  ]
}
