import { MENSAJES } from './mensajes'

export type TipoErrorSolicitud = 'conexion' | 'tiempo' | 'sesion' | 'permisos' | 'datos' | 'estado' | 'limite' | 'servidor' | 'respuesta' | 'cancelada'
export class ErrorSolicitud extends Error {
  constructor(public tipo: TipoErrorSolicitud, mensaje: string, public estado?: number) {
    super(mensaje)
    this.name = 'ErrorSolicitud'
  }
}
export type OpcionesSolicitud = { accion?: string; tiempoMaximo?: number }

// Solo se muestran detalles públicos de errores esperados, nunca HTML ni errores técnicos 5xx.
function detallePublico(datos: unknown) {
  if (!datos || typeof datos !== 'object' || !('error' in datos) || typeof datos.error !== 'string') return null
  const texto = datos.error.trim()
  return texto && texto.length <= 400 && !/[<>\r\n]/.test(texto) ? texto : null
}

function errorHttp(estado: number, datos: unknown, accion: string) {
  const detalle = detallePublico(datos)
  if (estado === 503 && datos && typeof datos === 'object' && 'codigo' in datos && datos.codigo === 'ASISTENCIA_NO_CONFIGURADA') {
    return new ErrorSolicitud('servidor', 'La asistencia no está disponible por un problema de configuración. Avisale al administrador para que lo revise.', estado)
  }
  if (estado === 401) return new ErrorSolicitud('sesion', 'Tu sesión venció o no está iniciada. Volvé a iniciar sesión para continuar.', estado)
  if (estado === 403) return new ErrorSolicitud('permisos', `No tenés permiso para esta acción. ${detalle ?? 'Consultá al administrador si necesitás acceso.'}`, estado)
  if (estado === 404) return new ErrorSolicitud('permisos', 'No encontramos ese usuario dentro de tus permisos. Volvé al listado de usuarios y revisá la selección.', estado)
  if ([400, 422].includes(estado)) return new ErrorSolicitud('datos', `Revisá los datos ingresados. ${detalle ?? 'Corregí los campos indicados e intentá nuevamente.'}`, estado)
  if (estado === 409) return new ErrorSolicitud('estado', `No pudimos ${accion}. ${detalle ?? 'Los datos cambiaron. Actualizá la ficha y revisá el estado antes de intentar nuevamente.'}`, estado)
  if (estado === 429) return new ErrorSolicitud('limite', 'Hay demasiadas solicitudes. Esperá unos momentos antes de intentar nuevamente.', estado)
  if (estado === 408 || estado === 504) return new ErrorSolicitud('tiempo', 'El sistema tardó demasiado en responder. Actualizá la ficha para comprobar el resultado antes de reintentar.', estado)
  if (estado === 415) return new ErrorSolicitud('datos', 'La información no se pudo enviar correctamente. Actualizá la página e intentá nuevamente.', estado)
  return new ErrorSolicitud('servidor', `El sistema no pudo ${accion} en este momento. Intentá de nuevo en unos minutos. Si sigue ocurriendo, avisale al administrador.`, estado)
}

export function mensajeErrorSolicitud(error: unknown, alternativa: string = MENSAJES.panel.errorGenerico) {
  return error instanceof ErrorSolicitud ? error.message : alternativa
}

export async function solicitarJson<T>(url: string, init: RequestInit = {}, { accion = 'completar la operación', tiempoMaximo = 15000 }: OpcionesSolicitud = {}): Promise<T> {
  const control = new AbortController()
  let tiempoAgotado = false
  const cancelar = () => control.abort(init.signal?.reason)
  if (init.signal?.aborted) cancelar()
  else init.signal?.addEventListener('abort', cancelar, { once: true })
  const espera = setTimeout(() => { tiempoAgotado = true; control.abort() }, tiempoMaximo)
  const escritura = !['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())
  const comprobar = escritura ? ' Actualizá la ficha para comprobar si la operación quedó registrada antes de repetirla.' : ''
  try {
    const respuesta = await fetch(url, { cache: 'no-store', ...init, signal: control.signal })
    if (respuesta.redirected && /\/acceso\/login(?:[/?#]|$)/.test(respuesta.url)) throw errorHttp(401, null, accion)
    let datos: unknown
    try { datos = await respuesta.json() }
    catch (error) {
      if (control.signal.aborted || error instanceof TypeError) throw error
      if (!respuesta.ok) throw errorHttp(respuesta.status, null, accion)
      throw new ErrorSolicitud('respuesta', `El sistema devolvió una respuesta que no pudimos leer. Actualizá la ficha; si sigue ocurriendo, avisale al administrador.${comprobar}`)
    }
    if (!respuesta.ok) throw errorHttp(respuesta.status, datos, accion)
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new ErrorSolicitud('respuesta', `El sistema devolvió una respuesta incompleta.${comprobar || ' Actualizá la ficha e intentá nuevamente.'}`)
    return datos as T
  } catch (error) {
    if (error instanceof ErrorSolicitud) throw error
    if (tiempoAgotado || init.signal?.reason?.name === 'TimeoutError') throw new ErrorSolicitud('tiempo', `Se agotó el tiempo de espera para ${accion}. Revisá tu conexión.${comprobar || ' Intentá nuevamente.'}`)
    if (init.signal?.aborted) throw new ErrorSolicitud('cancelada', 'La consulta se canceló.')
    throw new ErrorSolicitud('conexion', `Problema de conexión. No pudimos ${accion}. Revisá tu conexión.${comprobar || ' Intentá nuevamente.'}`)
  } finally {
    clearTimeout(espera)
    init.signal?.removeEventListener('abort', cancelar)
  }
}
