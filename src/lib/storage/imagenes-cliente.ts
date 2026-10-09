// Subir y quitar imágenes desde el navegador (logo, foto de perfil y foto de producto).
// Habla con los endpoints de la app, nunca directo con Supabase: la credencial queda en
// el servidor (lib/storage/imagenes.ts, que no se puede importar desde acá).

// Los mismos límites que valida el servidor. Se chequean antes para avisar al toque, sin
// esperar la subida; el servidor igual vuelve a validar.
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp']
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024
export const TEXTO_FORMATOS_IMAGEN = 'PNG, JPG o WebP, hasta 2 MB'

// null si la imagen sirve; si no, el mensaje para mostrar.
export function validarImagen(archivo: File): string | null {
  if (!TIPOS_IMAGEN.includes(archivo.type)) return 'Elegí una imagen PNG, JPG o WebP.'
  if (archivo.size === 0) return 'La imagen está vacía.'
  if (archivo.size > MAX_BYTES_IMAGEN) return 'La imagen no puede superar los 2 MB.'
  return null
}

async function pedir<T>(endpoint: string, init: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(endpoint, { ...init, credentials: 'same-origin' })
  } catch {
    throw new Error('No se pudo conectar con el sistema. Revisá tu conexión e intentá de nuevo.')
  }
  const datos = await respuesta.json().catch(() => ({})) as T & { error?: string }
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar la imagen. Intentá de nuevo.')
  return datos
}

// POST con el archivo en el campo "archivo". Sin Content-Type: lo arma el navegador.
export function subirImagen<T>(endpoint: string, archivo: File): Promise<T> {
  const datos = new FormData()
  datos.append('archivo', archivo)
  return pedir<T>(endpoint, { method: 'POST', body: datos })
}

export function quitarImagen<T>(endpoint: string): Promise<T> {
  return pedir<T>(endpoint, { method: 'DELETE' })
}
