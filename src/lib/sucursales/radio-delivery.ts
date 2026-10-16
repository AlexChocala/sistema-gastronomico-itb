// Reglas compartidas por formularios y servidor. El radio mide distancia en línea recta.
export const MIN_RADIO_DELIVERY_KM = 0.1
export const MAX_RADIO_DELIVERY_KM = 100
export const MENSAJE_RADIO_DELIVERY = 'Indicá un radio de delivery entre 0,1 y 100 km, con hasta un decimal.'
export const MENSAJE_DIRECCION_COMPLETA = 'Ingresá calle y número, localidad y provincia, separados por comas. Ej: Olavarría 65, Avellaneda, Buenos Aires.'

export function radioDeliveryValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
    && valor >= MIN_RADIO_DELIVERY_KM && valor <= MAX_RADIO_DELIVERY_KM
    && Math.abs(valor * 10 - Math.round(valor * 10)) < 1e-8
}

export function coordenadasValidas(latitud: unknown, longitud: unknown) {
  return typeof latitud === 'number' && Number.isFinite(latitud) && latitud >= -90 && latitud <= 90
    && typeof longitud === 'number' && Number.isFinite(longitud) && longitud >= -180 && longitud <= 180
}

export function coberturaConfigurada(datos: { radioDeliveryKm?: unknown; latitud?: unknown; longitud?: unknown }):
  datos is { radioDeliveryKm: number; latitud: number; longitud: number } {
  return radioDeliveryValido(datos.radioDeliveryKm) && coordenadasValidas(datos.latitud, datos.longitud)
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
  return Number.isFinite(distanciaKm) && distanciaKm >= 0 && radioDeliveryValido(radioKm) && distanciaKm <= radioKm + 1e-9
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
