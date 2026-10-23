'use client'

// A qué localidades hace delivery la sucursal y cuánto cobra el envío en cada una. La lista
// de localidades cercanas al local sale sola de Georef (ver /api/sucursales/localidades-cercanas)
// apenas están la localidad y la dirección del local: el admin solo tilda y pone el precio.
// Las que ya tenía guardadas se muestran siempre, aunque no vengan en la lista. Para llegar a
// una más lejana se la busca por nombre y se elige de las sugerencias (no se escribe libre:
// tiene que coincidir con la localidad que Georef le asigna a la dirección del cliente).

import { useEffect, useRef, useState } from 'react'
import { CampoConSugerencias } from '@/components/ui/CampoConSugerencias'
import { buscarLocalidades } from '@/lib/sucursales/georef'
import { MAX_RECARGO_DELIVERY, claveLugar, normalizarLugar, type ZonaDelivery } from '@/lib/sucursales/radio-delivery'

export interface ZonaFormulario {
  nombre: string
  provincia: string
  // Partido (o comuna, en Capital) para distinguir localidades. Null si no se sabe.
  partido: string | null
  costo: string
  elegida: boolean
}

// Para mandar a la API: solo las tildadas. Un costo vacío viaja como inválido (no como 0),
// así el servidor avisa en vez de dejar el envío gratis sin querer.
export function zonasParaEnviar(zonas: ZonaFormulario[]): ZonaDelivery[] {
  return zonas
    .filter((z) => z.elegida)
    .map((z) => ({ nombre: z.nombre, provincia: z.provincia, costo: z.costo.trim() === '' ? Number.NaN : Number(z.costo) }))
}

export function zonasParaEditar(filas: { costoEnvio: number; localidad: { nombre: string; provincia: { nombre: string } } }[]): ZonaFormulario[] {
  return filas.map((z) => ({
    nombre: z.localidad.nombre, provincia: z.localidad.provincia.nombre, partido: null, costo: String(z.costoEnvio), elegida: true,
  }))
}

type LocalidadCercana = { nombre: string; provincia: string; partido: string | null }
export type ConsultaCercanas = { direccion: string; localidad: string; provincia: string; latitud: string; longitud: string }

const claseCosto = 'w-28 shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-danger'

export function ZonasDelivery({ idPrefijo, zonas, consulta, onCambiar }: {
  idPrefijo: string
  zonas: ZonaFormulario[]
  // Null mientras falten la localidad o la dirección del local.
  consulta: ConsultaCercanas | null
  onCambiar: (zonas: ZonaFormulario[]) => void
}) {
  const [estadoBusqueda, setEstado] = useState<'buscando' | 'listo' | 'error'>('listo')
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [avisoBusqueda, setAvisoBusqueda] = useState('')
  // La última lista y el último onCambiar, para mezclar el resultado sin volver a buscar.
  const zonasActuales = useRef(zonas)
  const cambiar = useRef(onCambiar)
  useEffect(() => {
    zonasActuales.current = zonas
    cambiar.current = onCambiar
  })

  const clave = consulta ? JSON.stringify(consulta) : ''
  // Sin localidad y dirección del local no hay nada que buscar.
  const estado = clave ? estadoBusqueda : 'esperando'
  useEffect(() => {
    if (!clave) return
    const controlador = new AbortController()
    // Pausa para no consultar en cada letra de la dirección.
    const temporizador = setTimeout(async () => {
      setEstado('buscando')
      try {
        const datos = JSON.parse(clave) as ConsultaCercanas
        const coordenadas = datos.latitud.trim() && datos.longitud.trim()
          ? { latitud: Number(datos.latitud), longitud: Number(datos.longitud) } : {}
        const respuesta = await fetch('/api/sucursales/localidades-cercanas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controlador.signal,
          body: JSON.stringify({ direccion: datos.direccion, localidad: datos.localidad, provincia: datos.provincia, ...coordenadas }),
        })
        const cuerpo = await respuesta.json().catch(() => null)
        if (!respuesta.ok || !Array.isArray(cuerpo?.localidades)) throw new Error(cuerpo?.error ?? 'No pudimos traer las localidades cercanas.')
        cambiar.current(mezclar(zonasActuales.current, cuerpo.localidades as LocalidadCercana[], { nombre: datos.localidad, provincia: datos.provincia }))
        setEstado('listo')
      } catch (e) {
        if (controlador.signal.aborted) return
        setError(e instanceof Error ? e.message : 'No pudimos traer las localidades cercanas.')
        setEstado('error')
      }
    }, 700)
    return () => { clearTimeout(temporizador); controlador.abort() }
  }, [clave])

  // Sugerencias para agregar otra localidad: las que ya están en la lista no se repiten.
  async function buscarOtra(texto: string, signal: AbortSignal) {
    const enLista = new Set(zonas.map((z) => claveLugar(z.nombre, z.provincia)))
    return (await buscarLocalidades(texto, signal))
      .filter((l) => !enLista.has(claveLugar(l.nombre, l.provincia)))
      .map((l) => ({ ...l, texto: [l.nombre, detalle({ ...l, partido: l.partido ?? null })].filter(Boolean).join(' · ') || l.texto }))
  }

  function agregar(localidad: { nombre: string; provincia: string; partido?: string | null }) {
    setBusqueda('')
    setAvisoBusqueda('')
    onCambiar([...zonas, { nombre: localidad.nombre, provincia: localidad.provincia, partido: localidad.partido ?? null, costo: '', elegida: true }])
  }

  const esDelLocal = (zona: ZonaFormulario) =>
    !!consulta && claveLugar(zona.nombre, zona.provincia) === claveLugar(consulta.localidad, consulta.provincia)

  function cambiarZona(indice: number, cambios: Partial<ZonaFormulario>) {
    onCambiar(zonas.map((z, i) => (i === indice ? { ...z, ...cambios } : z)))
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">¿A qué localidades hacés delivery?</p>
      <p className="text-xs text-muted">
        Tildá las localidades a las que llegás y poné cuánto cobrás el envío en cada una (0 = gratis). A las que no tildes no se puede pedir delivery.
      </p>

      {estado === 'esperando' && zonas.length === 0 && (
        <p className="text-sm text-muted">Completá la localidad y la dirección del local para ver las localidades cercanas.</p>
      )}
      {estado === 'buscando' && <p className="text-sm text-muted" aria-live="polite">Buscando localidades cercanas…</p>}
      {estado === 'error' && <p className="text-sm text-danger" role="alert">{error}</p>}

      {zonas.length > 0 && (
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-surface p-2">
          {zonas.map((zona, indice) => {
            const idZona = `${idPrefijo}zona-${indice}`
            const faltaCosto = zona.elegida && zona.costo.trim() === ''
            return (
              <li key={claveLugar(zona.nombre, zona.provincia)} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <input
                  id={idZona} type="checkbox" checked={zona.elegida}
                  onChange={(e) => cambiarZona(indice, { elegida: e.target.checked })}
                  className="size-4 shrink-0 accent-accent"
                />
                <label htmlFor={idZona} className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="truncate">
                    {zona.nombre}
                    {esDelLocal(zona) && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Donde está el local</span>}
                  </span>
                  {detalle(zona) && <span className="truncate text-xs text-muted">{detalle(zona)}</span>}
                </label>
                <span className="text-sm text-muted">$</span>
                <input
                  id={`${idZona}-costo`} aria-label={`Costo del envío a ${zona.nombre}`}
                  type="number" min="0" max={MAX_RECARGO_DELIVERY} step="1" inputMode="numeric" placeholder="Costo"
                  disabled={!zona.elegida} value={zona.costo} aria-invalid={faltaCosto || undefined}
                  onChange={(e) => cambiarZona(indice, { costo: e.target.value })}
                  className={claseCosto}
                />
              </li>
            )
          })}
        </ul>
      )}

      {estado !== 'esperando' && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefijo}zona-buscar`} className="text-sm">¿Falta alguna? Buscala y elegila de la lista</label>
          <CampoConSugerencias
            id={`${idPrefijo}zona-buscar`}
            valor={busqueda}
            onCambiar={setBusqueda}
            buscar={buscarOtra}
            onElegir={agregar}
            onFalla={() => setAvisoBusqueda('No pudimos buscar localidades en este momento. Probá de nuevo en un rato.')}
            textoSinResultados="No encontramos esa localidad (o ya está en la lista)."
            placeholder="Ej: Bernal"
            maxLength={100}
            className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          {avisoBusqueda && <p className="text-xs text-danger">{avisoBusqueda}</p>}
        </div>
      )}
    </div>
  )
}

// "Comuna 4 · Capital" o el partido, para distinguir localidades con nombres parecidos.
function detalle(zona: { provincia: string; partido: string | null }) {
  const capital = normalizarLugar(zona.provincia) === normalizarLugar('CABA')
  return [zona.partido, capital ? 'Capital' : null].filter(Boolean).join(' · ')
}

// Primero la localidad donde está el local (ya tildada: se da por hecho que entrega ahí) y
// después las cercanas en orden de distancia, conservando lo que el admin ya tildó y
// escribió. Las guardadas que no vinieron en la lista se agregan al final para que no se pierdan.
function mezclar(actuales: ZonaFormulario[], cercanas: LocalidadCercana[], local: { nombre: string; provincia: string }): ZonaFormulario[] {
  const porClave = new Map(actuales.map((z) => [claveLugar(z.nombre, z.provincia), z]))
  const claveLocal = claveLugar(local.nombre, local.provincia)
  const delLocal = cercanas.find((l) => claveLugar(l.nombre, l.provincia) === claveLocal)
    ?? { nombre: local.nombre, provincia: local.provincia, partido: null }
  const usadas = new Set<string>()
  const lista = [delLocal, ...cercanas.filter((l) => l !== delLocal)].map((l) => {
    const clave = claveLugar(l.nombre, l.provincia)
    usadas.add(clave)
    const actual = porClave.get(clave)
    if (actual) return { ...actual, partido: l.partido ?? actual.partido }
    return { nombre: l.nombre, provincia: l.provincia, partido: l.partido, costo: '', elegida: clave === claveLocal }
  })
  return [...lista, ...actuales.filter((z) => z.elegida && !usadas.has(claveLugar(z.nombre, z.provincia)))]
}
