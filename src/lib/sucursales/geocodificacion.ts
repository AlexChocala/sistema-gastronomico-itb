// Solo servidor. No se usan coordenadas enviadas por el cliente para aceptar un delivery.
import { ErrorSucursal } from './sucursales-validacion'
import { coordenadasValidas, distanciaEnKm, normalizarLugar, type ContextoDireccion, type Punto } from './radio-delivery'

const BASE = 'https://apis.datos.gob.ar/georef/api/v2.0'
const MAX_RESULTADOS = 1000
type Lugar = { id?: string | null; nombre?: string | null }
type DireccionGeoref = {
  calle?: Lugar; altura?: { valor?: number | null }; localidad?: Lugar; localidad_censal?: Lugar
  provincia?: Lugar; ubicacion?: { lat?: number | null; lon?: number | null }
}

async function pedir(recurso: string, parametros: Record<string, string>): Promise<Record<string, unknown>> {
  try {
    const respuesta = await fetch(`${BASE}/${recurso}?${new URLSearchParams(parametros)}`, {
      signal: AbortSignal.timeout(6000), cache: 'no-store', redirect: 'error',
    })
    if (!respuesta.ok) throw new Error('Georef no disponible')
    const datos: unknown = await respuesta.json()
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Respuesta inválida')
    return datos as Record<string, unknown>
  } catch {
    throw new ErrorSucursal(503, 'No pudimos verificar la ubicación en este momento. Intentá nuevamente en unos minutos.')
  }
}

function calleNormalizada(nombre: string) {
  return normalizarLugar(nombre).replace(/^c\s+\d+\s+/, '').replace(/^(avenida|av|calle|bv|boulevard)\s+/, '')
}

export async function geocodificarDireccion(direccion: string, contexto: ContextoDireccion): Promise<Punto> {
  // Las indicaciones y el piso/departamento se cargan en el campo de referencias.
  const partes = /^(.+?)\s+(\d{1,6})$/.exec(direccion.trim())
  const errorDireccion = () => new ErrorSucursal(400, 'No pudimos ubicar esa dirección con precisión. Revisá calle, número, localidad y provincia; usá el nombre completo de la calle.')
  if (!partes) throw errorDireccion()
  const calle = calleNormalizada(partes[1])
  const altura = Number(partes[2])
  const localidad = normalizarLugar(contexto.localidad)
  const provincia = normalizarLugar(contexto.provincia)
  const datosLocalidad = await pedir('localidades', {
    nombre: contexto.localidad, provincia: provincia === normalizarLugar('CABA') ? '02' : contexto.provincia, exacto: 'true', max: '20',
  })
  const localidades = (Array.isArray(datosLocalidad.localidades) ? datosLocalidad.localidades : []) as
    { nombre: string; provincia?: Lugar; localidad_censal?: Lugar }[]
  const coinciden = localidades.filter(l => l && typeof l.nombre === 'string' && normalizarLugar(l.nombre) === localidad
    && typeof l.provincia?.nombre === 'string' && normalizarLugar(l.provincia.nombre) === provincia)
  const identificadores = new Set(coinciden.map(l => `${l.provincia?.id}|${l.localidad_censal?.id}`))
  if (identificadores.size !== 1 || !coinciden[0]?.provincia?.id || !coinciden[0]?.localidad_censal?.id) throw errorDireccion()
  const referencia = coinciden[0]
  const datos = await pedir('direcciones', {
    direccion, provincia: referencia.provincia!.id!, localidad_censal: referencia.localidad_censal!.id!, max: String(MAX_RESULTADOS),
  })
  if (!Array.isArray(datos.direcciones) || !Number.isSafeInteger(datos.total) || Number(datos.total) < 0 || Number(datos.total) > MAX_RESULTADOS) throw errorDireccion()
  const candidatas = (datos.direcciones as DireccionGeoref[]).filter(d =>
    d && typeof d.calle?.id === 'string' && typeof d.calle?.nombre === 'string' && calleNormalizada(d.calle.nombre) === calle
    && Number(d.altura?.valor) === altura && d.altura?.valor !== null && d.altura?.valor !== undefined
    && d.provincia?.id === referencia.provincia!.id
    && (normalizarLugar(d.localidad?.nombre ?? '') === localidad
      || (!d.localidad?.nombre && normalizarLugar(d.localidad_censal?.nombre ?? '') === localidad)))
  if (!candidatas.length || new Set(candidatas.map(d => d.calle?.id)).size !== 1
    || candidatas.some(d => !coordenadasValidas(d.ubicacion?.lat, d.ubicacion?.lon))) throw errorDireccion()
  const puntos = candidatas.map(d => ({ latitud: d.ubicacion!.lat!, longitud: d.ubicacion!.lon! }))
  // Georef puede duplicar un tramo a ambos lados de la calle. Solo se agrupan puntos
  // cercanos de la misma calle y altura; nunca se elige una ciudad o calle arbitraria.
  if (puntos.some((p, i) => puntos.slice(i + 1).some(otro => distanciaEnKm(p, otro) > 0.1))) throw errorDireccion()
  return {
    latitud: puntos.reduce((s, p) => s + p.latitud, 0) / puntos.length,
    longitud: puntos.reduce((s, p) => s + p.longitud, 0) / puntos.length,
  }
}

// "AV SANTA FE" → "Av Santa Fe". Solo es para mostrar: al cotizar se compara normalizado.
function nombrePropio(texto: string) {
  return texto.toLowerCase().replace(/(^|[\s.'(-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toUpperCase())
}

// En el AMBA es común entregar de un lado al otro de la General Paz: se busca en las dos.
const PROVINCIAS_AMBA = ['02', '06']

export type DireccionEncontrada = Punto & { direccion: string }

// Direcciones de Georef que se parecen a lo que el cliente va escribiendo. Devuelve el
// texto en el formato que acepta separarDireccion ("Calle 123, Localidad, Provincia").
// Si Georef falla devuelve una lista vacía: el campo sigue funcionando sin sugerencias.
export async function buscarDireccionesParecidas(texto: string, provinciaSucursal: string): Promise<DireccionEncontrada[]> {
  if (!/^.{2,}\s+\d{1,6}$/.test(texto.trim())) return []
  const provincia = normalizarLugar(provinciaSucursal)
  const provincias = ['buenos aires', 'ciudad autonoma de buenos aires'].includes(provincia) ? PROVINCIAS_AMBA : [provinciaSucursal]
  const respuestas = await Promise.all(provincias.map((p) =>
    pedir('direcciones', { direccion: texto.trim(), provincia: p, max: '30' }).catch(() => null)))
  const encontradas: DireccionEncontrada[] = []
  for (const datos of respuestas) {
    if (!datos || !Array.isArray(datos.direcciones)) continue
    for (const d of datos.direcciones as DireccionGeoref[]) {
      const calle = d?.calle?.nombre
      const altura = d?.altura?.valor
      const localidad = d?.localidad?.nombre || d?.localidad_censal?.nombre
      const nombreProvincia = d?.provincia?.nombre
      if (typeof calle !== 'string' || !Number.isSafeInteger(altura) || typeof localidad !== 'string'
        || typeof nombreProvincia !== 'string' || !coordenadasValidas(d.ubicacion?.lat, d.ubicacion?.lon)) continue
      if ([calle, localidad, nombreProvincia].some((parte) => parte.includes(','))) continue
      encontradas.push({
        direccion: `${nombrePropio(calle)} ${altura}, ${localidad}, ${nombreProvincia}`,
        latitud: d.ubicacion!.lat!, longitud: d.ubicacion!.lon!,
      })
    }
  }
  return encontradas
}
