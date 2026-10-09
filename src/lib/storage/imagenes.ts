// Exclusivo del servidor: la credencial se usa en fetch, nunca en las respuestas.
import { randomUUID } from 'node:crypto'

const BUCKET = 'imagenes'
const MAX_ARCHIVO = 2 * 1024 * 1024
const MAX_SOLICITUD = MAX_ARCHIVO + 64 * 1024
type Carpeta = 'logo' | 'avatares' | 'productos'
type GuardarRuta = (esperada: string | null, nueva: string | null) => Promise<boolean>

export class ErrorImagen extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje)
  }
}

function urlSupabase(): string | null {
  try {
    const url = new URL(process.env.SUPABASE_URL ?? '')
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    return url.origin
  } catch {
    return null
  }
}

function configuracion() {
  const url = urlSupabase()
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !clave) throw new ErrorImagen(503, 'Todavía no se configuró el almacenamiento de imágenes.')
  return { url, clave }
}

function rutaValida(ruta: string): boolean {
  return /^(logo|avatares|productos)\/[a-zA-Z0-9_-]+\.(webp|jpe?g|png)$/.test(ruta)
}

export function urlImagenPublica(ruta: string | null): string | null {
  const url = urlSupabase()
  if (!ruta || !url || !rutaValida(ruta)) return null
  return `${url}/storage/v1/object/public/${BUCKET}/${ruta.split('/').map(encodeURIComponent).join('/')}`
}

async function leerArchivo(request: Request) {
  const tipo = request.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data\s*;/i.test(tipo)) {
    throw new ErrorImagen(415, 'Enviá la imagen como multipart/form-data en el campo archivo.')
  }
  if (Number(request.headers.get('content-length')) > MAX_SOLICITUD) {
    throw new ErrorImagen(413, 'La imagen no puede superar los 2 MB.')
  }
  if (!request.body) throw new ErrorImagen(400, 'Seleccioná una imagen.')

  // Se limita también el cuerpo real, aunque no haya Content-Length.
  const lector = request.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await lector.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_SOLICITUD) {
        await lector.cancel()
        throw new ErrorImagen(413, 'La imagen no puede superar los 2 MB.')
      }
      partes.push(value)
    }
  } catch (error) {
    if (error instanceof ErrorImagen) throw error
    throw new ErrorImagen(400, 'No se pudo leer el archivo enviado.')
  } finally {
    lector.releaseLock()
  }
  const cuerpo = new Uint8Array(total)
  let posicion = 0
  for (const parte of partes) {
    cuerpo.set(parte, posicion)
    posicion += parte.byteLength
  }
  let formulario: FormData
  try {
    formulario = await new Response(cuerpo, { headers: { 'Content-Type': tipo } }).formData()
  } catch {
    throw new ErrorImagen(400, 'El formulario del archivo es inválido.')
  }
  const archivos = formulario.getAll('archivo')
  const archivo = archivos[0]
  if (archivos.length !== 1 || !archivo || typeof archivo === 'string') {
    throw new ErrorImagen(400, 'Enviá una sola imagen en el campo archivo.')
  }
  if (archivo.size === 0) throw new ErrorImagen(400, 'La imagen está vacía.')
  if (archivo.size > MAX_ARCHIVO) throw new ErrorImagen(413, 'La imagen no puede superar los 2 MB.')
  const datos = new Uint8Array(await archivo.arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => datos[i] === byte)
  const jpg = datos[0] === 255 && datos[1] === 216 && datos[2] === 255
  const webp = datos.length >= 16 && String.fromCharCode(...datos.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...datos.subarray(8, 12)) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(String.fromCharCode(...datos.subarray(12, 16)))
  const extension = archivo.type === 'image/png' && png ? 'png'
    : archivo.type === 'image/jpeg' && jpg ? 'jpg'
    : archivo.type === 'image/webp' && webp ? 'webp' : null
  if (!extension) throw new ErrorImagen(415, 'El archivo debe ser una imagen WebP, JPG o PNG del formato indicado.')
  return { datos, tipo: archivo.type, extension }
}

async function solicitarStorage(config: ReturnType<typeof configuracion>, ruta: string, opciones: RequestInit) {
  try {
    const respuesta = await fetch(`${config.url}/storage/v1/object/${BUCKET}${ruta}`, {
      ...opciones,
      headers: { ...opciones.headers, apikey: config.clave, Authorization: `Bearer ${config.clave}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    if (!respuesta.ok) throw new ErrorImagen(502, 'No se pudo completar la operación en el almacenamiento de imágenes.')
    // No propagamos el cuerpo del proveedor: podría contener datos internos.
    await respuesta.body?.cancel()
  } catch (error) {
    if (error instanceof ErrorImagen) throw error
    throw new ErrorImagen(502, 'No se pudo conectar con el almacenamiento de imágenes. Intentá nuevamente.')
  }
}

async function eliminarArchivo(config: ReturnType<typeof configuracion>, ruta: string) {
  await solicitarStorage(config, '', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [ruta] }),
  })
}

function validarRutaAnterior(carpeta: Carpeta, ruta: string | null) {
  if (ruta !== null && (!rutaValida(ruta) || !ruta.startsWith(`${carpeta}/`))) {
    throw new ErrorImagen(409, 'La ruta de la imagen guardada es inválida. Revisá el registro antes de reemplazarla.')
  }
}

function conflicto() {
  return new ErrorImagen(409, 'La imagen cambió durante la operación. Actualizá e intentá nuevamente.')
}

async function limpiarArchivo(config: ReturnType<typeof configuracion>, ruta: string) {
  try {
    await eliminarArchivo(config, ruta)
  } catch {
    // Facilita recuperar un archivo huérfano sin registrar la credencial ni el cuerpo de Supabase.
    console.error('No se pudo limpiar una imagen de Storage:', ruta)
    throw new ErrorImagen(502, 'No se completó la operación y quedó un archivo pendiente de limpieza en Storage.')
  }
}

export async function subirImagen(
  request: Request, carpeta: Carpeta, id: number, anterior: string | null, guardar: GuardarRuta,
) {
  validarRutaAnterior(carpeta, anterior)
  const archivo = await leerArchivo(request)
  const config = configuracion()
  const ruta = `${carpeta}/${id}-${randomUUID()}.${archivo.extension}`
  try {
    await solicitarStorage(config, `/${ruta}`, {
      method: 'POST', headers: { 'Content-Type': archivo.tipo, 'Cache-Control': 'max-age=3600', 'x-upsert': 'false' },
      body: new Blob([archivo.datos], { type: archivo.tipo }),
    })
  } catch (error) {
    // Una respuesta perdida puede ocultar una subida exitosa; se intenta quitar ese archivo único.
    await limpiarArchivo(config, ruta)
    throw error
  }
  try {
    if (!await guardar(anterior, ruta)) throw conflicto()
  } catch (error) {
    await limpiarArchivo(config, ruta)
    throw error
  }
  if (anterior) {
    try {
      await eliminarArchivo(config, anterior)
    } catch (error) {
      // Base y Storage son sistemas distintos. Se intenta volver al estado previo.
      let restaurada = false
      try { restaurada = await guardar(ruta, anterior) } catch { /* se informa abajo */ }
      if (!restaurada) {
        throw new ErrorImagen(502, 'No se pudo limpiar la imagen anterior. Consultá el registro y revisá Storage antes de reintentar.')
      }
      await limpiarArchivo(config, ruta)
      throw error
    }
  }
  return { ruta, url: urlImagenPublica(ruta) }
}

export async function quitarImagen(carpeta: Carpeta, anterior: string | null, guardar: GuardarRuta) {
  validarRutaAnterior(carpeta, anterior)
  if (anterior === null) return
  const config = configuracion()
  if (!await guardar(anterior, null)) throw conflicto()
  try {
    await eliminarArchivo(config, anterior)
  } catch (error) {
    let restaurada = false
    try { restaurada = await guardar(null, anterior) } catch { /* se informa abajo */ }
    if (!restaurada) {
      throw new ErrorImagen(502, 'No se completó el borrado. Consultá el registro y revisá Storage antes de reintentar.')
    }
    throw error
  }
}
