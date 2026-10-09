// Cliente de Georef, la API abierta del Estado argentino para localidades, calles y
// direcciones normalizadas (https://datosgobar.github.io/georef-ar-api/). Es gratuita y no pide
// clave ni cuenta. Se llama desde el navegador, así que cualquier falla (sin internet,
// servicio caído) tira un error y quien la usa tiene que ofrecer la carga manual.

const BASE = 'https://apis.datos.gob.ar/georef/api'
const TIEMPO_MAXIMO_MS = 6000
const MAXIMO_RESULTADOS = 8

export interface LocalidadGeoref {
  nombre: string
  provincia: string
}

export interface Sugerencia {
  clave: string
  texto: string
}

async function pedir<T>(ruta: string, parametros: Record<string, string>, signal?: AbortSignal): Promise<T> {
  // Un solo controlador: lo corta el que busca (porque tipeó otra letra) o el tiempo máximo.
  const controlador = new AbortController()
  const cancelar = () => controlador.abort()
  signal?.addEventListener('abort', cancelar)
  const temporizador = setTimeout(cancelar, TIEMPO_MAXIMO_MS)
  try {
    const respuesta = await fetch(`${BASE}/${ruta}?${new URLSearchParams(parametros)}`, { signal: controlador.signal })
    if (!respuesta.ok) throw new Error(`Georef respondió ${respuesta.status}`)
    return await respuesta.json() as T
  } finally {
    clearTimeout(temporizador)
    signal?.removeEventListener('abort', cancelar)
  }
}

// "OLAVARRIA" → "Olavarria", "DE LA TORRE" → "De la Torre".
const PALABRAS_CHICAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])
export function aTitulo(texto: string) {
  return texto
    .toLowerCase()
    .split(' ')
    .map((palabra, indice) =>
      indice > 0 && PALABRAS_CHICAS.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ')
}

export async function buscarLocalidades(texto: string, signal?: AbortSignal): Promise<(Sugerencia & LocalidadGeoref)[]> {
  const { localidades } = await pedir<{
    localidades: { nombre: string; provincia: { nombre: string } }[]
  }>('localidades', {
    nombre: texto,
    max: '15',
    orden: 'nombre',
    campos: 'nombre,provincia.nombre',
  }, signal)

  // Georef repite una misma localidad (por ejemplo como "entidad" y como "componente").
  // En la base se identifica por nombre + provincia, así que se muestra una sola vez.
  const vistas = new Set<string>()
  const resultado: (Sugerencia & LocalidadGeoref)[] = []
  for (const { nombre, provincia } of localidades) {
    const clave = `${nombre}|${provincia.nombre}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    resultado.push({ clave, texto: `${nombre}, ${provincia.nombre}`, nombre, provincia: provincia.nombre })
  }
  return resultado.slice(0, MAXIMO_RESULTADOS)
}

// Las calles de Georef cuelgan de la "localidad censal", que no siempre coincide con el
// nombre de la localidad (Munro es una localidad censal de Vicente López). Se resuelve
// una vez por localidad y se recuerda.
const censales = new Map<string, string>()

async function localidadCensal(localidad: LocalidadGeoref, signal?: AbortSignal) {
  const clave = `${localidad.nombre}|${localidad.provincia}`
  const guardada = censales.get(clave)
  if (guardada) return guardada
  const { localidades } = await pedir<{ localidades: { localidad_censal: { nombre: string } }[] }>('localidades', {
    nombre: localidad.nombre,
    provincia: localidad.provincia,
    exacto: 'true',
    max: '1',
    campos: 'localidad_censal.nombre',
  }, signal)
  const censal = localidades[0]?.localidad_censal.nombre ?? localidad.nombre
  censales.set(clave, censal)
  return censal
}

// Sin número busca calles ("olav" → "Olavarria"); con número, direcciones completas
// ("olavarria 65" → "Olavarria 65"). Siempre dentro de la localidad elegida.
export async function buscarDirecciones(
  texto: string,
  localidad: LocalidadGeoref,
  signal?: AbortSignal,
): Promise<Sugerencia[]> {
  const censal = await localidadCensal(localidad, signal)
  const comunes = { provincia: localidad.provincia, localidad_censal: censal, max: '15' }

  if (/\d/.test(texto)) {
    const { direcciones } = await pedir<{
      direcciones: { calle: { nombre: string }; altura: { valor: number | null } }[]
    }>('direcciones', { ...comunes, direccion: texto, campos: 'calle.nombre,altura.valor' }, signal)
    return sinRepetidas(direcciones
      .filter((direccion) => direccion.altura.valor !== null)
      .map((direccion) => `${aTitulo(direccion.calle.nombre)} ${direccion.altura.valor}`))
  }

  const { calles } = await pedir<{ calles: { nombre: string }[] }>('calles', {
    ...comunes, nombre: texto, campos: 'nombre',
  }, signal)
  // Termina en espacio: el cursor queda listo para escribir el número.
  return sinRepetidas(calles.map((calle) => `${aTitulo(calle.nombre)} `))
}

function sinRepetidas(textos: string[]): Sugerencia[] {
  return [...new Set(textos)].slice(0, MAXIMO_RESULTADOS).map((texto) => ({ clave: texto, texto: texto.trim() }))
}
