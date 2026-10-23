'use client'

import { useEffect, useState } from 'react'
import type { DatosAsistencia } from '@/lib/asistencia/tipos'

export const EVENTO_ASISTENCIA = 'asistencia-actualizada'

export async function pedirAsistencia<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, { cache: 'no-store', ...init })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || !datos) throw new Error(datos?.error ?? 'No se pudo consultar la asistencia. Revisá tu conexión.')
  return datos as T
}

export function useAsistencia(url: string) {
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
        if (vigente) setEstado(previo => ({ url, datos: previo?.url === url ? previo.datos : null, error: error instanceof Error ? error.message : 'No se pudo consultar la asistencia.' }))
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
  }, [url, intento])
  const actual = estado?.url === url ? estado : null
  return { datos: actual?.datos ?? null, error: actual?.error ?? null, cargando: !actual, recargar: () => setIntento(n => n + 1) }
}
