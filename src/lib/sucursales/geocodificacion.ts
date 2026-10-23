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
    // Las direcciones vienen con la localidad censal, que puede tener otro nombre: "Lanús Este"
    // está dentro de la localidad censal "Lanús". Se acepta la misma localidad censal que
    // corresponde a la localidad elegida (con ella se filtró la consulta).
    && (normalizarLugar(d.localidad?.nombre ?? '') === localidad
      || d.localidad_censal?.id === referencia.localidad_censal!.id
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

type Division = { id: string; nombre: string }
export type UbicacionGeoref = { provincia: Division; departamento: Division | null }

function division(valor: unknown): Division | null {
  const d = valor as Lugar | undefined
  return typeof d?.id === 'string' && typeof d?.nombre === 'string' ? { id: d.id, nombre: d.nombre } : null
}

// Provincia y partido (departamento) de un punto. El del local se guarda en memoria: no se
// mueve, y así no se consulta en cada letra que escribe el cliente.
const ubicacionesDeLocales = new Map<string, UbicacionGeoref>()

export async function ubicarPunto(punto: Punto, recordar = false): Promise<UbicacionGeoref> {
  const clave = `${punto.latitud},${punto.longitud}`
  const guardada = ubicacionesDeLocales.get(clave)
  if (guardada) return guardada
  const datos = await pedir('ubicacion', { lat: String(punto.latitud), lon: String(punto.longitud) })
  const ubicacion = datos.ubicacion as { provincia?: unknown; departamento?: unknown } | undefined
  const provincia = division(ubicacion?.provincia)
  if (!provincia) throw new ErrorSucursal(400, 'Esa dirección no está dentro de Argentina.')
  const resultado = { provincia, departamento: division(ubicacion?.departamento) }
  if (recordar) ubicacionesDeLocales.set(clave, resultado)
  return resultado
}

type LocalidadGeoref = Punto & { nombre: string; provincia: Division; departamento: Division | null }

// Localidades de una provincia con su centro. Cambian muy poco: se guardan un día en memoria.
const DURACION_LOCALIDADES_MS = 24 * 60 * 60 * 1000
const localidadesPorProvincia = new Map<string, { vence: number; lista: LocalidadGeoref[] }>()

async function localidadesDeProvincia(idProvincia: string): Promise<LocalidadGeoref[]> {
  const guardadas = localidadesPorProvincia.get(idProvincia)
  if (guardadas && guardadas.vence > Date.now()) return guardadas.lista
  const datos = await pedir('localidades', { provincia: idProvincia, max: '5000' })
  const lista: LocalidadGeoref[] = []
  for (const l of (Array.isArray(datos.localidades) ? datos.localidades : []) as Record<string, unknown>[]) {
    const centro = l?.centroide as { lat?: unknown; lon?: unknown } | undefined
    const provincia = division(l?.provincia)
    if (typeof l?.nombre !== 'string' || !provincia || !coordenadasValidas(centro?.lat, centro?.lon)) continue
    lista.push({
      nombre: l.nombre, provincia, departamento: division(l.departamento),
      latitud: centro!.lat as number, longitud: centro!.lon as number,
    })
  }
  localidadesPorProvincia.set(idProvincia, { vence: Date.now() + DURACION_LOCALIDADES_MS, lista })
  return lista
}

// En el AMBA se listan las dos (Capital y Provincia), así el admin ve, por ejemplo, que
// Barracas queda cerca de Avellaneda y decide si entrega o no.
function provinciasVecinas(idProvincia: string) {
  return PROVINCIAS_AMBA.includes(idProvincia) ? PROVINCIAS_AMBA : [idProvincia]
}

export type LocalidadCercana = { nombre: string; provincia: string; partido: string | null; distanciaKm: number }

// Localidades alrededor del local, de la más cercana a la más lejana (por su centro).
export async function localidadesCercanas(local: Punto, maximoKm = 15, limite = 60): Promise<LocalidadCercana[]> {
  const ubicacion = await ubicarPunto(local, true)
  const listas = await Promise.all(provinciasVecinas(ubicacion.provincia.id).map(localidadesDeProvincia))
  const vistas = new Set<string>()
  return listas.flat()
    .map((l) => ({ nombre: l.nombre, provincia: l.provincia.nombre, partido: l.departamento?.nombre ?? null, distanciaKm: distanciaEnKm(local, l) }))
    .filter((l) => l.distanciaKm <= maximoKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .filter((l) => {
      const clave = `${normalizarLugar(l.nombre)}|${normalizarLugar(l.provincia)}`
      return !vistas.has(clave) && vistas.add(clave)
    })
    .slice(0, limite)
}

// Localidad en la que cae un punto: la de centro más cercano dentro del mismo partido (el
// partido y la provincia son exactos; dentro del partido, la localidad es aproximada).
export async function localidadDelPunto(punto: Punto): Promise<{ nombre: string; provincia: string } | null> {
  const ubicacion = await ubicarPunto(punto)
  const lista = await localidadesDeProvincia(ubicacion.provincia.id)
  const delPartido = ubicacion.departamento ? lista.filter((l) => l.departamento?.id === ubicacion.departamento!.id) : []
  const candidatas = delPartido.length ? delPartido : lista
  let masCercana: LocalidadGeoref | null = null
  let menor = Infinity
  for (const l of candidatas) {
    const km = distanciaEnKm(punto, l)
    if (km < menor) { menor = km; masCercana = l }
  }
  return masCercana ? { nombre: masCercana.nombre, provincia: ubicacion.provincia.nombre } : null
}

// Direcciones de Georef que se parecen a lo que el cliente va escribiendo. Devuelve el
// texto en el formato que acepta separarDireccion ("Calle 123, Localidad, Provincia").
// Si Georef falla devuelve una lista vacía: el campo sigue funcionando sin sugerencias.
//
// Georef devuelve como mucho una parte de las coincidencias de toda la provincia, y una
// calle como "Mitre" existe en casi todos los partidos: la del barrio del local puede no
// venir. Por eso se busca primero en el partido del local y después en la provincia (y en
// el AMBA, también en la otra). Quien llama ordena por distancia y filtra por cobertura.
export async function buscarDireccionesParecidas(
  texto: string, provinciaSucursal: string, local: Punto,
): Promise<DireccionEncontrada[]> {
  if (!/^.{2,}\s+\d{1,6}$/.test(texto.trim())) return []
  const provincia = normalizarLugar(provinciaSucursal)
  const provincias = ['buenos aires', 'ciudad autonoma de buenos aires'].includes(provincia) ? PROVINCIAS_AMBA : [provinciaSucursal]
  const partido = await ubicarPunto(local, true).catch(() => null)
  const consultas: Record<string, string>[] = [
    ...(partido?.departamento ? [{ provincia: partido.provincia.id, departamento: partido.departamento.id, max: '50' }] : []),
    ...provincias.map((p) => ({ provincia: p, max: '100' })),
  ]
  const respuestas = await Promise.all(consultas.map((filtros) =>
    pedir('direcciones', { direccion: texto.trim(), ...filtros }).catch(() => null)))
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
