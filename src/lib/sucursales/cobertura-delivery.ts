import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorSucursal } from './sucursales-validacion'
import { buscarDireccionesParecidas, geocodificarDireccion } from './geocodificacion'
import {
  coordenadasValidas, cotizarDistancia, dentroDelRadio, distanciaEnKm, distanciaMaxima, leerTramos, MENSAJE_DIRECCION_COMPLETA,
  mensajeFueraDeCobertura, separarDireccion, type Punto, type TramoDelivery,
} from './radio-delivery'

export const camposCobertura = {
  idSucursal: true, activa: true, ofreceDelivery: true, direccion: true, idLocalidad: true,
  tramosDelivery: true, latitud: true, longitud: true,
} satisfies Prisma.SucursalSelect

type SucursalCobertura = Prisma.SucursalGetPayload<{ select: typeof camposCobertura }>
export type CoberturaVerificada = { sucursal: SucursalCobertura; distanciaKm: number; cotizacion: ReturnType<typeof cotizarDistancia> }

// Se llama ANTES de abrir la transacción: no se espera a Georef con una conexión bloqueada.
export async function prepararCoberturaDelivery(
  db: PrismaClient, donde: Prisma.SucursalWhereUniqueInput, direccion: string | null, idLocalidad: number | null,
): Promise<CoberturaVerificada> {
  const sucursal = await db.sucursal.findUnique({
    where: donde,
    select: camposCobertura,
  })
  if (!sucursal?.activa) throw new ErrorSucursal(404, 'La sucursal no está disponible.')
  if (!sucursal.ofreceDelivery) throw new ErrorSucursal(400, 'Esta sucursal no hace delivery.')
  const configuracion = coberturaDe(sucursal)
  if (!configuracion) {
    throw new ErrorSucursal(409, 'Esta sucursal todavía no tiene configurada su cobertura de delivery. Consultá al local o elegí retiro si está disponible.')
  }
  const localidad = idLocalidad === null ? null : await db.localidad.findUnique({
    where: { idLocalidad }, select: { nombre: true, provincia: { select: { nombre: true } } },
  })
  if (idLocalidad !== null && !localidad) throw new ErrorSucursal(400, 'La localidad elegida no existe.')
  const datos = separarDireccion(direccion ?? '', localidad ? { localidad: localidad.nombre, provincia: localidad.provincia.nombre } : null)
  if (!datos) throw new ErrorSucursal(400, MENSAJE_DIRECCION_COMPLETA)
  const destino = await geocodificarDireccion(datos.direccion, datos)
  const distanciaKm = distanciaEnKm(configuracion.local, destino)
  const maximoKm = distanciaMaxima(configuracion.tramos)
  if (!dentroDelRadio(distanciaKm, maximoKm)) throw new ErrorSucursal(400, mensajeFueraDeCobertura(distanciaKm, maximoKm))
  return { sucursal, distanciaKm, cotizacion: cotizarDistancia(distanciaKm, configuracion.tramos) }
}

// Ubicación del local y tramos válidos, o null si falta configurar alguno de los dos.
function coberturaDe(sucursal: { tramosDelivery: unknown; latitud: number | null; longitud: number | null }):
  { local: Punto; tramos: TramoDelivery[] } | null {
  const tramos = leerTramos(sucursal.tramosDelivery)
  if (!tramos || !coordenadasValidas(sucursal.latitud, sucursal.longitud)) return null
  return { local: { latitud: sucursal.latitud!, longitud: sucursal.longitud! }, tramos }
}

// La configuración se vuelve a leer dentro de la transacción: si cambió durante la
// consulta externa, se pide reintentar en lugar de guardar con una cobertura vieja.
export function verificarCoberturaActual(actual: SucursalCobertura, verificada: CoberturaVerificada | null) {
  const campos = ['idSucursal', 'activa', 'ofreceDelivery', 'direccion', 'idLocalidad', 'latitud', 'longitud'] as const
  if (!verificada || campos.some(campo => actual[campo] !== verificada.sucursal[campo])
    || JSON.stringify(actual.tramosDelivery) !== JSON.stringify(verificada.sucursal.tramosDelivery)) {
    throw new ErrorSucursal(409, 'La cobertura de delivery cambió. Revisá los datos e intentá nuevamente.')
  }
}

// Nunca se acepta un importe del navegador como precio: solo confirma el calculado aquí.
export function exigirRecargoAceptado(cobertura: CoberturaVerificada | null, aceptado: number | null) {
  const importe = cobertura?.cotizacion.recargoDelivery ?? 0
  if (aceptado !== importe) throw new ErrorSucursal(409, 'El costo del envío cambió. Volvé a calcularlo y revisá el total antes de confirmar.')
  return importe
}

const MAX_SUGERENCIAS = 5

export type SugerenciaDireccion = { direccion: string }

// Sugerencias para el campo de dirección del delivery (menú digital y Caja). El cliente
// elige una y la dirección vuelve a pasar por prepararCoberturaDelivery al cotizar y al
// confirmar: lo que se devuelve acá es solo texto, nunca un precio ni coordenadas.
export async function sugerirDireccionesDelivery(
  db: PrismaClient, donde: Prisma.SucursalWhereUniqueInput, texto: string,
): Promise<SugerenciaDireccion[]> {
  const sucursal = await db.sucursal.findUnique({
    where: donde,
    select: { ...camposCobertura, localidad: { select: { provincia: { select: { nombre: true } } } } },
  })
  const configuracion = sucursal?.activa && sucursal.ofreceDelivery ? coberturaDe(sucursal) : null
  if (!sucursal || !configuracion) return []
  const limiteKm = distanciaMaxima(configuracion.tramos)
  const encontradas = await buscarDireccionesParecidas(texto, sucursal.localidad.provincia.nombre)
  const vistas = new Set<string>()
  return encontradas
    .map((d) => ({ direccion: d.direccion, distanciaKm: distanciaEnKm(configuracion.local, d) }))
    .filter((d) => dentroDelRadio(d.distanciaKm, limiteKm))
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .filter((d) => !vistas.has(d.direccion) && vistas.add(d.direccion))
    .slice(0, MAX_SUGERENCIAS)
    .map(({ direccion }) => ({ direccion }))
}
