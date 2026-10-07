// Pedidos de la administración de extras desde el cliente (contrato en extras-tipos.ts).
//
// Mientras el backend no exista, Next responde 404 sin JSON: en ese caso se trabaja sobre
// una copia en memoria de los datos de ejemplo (se pierde al recargar) y el listado vuelve
// marcado con `esEjemplo` para que la pantalla lo avise. Un 404 con { error } es un error
// real del backend y se muestra como tal.

import { MENSAJES } from '@/lib/utils/mensajes'
import { EXTRAS_DE_EJEMPLO } from './extras-datos-de-ejemplo'
import type {
  CambiosExtra, DatosNuevoExtra, Extra, ExtraDisponible, RespuestaExtra, RespuestaListadoExtras,
} from './extras-tipos'

const URL_EXTRAS = '/api/productos/extras'

let ejemplo: RespuestaListadoExtras | null = null

function datosDeEjemplo() {
  ejemplo ??= structuredClone(EXTRAS_DE_EJEMPLO)
  return ejemplo
}

function porNombre(a: { nombre: string }, b: { nombre: string }) {
  return a.nombre.localeCompare(b.nombre, 'es')
}

// Devuelve null cuando el endpoint todavía no existe (404 sin JSON).
async function pedir<T>(url: string, init?: RequestInit): Promise<T | null> {
  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error(MENSAJES.panel.sinConexion)
  }

  const datos = (await respuesta.json().catch(() => null)) as (T & { error?: unknown }) | null
  if (respuesta.status === 404 && datos === null) return null
  if (!respuesta.ok || datos === null) {
    throw new Error(typeof datos?.error === 'string' ? datos.error : MENSAJES.panel.errorGenerico)
  }
  return datos
}

// Mismas reglas que el backend (ver extras-tipos.ts), para que el ejemplo se comporte igual.
function validarEnEjemplo(idCategoria: number, idExtraActual: number | null, cambios: CambiosExtra) {
  const { extras, productos } = datosDeEjemplo()
  const nombre = cambios.nombre?.trim()
  if (nombre !== undefined && extras.some((otro) => otro.idCategoria === idCategoria
    && otro.idExtra !== idExtraActual && otro.nombre.toLowerCase() === nombre.toLowerCase())) {
    throw new Error('Ya existe un extra con ese nombre en esta categoría.')
  }
  if (cambios.idProductos?.some((id) => !productos.some((p) => p.idProducto === id && p.idCategoria === idCategoria))) {
    throw new Error('Los productos elegidos deben ser de la categoría del extra.')
  }
  return nombre
}

function aplicarEnEjemplo(extra: Extra, cambios: CambiosExtra, nombre: string | undefined): Extra {
  const { idProductos, ...resto } = cambios
  Object.assign(extra, resto, nombre === undefined ? {} : { nombre })
  if (idProductos !== undefined) extra.productos = idProductos.map((idProducto) => ({ idProducto }))
  return structuredClone(extra)
}

function cambiarEnEjemplo(idExtra: number, cambios: CambiosExtra): Extra {
  const extra = datosDeEjemplo().extras.find((actual) => actual.idExtra === idExtra)
  if (!extra) throw new Error('Extra no encontrado.')
  return aplicarEnEjemplo(extra, cambios, validarEnEjemplo(extra.idCategoria, idExtra, cambios))
}

export async function listarExtras(): Promise<{ datos: RespuestaListadoExtras; esEjemplo: boolean }> {
  const datos = await pedir<RespuestaListadoExtras>(URL_EXTRAS)
  if (datos !== null) return { datos, esEjemplo: false }
  const copia = structuredClone(datosDeEjemplo())
  copia.extras.sort(porNombre)
  return { datos: copia, esEjemplo: true }
}

export async function crearExtra(nuevo: DatosNuevoExtra): Promise<Extra> {
  const datos = await pedir<RespuestaExtra>(URL_EXTRAS, { method: 'POST', body: JSON.stringify(nuevo) })
  if (datos !== null) return datos.extra

  const { idCategoria, ...cambios } = nuevo
  const nombre = validarEnEjemplo(idCategoria, null, cambios)
  const { extras } = datosDeEjemplo()
  const extra: Extra = {
    idExtra: Math.max(0, ...extras.map((actual) => actual.idExtra)) + 1,
    idCategoria, nombre: '', precioAdicional: 0, activo: true, productos: [],
  }
  extras.push(extra)
  return aplicarEnEjemplo(extra, cambios, nombre)
}

export async function editarExtra(idExtra: number, cambios: CambiosExtra): Promise<Extra> {
  const datos = await pedir<RespuestaExtra>(`${URL_EXTRAS}/${idExtra}`, {
    method: 'PATCH', body: JSON.stringify(cambios),
  })
  return datos === null ? cambiarEnEjemplo(idExtra, cambios) : datos.extra
}

export async function desactivarExtra(idExtra: number): Promise<Extra> {
  const datos = await pedir<RespuestaExtra>(`${URL_EXTRAS}/${idExtra}`, { method: 'DELETE' })
  return datos === null ? cambiarEnEjemplo(idExtra, { activo: false }) : datos.extra
}

// Para el formulario de producto mientras GET /api/productos/gestion no devuelva `extras`.
export function extrasDisponiblesDeEjemplo(): ExtraDisponible[] {
  return datosDeEjemplo().extras
    .filter((extra) => extra.activo)
    .sort(porNombre)
    .map(({ idExtra, idCategoria, nombre, precioAdicional }) => ({ idExtra, idCategoria, nombre, precioAdicional }))
}
