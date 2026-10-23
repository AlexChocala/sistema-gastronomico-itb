// Solo servidor. Cuando el cliente elige una dirección de las sugerencias, el servidor ya
// sabe dónde queda y en qué localidad cae. En vez de volver a buscar ese texto en Georef
// (que puede dar dudoso si hay dos calles con el mismo nombre), le devuelve esos datos
// firmados. Al cotizar y al confirmar el pedido se revisa la firma: el navegador no puede
// inventar ni cambiar la localidad, porque cualquier cambio invalida la firma.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { coordenadasValidas } from './radio-delivery'

export type UbicacionElegida = {
  idSucursal: number
  direccion: string
  latitud: number
  longitud: number
  localidad: string
  provincia: string
}

// Alcanza para completar un pedido con calma; después hay que volver a elegir la dirección.
const VIGENCIA_MS = 24 * 60 * 60 * 1000

function clave() {
  const secreto = process.env.NEXTAUTH_SECRET
  if (!secreto) throw new Error('Falta NEXTAUTH_SECRET para firmar ubicaciones.')
  return secreto
}

function firma(cuerpo: string) {
  return createHmac('sha256', clave()).update(`ubicacion-delivery:${cuerpo}`).digest('base64url')
}

export function firmarUbicacion(datos: UbicacionElegida, ahora = Date.now()): string {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, emitida: ahora })).toString('base64url')
  return `${cuerpo}.${firma(cuerpo)}`
}

// Devuelve los datos si la firma es válida y no venció; si no, null.
export function leerUbicacion(token: string, ahora = Date.now()): UbicacionElegida | null {
  const [cuerpo, recibida, ...resto] = token.split('.')
  if (!cuerpo || !recibida || resto.length) return null
  const esperada = Buffer.from(firma(cuerpo))
  const dada = Buffer.from(recibida)
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Record<string, unknown>
    if (typeof d.emitida !== 'number' || ahora - d.emitida > VIGENCIA_MS || d.emitida - ahora > 60_000) return null
    if (!Number.isSafeInteger(d.idSucursal) || typeof d.direccion !== 'string' || typeof d.localidad !== 'string'
      || typeof d.provincia !== 'string' || !coordenadasValidas(d.latitud, d.longitud)) return null
    return {
      idSucursal: d.idSucursal as number, direccion: d.direccion, latitud: d.latitud as number, longitud: d.longitud as number,
      localidad: d.localidad, provincia: d.provincia,
    }
  } catch {
    return null
  }
}
