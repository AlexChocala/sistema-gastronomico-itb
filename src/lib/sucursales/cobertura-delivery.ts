import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorSucursal } from './sucursales-validacion'
import { buscarDireccionesEnLocalidad, buscarDireccionesParecidas, geocodificarDireccion, localidadDelPunto } from './geocodificacion'
import { firmarUbicacion, leerUbicacion } from './ubicacion-firmada'
import {
  claveLugar, coordenadasValidas, dentroDelRadio, distanciaEnKm, MENSAJE_DIRECCION_COMPLETA, separarDireccion,
  type CotizacionDelivery, type Punto, type ZonaDelivery,
} from './radio-delivery'

// Zonas de delivery de la sucursal: localidad y costo del envío de cada una.
export const camposZonas = {
  select: { idLocalidad: true, costoEnvio: true, localidad: { select: { nombre: true, provincia: { select: { nombre: true } } } } },
  orderBy: { idLocalidad: 'asc' },
} satisfies Prisma.Sucursal$localidadesDeliveryArgs

export const camposCobertura = {
  idSucursal: true, activa: true, ofreceDelivery: true, direccion: true, idLocalidad: true,
  latitud: true, longitud: true, localidadesDelivery: camposZonas,
} satisfies Prisma.SucursalSelect

type SucursalCobertura = Prisma.SucursalGetPayload<{ select: typeof camposCobertura }>
export type CoberturaVerificada = {
  sucursal: SucursalCobertura
  // Localidad de la zona en la que cayó la dirección: se guarda en el pedido.
  idLocalidad: number
  cotizacion: CotizacionDelivery
}

// Se llama ANTES de abrir la transacción: no se espera a Georef con una conexión bloqueada.
export async function prepararCoberturaDelivery(
  db: PrismaClient, donde: Prisma.SucursalWhereUniqueInput, direccion: string | null, idLocalidad: number | null,
  // Ubicación firmada de la sugerencia elegida: si viene, no se vuelve a buscar la dirección.
  ubicacion: string | null = null,
): Promise<CoberturaVerificada> {
  const sucursal = await db.sucursal.findUnique({
    where: donde,
    select: camposCobertura,
  })
  if (!sucursal?.activa) throw new ErrorSucursal(404, 'La sucursal no está disponible.')
  if (!sucursal.ofreceDelivery) throw new ErrorSucursal(400, 'Esta sucursal no hace delivery.')
  if (!ubicacionDelLocal(sucursal) || sucursal.localidadesDelivery.length === 0) {
    throw new ErrorSucursal(409, 'Esta sucursal todavía no tiene configurada su cobertura de delivery. Consultá al local o elegí retiro si está disponible.')
  }
  if (ubicacion) {
    const elegida = leerUbicacion(ubicacion)
    if (!elegida || elegida.idSucursal !== sucursal.idSucursal || elegida.direccion !== (direccion ?? '').trim()) {
      throw new ErrorSucursal(400, 'Volvé a elegir tu dirección de la lista.')
    }
    return cotizarEnZona(sucursal, elegida.localidad, elegida.provincia)
  }
  const localidad = idLocalidad === null ? null : await db.localidad.findUnique({
    where: { idLocalidad }, select: { nombre: true, provincia: { select: { nombre: true } } },
  })
  if (idLocalidad !== null && !localidad) throw new ErrorSucursal(400, 'La localidad elegida no existe.')
  const datos = separarDireccion(direccion ?? '', localidad ? { localidad: localidad.nombre, provincia: localidad.provincia.nombre } : null)
  if (!datos) throw new ErrorSucursal(400, MENSAJE_DIRECCION_COMPLETA)
  const destino = await geocodificarDireccion(datos.direccion, datos)
  const lugar = await localidadDelPunto(destino)
  if (!lugar) throw new ErrorSucursal(400, 'No pudimos saber en qué localidad queda esa dirección. Revisá la calle y el número.')
  return cotizarEnZona(sucursal, lugar.nombre, lugar.provincia)
}

function cotizarEnZona(sucursal: SucursalCobertura, nombre: string, provincia: string): CoberturaVerificada {
  const zona = sucursal.localidadesDelivery.find((z) =>
    claveLugar(z.localidad.nombre, z.localidad.provincia.nombre) === claveLugar(nombre, provincia))
  if (!zona) throw new ErrorSucursal(400, `No hacemos delivery a ${nombre}. Podés elegir retiro en el local.`)
  return {
    sucursal, idLocalidad: zona.idLocalidad,
    cotizacion: { localidad: zona.localidad.nombre, recargoDelivery: zona.costoEnvio },
  }
}

// Localidades a las que entrega la sucursal, con su costo, para que el cliente elija la
// suya antes de escribir la dirección. Vacía si la sucursal no hace delivery.
export async function zonasDeliveryDe(db: PrismaClient, donde: Prisma.SucursalWhereUniqueInput): Promise<ZonaDelivery[]> {
  const sucursal = await db.sucursal.findUnique({ where: donde, select: camposCobertura })
  if (!sucursal?.activa || !sucursal.ofreceDelivery || !ubicacionDelLocal(sucursal)) return []
  return sucursal.localidadesDelivery
    .map((z) => ({ nombre: z.localidad.nombre, provincia: z.localidad.provincia.nombre, costo: z.costoEnvio }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

function ubicacionDelLocal(sucursal: { latitud: number | null; longitud: number | null }): Punto | null {
  return coordenadasValidas(sucursal.latitud, sucursal.longitud) ? { latitud: sucursal.latitud!, longitud: sucursal.longitud! } : null
}

// La configuración se vuelve a leer dentro de la transacción: si cambió durante la
// consulta externa, se pide reintentar en lugar de guardar con una cobertura vieja.
export function verificarCoberturaActual(actual: SucursalCobertura, verificada: CoberturaVerificada | null) {
  const campos = ['idSucursal', 'activa', 'ofreceDelivery', 'direccion', 'idLocalidad', 'latitud', 'longitud'] as const
  if (!verificada || campos.some(campo => actual[campo] !== verificada.sucursal[campo])
    || JSON.stringify(actual.localidadesDelivery) !== JSON.stringify(verificada.sucursal.localidadesDelivery)) {
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
// Las sugerencias se limitan a esta distancia del local, para no ofrecer la misma calle de
// otra ciudad. Si la dirección cae en una localidad sin delivery, lo avisa la cotización.
const DISTANCIA_SUGERENCIAS_KM = 20

// ubicacion: datos firmados de la dirección (solo cuando se buscó dentro de una localidad);
// se devuelven al cotizar y al confirmar para no volver a buscarla.
export type SugerenciaDireccion = { direccion: string; ubicacion?: string }

// Sugerencias para el campo de dirección del delivery (menú digital y Caja). El cliente
// elige una y la dirección vuelve a pasar por prepararCoberturaDelivery al cotizar y al
// confirmar: lo que se devuelve acá es solo texto, nunca un precio ni coordenadas.
export async function sugerirDireccionesDelivery(
  db: PrismaClient, donde: Prisma.SucursalWhereUniqueInput, texto: string,
  localidad: { nombre: string; provincia: string } | null = null,
): Promise<SugerenciaDireccion[]> {
  const sucursal = await db.sucursal.findUnique({
    where: donde,
    select: { ...camposCobertura, localidad: { select: { provincia: { select: { nombre: true } } } } },
  })
  const local = sucursal?.activa && sucursal.ofreceDelivery && sucursal.localidadesDelivery.length ? ubicacionDelLocal(sucursal) : null
  if (!sucursal || !local) return []
  if (localidad) {
    // Solo una localidad a la que entrega: si no, no hay nada que sugerir.
    const zona = sucursal.localidadesDelivery.find((z) =>
      claveLugar(z.localidad.nombre, z.localidad.provincia.nombre) === claveLugar(localidad.nombre, localidad.provincia))
    if (!zona) return []
    const enLocalidad = await buscarDireccionesEnLocalidad(texto, { nombre: zona.localidad.nombre, provincia: zona.localidad.provincia.nombre })
      .catch(() => [])
    const vistas = new Set<string>()
    return enLocalidad
      .filter((d) => !vistas.has(d.direccion) && vistas.add(d.direccion))
      .slice(0, MAX_SUGERENCIAS)
      .map((d) => ({
        direccion: d.direccion,
        ubicacion: firmarUbicacion({
          idSucursal: sucursal.idSucursal, direccion: d.direccion, latitud: d.latitud, longitud: d.longitud,
          localidad: zona.localidad.nombre, provincia: zona.localidad.provincia.nombre,
        }),
      }))
  }
  const encontradas = await buscarDireccionesParecidas(texto, sucursal.localidad.provincia.nombre, local)
  const vistas = new Set<string>()
  return encontradas
    .map((d) => ({ direccion: d.direccion, distanciaKm: distanciaEnKm(local, d) }))
    .filter((d) => dentroDelRadio(d.distanciaKm, DISTANCIA_SUGERENCIAS_KM))
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .filter((d) => !vistas.has(d.direccion) && vistas.add(d.direccion))
    .slice(0, MAX_SUGERENCIAS)
    .map(({ direccion }) => ({ direccion }))
}
