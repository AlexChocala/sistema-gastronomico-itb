'use client'

// Links de acceso de las pantallas de una sucursal (solo el administrador). Cada equipo
// (la tablet de Cocina, la pantalla del mostrador) se enlaza una vez abriendo su link y desde
// ahí funciona sin iniciar sesión. El link se ve una sola vez; si se pierde, se genera otro y
// se revoca el anterior.

import { useCallback, useEffect, useState } from 'react'
import { Copy, X } from '@/components/icons'

type Tipo = 'cocina' | 'mostrador'
type Acceso = { idAcceso: number; tipo: Tipo; creadoEn: string }

const PANTALLAS: { tipo: Tipo; texto: string }[] = [
  { tipo: 'cocina', texto: 'Cocina' },
  { tipo: 'mostrador', texto: 'Pantalla del cliente' },
]

const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

export function AccesosPantallas({ idSucursal, nombre, onCerrar }: { idSucursal: number; nombre: string; onCerrar: () => void }) {
  const [accesos, setAccesos] = useState<Acceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Link recién generado (se muestra una sola vez).
  const [nuevo, setNuevo] = useState<{ tipo: Tipo; link: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const url = `/api/sucursales/${idSucursal}/accesos`

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(url, { cache: 'no-store' })
      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(datos?.error ?? 'No se pudieron cargar los accesos.')
      setAccesos(datos.accesos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los accesos.')
    } finally {
      setCargando(false)
    }
  }, [url])

  useEffect(() => {
    let activo = true
    fetch(url, { cache: 'no-store' })
      .then(async (respuesta) => {
        const datos = await respuesta.json()
        if (!respuesta.ok) throw new Error(datos?.error ?? 'No se pudieron cargar los accesos.')
        if (activo) setAccesos(datos.accesos)
      })
      .catch((e) => activo && setError(e instanceof Error ? e.message : 'No se pudieron cargar los accesos.'))
      .finally(() => activo && setCargando(false))
    return () => { activo = false }
  }, [url])

  async function llamar(metodo: 'POST' | 'DELETE', cuerpo: object) {
    setOcupado(true)
    setError('')
    try {
      const respuesta = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const datos = await respuesta.json().catch(() => null)
      if (!respuesta.ok) throw new Error(datos?.error ?? 'No se pudo completar.')
      return datos
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.')
      return null
    } finally {
      setOcupado(false)
    }
  }

  async function generar(tipo: Tipo) {
    const datos = await llamar('POST', { tipo })
    if (!datos) return
    setCopiado(false)
    setNuevo({ tipo, link: datos.link })
    await cargar()
  }

  async function revocar(idAcceso: number) {
    if (await llamar('DELETE', { idAcceso })) await cargar()
  }

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
    } catch {
      setError('No se pudo copiar. Seleccioná el link y copialo a mano.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-overlay p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-accesos" className="m-auto flex w-full max-w-lg flex-col gap-5 rounded-3xl bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-accesos" className="text-lg font-semibold">Pantallas</h2>
            <p className="text-sm text-muted">{nombre}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer rounded-full p-2 text-muted hover:bg-bg hover:text-text">
            <X className="size-4" />
          </button>
        </div>

        {cargando ? (
          <p className="text-center text-muted">Cargando…</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {PANTALLAS.map(({ tipo, texto }) => {
              const delTipo = accesos.filter((acceso) => acceso.tipo === tipo)
              return (
                <li key={tipo} className="flex flex-col gap-2 rounded-2xl bg-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{texto}</span>
                    <button
                      type="button"
                      onClick={() => void generar(tipo)}
                      disabled={ocupado}
                      className="cursor-pointer rounded-full bg-brand px-4 py-1.5 text-sm text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Generar link
                    </button>
                  </div>
                  {delTipo.map((acceso) => (
                    <p key={acceso.idAcceso} className="flex items-center justify-between gap-3 text-sm text-muted">
                      <span>Enlazada el {formatoFecha.format(new Date(acceso.creadoEn))}</span>
                      <button type="button" onClick={() => void revocar(acceso.idAcceso)} disabled={ocupado} className="cursor-pointer text-danger hover:underline disabled:opacity-50">
                        Revocar
                      </button>
                    </p>
                  ))}
                  {nuevo?.tipo === tipo && (
                    <div className="flex items-center gap-2 rounded-2xl bg-surface p-2 pl-4">
                      <input readOnly value={nuevo.link} aria-label={`Link de ${texto}`} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                      <button type="button" onClick={() => void copiar(nuevo.link)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-bg">
                        <Copy className="size-4" />
                        {copiado ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {nuevo && <p className="text-xs text-muted">Abrí el link en el equipo de la pantalla. Se ve una sola vez.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
