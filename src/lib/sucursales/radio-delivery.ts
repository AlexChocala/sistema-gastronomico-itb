// Reglas compartidas por formularios y servidor. Las distancias se miden en línea recta
// desde la ubicación del local (latitud/longitud de la sucursal).
//
// El costo del envío se configura por tramos de distancia, de menor a mayor:
//   [{ hastaKm: 2, costo: 0 }, { hastaKm: 5, costo: 1000 }, { hastaKm: 8, costo: 1500 }]
// = hasta 2 km gratis, hasta 5 km $1000, hasta 8 km $1500 y más lejos no hay delivery.
export const MIN_KM_TRAMO = 0.1
export const MAX_KM_TRAMO = 100
export const MAX_TRAMOS = 10
export const MENSAJE_DIRECCION_COMPLETA = 'Ingresá calle y número, localidad y provincia, separados por comas. Ej: Olavarría 65, Avellaneda, Buenos Aires.'
export const MENSAJE_TRAMOS = `Cargá al menos un tramo de envío (hasta ${MAX_TRAMOS}). Cada uno con una distancia de 0,1 a 100 km, sin repetir, y un costo en pesos sin centavos.`

export type TramoDelivery = { hastaKm: number; costo: number }

export function kmTramoValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
    && valor >= MIN_KM_TRAMO && valor <= MAX_KM_TRAMO
    && Math.abs(valor * 10 - Math.round(valor * 10)) < 1e-8
}

// Devuelve los tramos ordenados por distancia, o null si la lista no es válida
// (vacía, más de MAX_TRAMOS, distancias repetidas o algún valor fuera de rango).
export function leerTramos(valor: unknown): TramoDelivery[] | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > MAX_TRAMOS) return null
  const tramos: TramoDelivery[] = []
  for (const tramo of valor) {
    if (typeof tramo !== 'object' || tramo === null || Array.isArray(tramo)) return null
    const { hastaKm, costo, ...otros } = tramo as Record<string, unknown>
    if (Object.keys(otros).length > 0 || !kmTramoValido(hastaKm) || !recargoDeliveryValido(costo)) return null
    tramos.push({ hastaKm, costo })
  }
  tramos.sort((a, b) => a.hastaKm - b.hastaKm)
  if (tramos.some((tramo, i) => i > 0 && tramo.hastaKm === tramos[i - 1].hastaKm)) return null
  return tramos
}

export function distanciaMaxima(tramos: TramoDelivery[]) {
  return tramos[tramos.length - 1].hastaKm
}

export function mensajeFueraDeCobertura(distanciaKm: number, maximoKm: number) {
  const formato = (km: number) => km.toLocaleString('es-AR', { maximumFractionDigits: 1 })
  return `No llegamos a esa dirección: está a ${formato(distanciaKm)} km del local y entregamos hasta ${formato(maximoKm)} km.`
}

export function coordenadasValidas(latitud: unknown, longitud: unknown) {
  return typeof latitud === 'number' && Number.isFinite(latitud) && latitud >= -90 && latitud <= 90
    && typeof longitud === 'number' && Number.isFinite(longitud) && longitud >= -180 && longitud <= 180
}

export function coberturaConfigurada(datos: { tramosDelivery?: unknown; latitud?: unknown; longitud?: unknown }) {
  return leerTramos(datos.tramosDelivery) !== null && coordenadasValidas(datos.latitud, datos.longitud)
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
  return Number.isFinite(distanciaKm) && distanciaKm >= 0 && kmTramoValido(radioKm) && distanciaKm <= radioKm + 1e-9
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

export type CotizacionDelivery = { distanciaKm: number; recargoDelivery: number }

// Costo del primer tramo que alcanza la distancia. Más lejos que el último tramo no se
// cotiza (quien llama muestra mensajeFueraDeCobertura antes de llegar acá).
export function cotizarDistancia(distanciaKm: number, tramos: TramoDelivery[]): CotizacionDelivery {
  const ordenados = leerTramos(tramos)
  if (!Number.isFinite(distanciaKm) || distanciaKm < 0 || !ordenados) throw new Error('Distancia o tramos inválidos.')
  const tramo = ordenados.find((t) => dentroDelRadio(distanciaKm, t.hastaKm))
  if (!tramo) throw new Error('Dirección fuera de la distancia máxima de entrega.')
  return { distanciaKm, recargoDelivery: tramo.costo }
}
