import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorSucursal } from './sucursales-validacion'
import { geocodificarDireccion } from './geocodificacion'
import { coberturaConfigurada, cotizarDistancia, recargoDeliveryValido, distanciaEnKm, MENSAJE_DIRECCION_COMPLETA, separarDireccion } from './radio-delivery'

export const camposCobertura = {
  idSucursal: true, activa: true, ofreceDelivery: true, direccion: true, idLocalidad: true,
  radioDeliveryKm: true, recargoFueraRadio: true, latitud: true, longitud: true,
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
  if (!coberturaConfigurada(sucursal)) {
    throw new ErrorSucursal(409, 'Esta sucursal todavía no tiene configurada su cobertura de delivery. Consultá al local o elegí retiro si está disponible.')
  }
  const localidad = idLocalidad === null ? null : await db.localidad.findUnique({
    where: { idLocalidad }, select: { nombre: true, provincia: { select: { nombre: true } } },
  })
  if (idLocalidad !== null && !localidad) throw new ErrorSucursal(400, 'La localidad elegida no existe.')
  const datos = separarDireccion(direccion ?? '', localidad ? { localidad: localidad.nombre, provincia: localidad.provincia.nombre } : null)
  if (!datos) throw new ErrorSucursal(400, MENSAJE_DIRECCION_COMPLETA)
  const destino = await geocodificarDireccion(datos.direccion, datos)
  const distanciaKm = distanciaEnKm(sucursal, destino)
  if (distanciaKm > sucursal.radioDeliveryKm + 1e-9 && !recargoDeliveryValido(sucursal.recargoFueraRadio)) {
    throw new ErrorSucursal(409, 'La sucursal debe configurar el recargo para entregar fuera del radio. Consultá al local.')
  }
  return { sucursal, distanciaKm, cotizacion: cotizarDistancia(distanciaKm, sucursal.radioDeliveryKm, sucursal.recargoFueraRadio) }
}

// La configuración se vuelve a leer dentro de la transacción: si cambió durante la
// consulta externa, se pide reintentar en lugar de guardar con una cobertura vieja.
export function verificarCoberturaActual(actual: SucursalCobertura, verificada: CoberturaVerificada | null) {
  const campos = ['idSucursal', 'activa', 'ofreceDelivery', 'direccion', 'idLocalidad', 'radioDeliveryKm', 'recargoFueraRadio', 'latitud', 'longitud'] as const
  if (!verificada || campos.some(campo => actual[campo] !== verificada.sucursal[campo])) {
    throw new ErrorSucursal(409, 'La cobertura de delivery cambió. Revisá los datos e intentá nuevamente.')
  }
}

// Nunca se acepta un importe del navegador como precio: solo confirma el calculado aquí.
export function exigirRecargoAceptado(cobertura: CoberturaVerificada | null, aceptado: number | null) {
  const importe = cobertura?.cotizacion.recargoDelivery ?? 0
  if (aceptado !== importe) throw new ErrorSucursal(409, 'El costo del envío cambió. Volvé a calcularlo y revisá el total antes de confirmar.')
  return importe
}
