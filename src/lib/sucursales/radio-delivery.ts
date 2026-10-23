// Reglas compartidas por formularios y servidor para el delivery.
//
// Cada sucursal elige a qué localidades entrega y cuánto cobra el envío en cada una:
//   [{ nombre: 'Avellaneda', provincia: 'Buenos Aires', costo: 800 },
//    { nombre: 'Wilde', provincia: 'Buenos Aires', costo: 1500 }]
// Una dirección de una localidad que no está en la lista no puede pedir delivery.
// La ubicación del local (latitud/longitud) se usa para listar las localidades cercanas
// al configurar y para sugerir direcciones al cliente; las distancias son en línea recta.
export const MAX_ZONAS = 60
export const MENSAJE_DIRECCION_COMPLETA = 'Ingresá calle y número, localidad y provincia, separados por comas. Ej: Olavarría 65, Avellaneda, Buenos Aires.'
export const MENSAJE_ZONAS = 'Elegí al menos una localidad a la que hacés delivery y poné el costo del envío de cada una (en pesos, sin centavos).'

export type ZonaDelivery = { nombre: string; provincia: string; costo: number }

// Devuelve las zonas validadas (sin repetir localidad), o null si algo no es válido. Una
// lista vacía es válida: la usa una sucursal que no hace delivery.
export function leerZonas(valor: unknown): ZonaDelivery[] | null {
  if (!Array.isArray(valor) || valor.length > MAX_ZONAS) return null
  const zonas: ZonaDelivery[] = []
  const vistas = new Set<string>()
  for (const zona of valor) {
    if (typeof zona !== 'object' || zona === null || Array.isArray(zona)) return null
    const { nombre, provincia, costo, ...otros } = zona as Record<string, unknown>
    if (Object.keys(otros).length > 0 || !recargoDeliveryValido(costo)) return null
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) return null
    if (typeof provincia !== 'string' || !provincia.trim() || provincia.trim().length > 100) return null
    const clave = claveLugar(nombre, provincia)
    if (vistas.has(clave)) return null
    vistas.add(clave)
    zonas.push({ nombre: nombre.trim(), provincia: provincia.trim(), costo })
  }
  return zonas
}

// Misma localidad aunque cambien tildes, mayúsculas o la forma de escribir CABA.
export function claveLugar(nombre: string, provincia: string) {
  return `${normalizarLugar(nombre)}|${normalizarLugar(provincia)}`
}

export function coordenadasValidas(latitud: unknown, longitud: unknown) {
  return typeof latitud === 'number' && Number.isFinite(latitud) && latitud >= -90 && latitud <= 90
    && typeof longitud === 'number' && Number.isFinite(longitud) && longitud >= -180 && longitud <= 180
}

// Delivery listo para recibir pedidos: ubicación del local y al menos una localidad.
export function coberturaConfigurada(datos: { cantidadZonas: number; latitud?: unknown; longitud?: unknown }) {
  return datos.cantidadZonas > 0 && coordenadasValidas(datos.latitud, datos.longitud)
}

export type Punto = { latitud: number; longitud: number }

export function distanciaEnKm(origen: Punto, destino: Punto) {
  if (!coordenadasValidas(origen.latitud, origen.longitud) || !coordenadasValidas(destino.latitud, destino.longitud)) {
    throw new Error('Coordenadas inválidas para calcular la distancia.')
  }
  const radianes = (grados: number) => grados * Math.PI / 180
  const dLat = radianes(destino.latitud - origen.latitud)
  const dLon = radianes(destino.longitud - origen.longitud)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radianes(origen.latitud)) * Math.cos(radianes(destino.latitud)) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

export function dentroDelRadio(distanciaKm: number, radioKm: number) {
  // Solo tolerancia numérica (una millonésima de metro), sin redondear para aceptar pedidos.
  return Number.isFinite(distanciaKm) && distanciaKm >= 0 && Number.isFinite(radioKm) && distanciaKm <= radioKm + 1e-9
}

export function normalizarLugar(texto: string) {
  const limpio = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return ['caba', 'capital federal', 'ciudad de buenos aires', 'ciudad autonoma de buenos aires'].includes(limpio)
    ? 'ciudad autonoma de buenos aires' : limpio
}

export type ContextoDireccion = { localidad: string; provincia: string }

// Sin una localidad seleccionada, nunca suponemos que el cliente vive en la del local.
export function separarDireccion(direccion: string, contexto?: ContextoDireccion | null) {
  const partes = direccion.split(',').map(p => p.trim())
  if (partes.length === 1 && contexto) return { direccion: partes[0], ...contexto }
  if (partes.length !== 3 || partes.some(p => !p)) return null
  const [calle, localidad, provincia] = partes
  if (contexto && (normalizarLugar(localidad) !== normalizarLugar(contexto.localidad)
    || normalizarLugar(provincia) !== normalizarLugar(contexto.provincia))) return null
  return { direccion: calle, localidad, provincia }
}

// El resto de la app presenta los importes en pesos enteros.
export const MAX_RECARGO_DELIVERY = 10000000
export const MENSAJE_RECARGO_DELIVERY = 'Ingresá un costo de envío entre 0 y 10.000.000 de pesos, sin centavos.'
export function recargoDeliveryValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 && valor <= MAX_RECARGO_DELIVERY
}

// Lo que se le muestra al cliente: la localidad en la que cayó su dirección y el costo.
export type CotizacionDelivery = { localidad: string; recargoDelivery: number }
