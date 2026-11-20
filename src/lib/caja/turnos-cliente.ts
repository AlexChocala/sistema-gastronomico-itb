'use client'

// Estado de las cajas en las pantallas: qué caja se usa en este equipo y si tiene turno
// abierto. La caja elegida se recuerda en el navegador (cada equipo suele usar siempre la misma).

import { useCallback, useEffect, useState } from 'react'
import type { CajaConTurno, ResumenCierre } from './turnos'

export type { CajaConTurno, ResumenCierre }

const CLAVE_CAJA = 'caja-elegida'
const MENSAJE_RED = 'No se pudo conectar con el servidor. Revisá la conexión e intentá de nuevo.'

async function pedir<T>(url: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      cache: 'no-store',
      ...(cuerpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
    })
  } catch {
    throw new Error(MENSAJE_RED)
  }
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || datos === null) throw new Error(typeof datos?.error === 'string' ? datos.error : MENSAJE_RED)
  return datos as T
}

function leerCajaGuardada() {
  try {
    const valor = Number(window.localStorage.getItem(CLAVE_CAJA))
    return Number.isInteger(valor) && valor > 0 ? valor : null
  } catch {
    return null
  }
}

export function useTurnoCaja() {
  const [cajas, setCajas] = useState<CajaConTurno[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elegida, setElegida] = useState<number | null>(null)
  const [porCobrar, setPorCobrar] = useState(0)

  const recargar = useCallback(async () => {
    try {
      const datos = await pedir<{ cajas: CajaConTurno[]; porCobrar?: number }>('/api/caja/turno')
      setCajas(datos.cajas)
      setPorCobrar(datos.porCobrar ?? 0)
      // La caja que se usa en este equipo se lee del navegador recién con la respuesta.
      setElegida((actual) => actual ?? leerCajaGuardada())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : MENSAJE_RED)
    } finally {
      setCargando(false)
    }
  }, [])

  // Primera carga: la respuesta llega en una promesa (no se llama a setState dentro del efecto).
  useEffect(() => {
    let activo = true
    pedir<{ cajas: CajaConTurno[]; porCobrar?: number }>('/api/caja/turno')
      .then((datos) => {
        if (!activo) return
        setCajas(datos.cajas)
        setPorCobrar(datos.porCobrar ?? 0)
        setElegida((actual) => actual ?? leerCajaGuardada())
        setError(null)
      })
      .catch((e) => activo && setError(e instanceof Error ? e.message : MENSAJE_RED))
      .finally(() => activo && setCargando(false))
    return () => { activo = false }
  }, [])

  // La caja de este equipo: la guardada si sigue existiendo; si no, la primera.
  const caja = cajas.find((c) => c.idCaja === elegida) ?? cajas[0] ?? null

  function elegirCaja(idCaja: number) {
    setElegida(idCaja)
    try { window.localStorage.setItem(CLAVE_CAJA, String(idCaja)) } catch { /* sin almacenamiento: solo no se recuerda */ }
  }

  async function abrir(montoInicial: number, pin: string) {
    if (!caja) throw new Error('No hay una caja para abrir.')
    const datos = await pedir<{ cajas: CajaConTurno[] }>('/api/caja/turno/abrir', { idCaja: caja.idCaja, montoInicial, pin })
    setCajas(datos.cajas)
  }

  async function cerrar(efectivoContado: number, pin: string, observacion?: string) {
    if (!caja) throw new Error('No hay una caja para cerrar.')
    const datos = await pedir<{ resumen: ResumenCierre; cajas: CajaConTurno[] }>('/api/caja/turno/cerrar', {
      idCaja: caja.idCaja, efectivoContado, pin, ...(observacion ? { observacion } : {}),
    })
    // Las cajas se recargan al cerrar el resumen (onSalir), para que el resumen no desaparezca.
    return datos.resumen
  }

  return { cajas, caja, turno: caja?.turno ?? null, porCobrar, cargando, error, elegirCaja, abrir, cerrar, recargar }
}

// ¿El local está abierto? Hay al menos una caja con turno abierto. null mientras carga. Una
// sucursal sin cajas no se considera cerrada (no hay con qué medirlo). Se actualiza solo.
export function useLocalAbierto() {
  const [abierto, setAbierto] = useState<boolean | null>(null)
  useEffect(() => {
    let activo = true
    const consultar = () => pedir<{ cajas: CajaConTurno[] }>('/api/caja/turno')
      .then((datos) => activo && setAbierto(datos.cajas.length === 0 || datos.cajas.some((c) => c.turno !== null)))
      .catch(() => { /* si falla, se deja lo último: no se cierra la pantalla por un corte de red */ })
    void consultar()
    const temporizador = setInterval(() => void consultar(), 30_000)
    return () => { activo = false; clearInterval(temporizador) }
  }, [])
  return abierto
}
