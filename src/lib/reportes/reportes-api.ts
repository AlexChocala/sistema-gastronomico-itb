// Pedido de los reportes desde el cliente (GET /api/reportes, ver tipos.ts).
//
// Mientras el backend no exista, Next responde 404 sin JSON: en ese caso se usan los
// datos de ejemplo, marcados con `esEjemplo` para que la pantalla lo avise. Un 404 con
// { error } es un error real del backend y se muestra como tal.

import { MENSAJES } from '@/lib/utils/mensajes'
import { generarDatosDeEjemplo } from './datos-de-ejemplo'
import type { DatosReportes, FiltrosReportes } from './tipos'

export type ResultadoReportes = { datos: DatosReportes; esEjemplo: boolean }

export async function obtenerReportes(filtros: FiltrosReportes): Promise<ResultadoReportes> {
  const parametros = new URLSearchParams({
    desde: filtros.desde,
    hasta: filtros.hasta,
    sucursal: String(filtros.sucursal),
    agrupacion: filtros.agrupacion,
  })

  let respuesta: Response
  try {
    respuesta = await fetch(`/api/reportes?${parametros}`, { cache: 'no-store' })
  } catch {
    throw new Error(MENSAJES.panel.sinConexion)
  }

  const datos = (await respuesta.json().catch(() => null)) as (DatosReportes & { error?: unknown }) | null
  if (respuesta.status === 404 && datos === null) {
    return { datos: generarDatosDeEjemplo(filtros), esEjemplo: true }
  }
  if (!respuesta.ok || datos === null) {
    throw new Error(typeof datos?.error === 'string' ? datos.error : MENSAJES.panel.errorGenerico)
  }
  return { datos, esEjemplo: false }
}
