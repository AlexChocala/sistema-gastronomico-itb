'use client'

import { useEffect, useState } from 'react'
import type { DatosAsistencia } from '@/lib/asistencia/tipos'
import { solicitarJson, type OpcionesSolicitud } from '@/lib/utils/solicitud-json'

export const EVENTO_ASISTENCIA = 'asistencia-actualizada'
export const CLAVE_CAMBIO_ASISTENCIA = 'mise-asistencia-actualizada'
export function notificarCambioAsistencia() {
  window.dispatchEvent(new Event(EVENTO_ASISTENCIA))
  try { localStorage.setItem(CLAVE_CAMBIO_ASISTENCIA, `${Date.now()}-${Math.random()}`) } catch { /* El refresco periódico cubre navegadores sin almacenamiento. */ }
}

export function pedirAsistencia<T>(url: string, init?: RequestInit, opciones?: OpcionesSolicitud): Promise<T> {
  return solicitarJson<T>(url, init, { accion: 'consultar la asistencia', ...opciones })
}

// Al paginar la misma ficha, conserva el turno y el horario mientras llega la consulta.
// Nunca reutiliza datos al cambiar de usuario o de endpoint.
export function useAsistencia(url: string, conservarDatos = false) {
  const [estado, setEstado] = useState<{ url: string; datos: DatosAsistencia | null; error: string | null } | null>(null)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    let consultando = false
    const abortar = new AbortController()
    async function consultar() {
      if (!vigente || consultando || document.hidden) return
      consultando = true
      try {
        const datos = await pedirAsistencia<DatosAsistencia>(url, { signal: abortar.signal })
        if (vigente) setEstado({ url, datos, error: null })
      } catch (error) {
        if (vigente) setEstado(previo => ({ url, datos: previo && (previo.url === url || (conservarDatos && previo.url.split('?')[0] === url.split('?')[0])) ? previo.datos : null, error: error instanceof Error ? error.message : 'No se pudo consultar la asistencia.' }))
      } finally { consultando = false }
    }
    void consultar()
    const actualizar = () => void consultar()
    const intervalo = setInterval(actualizar, 30000)
    window.addEventListener('focus', actualizar)
    window.addEventListener(EVENTO_ASISTENCIA, actualizar)
    document.addEventListener('visibilitychange', actualizar)
    return () => {
      vigente = false; abortar.abort(); clearInterval(intervalo)
      window.removeEventListener('focus', actualizar)
      window.removeEventListener(EVENTO_ASISTENCIA, actualizar)
      document.removeEventListener('visibilitychange', actualizar)
    }
  }, [url, intento, conservarDatos])
  const actual = estado?.url === url ? estado : null
  const anteriores = conservarDatos && estado?.url.split('?')[0] === url.split('?')[0] ? estado.datos : null
  return { datos: actual?.datos ?? anteriores, error: actual?.error ?? null, cargando: !actual, recargar: () => setIntento(n => n + 1) }
}
