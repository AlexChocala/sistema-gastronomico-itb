'use client'

// Botones de descarga. BotonDescarga muestra "Generando…" mientras arma el archivo y
// "Reintentar" si falla. BotonesExportar ofrece CSV y JSON de un listado (Reportes,
// Productos, Usuarios).

import { useState } from 'react'
import { MENSAJES } from '@/lib/utils/mensajes'
import { descargarCsv, descargarJson, type ValorCelda } from '@/lib/utils/exportar'

// 'chico': junto a pestañas y tablas. 'normal': mismo alto que los botones de un encabezado.
type TamanoBotonDescarga = 'chico' | 'normal'

interface BotonDescargaProps {
  texto: string
  // Para lectores de pantalla y el tooltip, ej. "Descargar PDF".
  descripcion: string
  generar: () => Promise<void> | void
  deshabilitado?: boolean
  tamano?: TamanoBotonDescarga
}

export function BotonDescarga({ texto, descripcion, generar, deshabilitado = false, tamano = 'chico' }: BotonDescargaProps) {
  const [estado, setEstado] = useState<'listo' | 'generando' | 'error'>('listo')

  async function alHacerClic() {
    setEstado('generando')
    try {
      await generar()
      setEstado('listo')
    } catch {
      setEstado('error')
    }
  }

  return (
    <button
      type="button"
      onClick={alHacerClic}
      disabled={deshabilitado || estado === 'generando'}
      aria-label={estado === 'error' ? `${MENSAJES.panel.errorGenerico} ${descripcion}` : descripcion}
      title={estado === 'error' ? MENSAJES.panel.errorGenerico : descripcion}
      className={`cursor-pointer rounded-full border px-4 text-sm ${tamano === 'chico' ? 'py-1.5' : 'py-2.5'} font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${estado === 'error' ? 'border-danger text-danger' : 'border-border text-text hover:bg-bg'}`}
    >
      {estado === 'generando' ? 'Generando…' : estado === 'error' ? 'Reintentar' : texto}
    </button>
  )
}

// filas: lo que va al CSV, con los títulos de `columnas`. json: los datos crudos, pensados
// para otro sistema.
export type DatosExportables = { filas: ValorCelda[][]; json: unknown }

interface BotonesExportarProps {
  // Sin extensión: se agrega .csv o .json.
  nombreArchivo: string
  columnas: string[]
  // Se llama al hacer clic, así puede pedir datos al servidor (ej. todas las páginas).
  obtenerDatos: () => Promise<DatosExportables> | DatosExportables
  deshabilitado?: boolean
  tamano?: TamanoBotonDescarga
}

export function BotonesExportar({ nombreArchivo, columnas, obtenerDatos, deshabilitado, tamano }: BotonesExportarProps) {
  return (
    <>
      <BotonDescarga
        texto="CSV"
        descripcion="Descargar CSV"
        deshabilitado={deshabilitado}
        tamano={tamano}
        generar={async () => descargarCsv(`${nombreArchivo}.csv`, columnas, (await obtenerDatos()).filas, false)}
      />
      <BotonDescarga
        texto="JSON"
        descripcion="Descargar JSON"
        deshabilitado={deshabilitado}
        tamano={tamano}
        generar={async () => descargarJson(`${nombreArchivo}.json`, (await obtenerDatos()).json)}
      />
    </>
  )
}
