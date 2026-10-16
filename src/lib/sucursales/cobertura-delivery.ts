import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorSucursal } from './sucursales-validacion'
import { geocodificarDireccion } from './geocodificacion'
import { coberturaConfigurada, dentroDelRadio, distanciaEnKm, MENSAJE_DIRECCION_COMPLETA, separarDireccion } from './radio-delivery'

export const camposCobertura = {
  idSucursal: true, activa: true, ofreceDelivery: true, direccion: true, idLocalidad: true,
  radioDeliveryKm: true, latitud: true, longitud: true,
} satisfies Prisma.SucursalSelect

type SucursalCobertura = Prisma.SucursalGetPayload<{ select: typeof camposCobertura }>
export type CoberturaVerificada = { sucursal: SucursalCobertura; distanciaKm: number }

// Se llama ANTES de abrir la transacción: no se espera a Georef con una conexión bloqueada.
export async function prepararCoberturaDelivery(
  db: PrismaClient, donde: Prisma.SucursalWhereUniqueInput, direccion: string | null, idLocalidad: number | null,
): Promise<CoberturaVerificada> {
  const sucursal = await db.sucursal.findUnique({
    where: donde,
    select: { ...camposCobertura, localidadesDelivery: { select: { idLocalidad: true } } },
  })
  if (!sucursal?.activa) throw new ErrorSucursal(404, 'La sucursal no está disponible.')
  if (!sucursal.ofreceDelivery) throw new ErrorSucursal(400, 'Esta sucursal no hace delivery.')
  if (!coberturaConfigurada(sucursal)) {
    throw new ErrorSucursal(409, 'Esta sucursal todavía no tiene configurada su cobertura de delivery. Consultá al local o elegí retiro si está disponible.')
  }
  if (sucursal.localidadesDelivery.length && (idLocalidad === null || !sucursal.localidadesDelivery.some(z => z.idLocalidad === idLocalidad))) {
    throw new ErrorSucursal(400, 'Elegí una localidad dentro de las zonas de delivery de esta sucursal.')
  }
  const localidad = idLocalidad === null ? null : await db.localidad.findUnique({
    where: { idLocalidad }, select: { nombre: true, provincia: { select: { nombre: true } } },
  })
  if (idLocalidad !== null && !localidad) throw new ErrorSucursal(400, 'La localidad elegida no existe.')
  const datos = separarDireccion(direccion ?? '', localidad ? { localidad: localidad.nombre, provincia: localidad.provincia.nombre } : null)
  if (!datos) throw new ErrorSucursal(400, MENSAJE_DIRECCION_COMPLETA)
  const destino = await geocodificarDireccion(datos.direccion, datos)
  const distanciaKm = distanciaEnKm(sucursal, destino)
  if (!dentroDelRadio(distanciaKm, sucursal.radioDeliveryKm)) {
    throw new ErrorSucursal(400, `La dirección está fuera del radio de delivery de ${sucursal.radioDeliveryKm.toLocaleString('es-AR')} km de esta sucursal.`)
  }
  return { sucursal, distanciaKm }
}

// La configuración se vuelve a leer dentro de la transacción: si cambió durante la
// consulta externa, se pide reintentar en lugar de guardar con una cobertura vieja.
export function verificarCoberturaActual(actual: SucursalCobertura, verificada: CoberturaVerificada | null) {
  const campos = ['idSucursal', 'activa', 'ofreceDelivery', 'direccion', 'idLocalidad', 'radioDeliveryKm', 'latitud', 'longitud'] as const
  if (!verificada || campos.some(campo => actual[campo] !== verificada.sucursal[campo])) {
    throw new ErrorSucursal(409, 'La cobertura de delivery cambió. Revisá los datos e intentá nuevamente.')
  }
}
