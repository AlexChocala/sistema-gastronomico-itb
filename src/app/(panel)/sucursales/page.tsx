// src/app/(panel)/sucursales/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Globe, MapPin, Pencil, Plus, Power, Search, Store, X } from '@/components/icons'
import { MAX_SUCURSALES } from '@/lib/sucursales/sucursales-validacion'
import { CamposSucursal, localidadNuevaVacia, valoresSucursalVacios } from '@/components/sucursal/CamposSucursal'

interface Localidad {
  idLocalidad: number
  nombre: string
  provincia: { idProvincia: number; nombre: string }
}

interface Sucursal {
  idSucursal: number
  nombre: string
  slug: string
  direccion: string
  whatsapp: string | null
  horario: string | null
  activa: boolean
  ofreceRetiro: boolean
  ofreceDelivery: boolean
  idLocalidad: number
  localidad: Localidad
}

const formVacio = valoresSucursalVacios

function limpiarNombre(nombre: string) {
  return nombre.replace('Prueba - ', '')
}

export default function SucursalesPage() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [usarLocalidadNueva, setUsarLocalidadNueva] = useState(false)
  const [error, setError] = useState('')
  const limiteAlcanzado = sucursales.length >= MAX_SUCURSALES
  const [busqueda, setBusqueda] = useState('')

  const [form, setForm] = useState(formVacio)
  const [localidadNueva, setLocalidadNueva] = useState(localidadNuevaVacia)

  async function cargarDatos() {
    setLoading(true)
    const res = await fetch('/api/sucursales')
    const data = await res.json()
    setSucursales(data.sucursales ?? [])
    setLocalidades(data.localidades ?? [])
    setLoading(false)
  }

  // Carga inicial: `loading` ya arranca en true, así que el efecto solo setea estado
  // cuando llega la respuesta (no en el mismo render). Si la pantalla se desmonta
  // antes, se descarta la respuesta.
  useEffect(() => {
    let paginaActiva = true

    async function cargarInicial() {
      const res = await fetch('/api/sucursales')
      const data = await res.json()
      if (!paginaActiva) return
      setSucursales(data.sucursales ?? [])
      setLocalidades(data.localidades ?? [])
      setLoading(false)
    }

    void cargarInicial()
    return () => {
      paginaActiva = false
    }
  }, [])

  function abrirNuevo() {
    setEditandoId(null)
    setForm(formVacio)
    setLocalidadNueva(localidadNuevaVacia)
    setUsarLocalidadNueva(false)
    setError('')
    setMostrarForm(true)
  }

  function abrirEditar(s: Sucursal) {
    setEditandoId(s.idSucursal)
    setForm({
      nombre: s.nombre,
      direccion: s.direccion,
      whatsapp: s.whatsapp ?? '',
      horario: s.horario ?? '',
      idLocalidad: String(s.idLocalidad),
      ofreceRetiro: s.ofreceRetiro,
      ofreceDelivery: s.ofreceDelivery,
    })
    setLocalidadNueva(localidadNuevaVacia)
    setUsarLocalidadNueva(false)
    setError('')
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(formVacio)
    setLocalidadNueva(localidadNuevaVacia)
    setUsarLocalidadNueva(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const esEdicion = editandoId !== null
    const url = esEdicion ? `/api/sucursales/${editandoId}` : '/api/sucursales'
    const method = esEdicion ? 'PUT' : 'POST'

    const body: Record<string, unknown> = {
      nombre: form.nombre,
      direccion: form.direccion,
      whatsapp: form.whatsapp || null,
      horario: form.horario || null,
      ofreceRetiro: form.ofreceRetiro,
      ofreceDelivery: form.ofreceDelivery,
    }

    if (usarLocalidadNueva) {
      body.localidadNueva = localidadNueva
    } else {
      body.idLocalidad = Number(form.idLocalidad)
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al guardar la sucursal')
      return
    }

    cerrarForm()
    cargarDatos()
  }

  async function toggleActiva(s: Sucursal) {
    setError('')
    const method = s.activa ? 'DELETE' : 'PATCH'
    const res = await fetch(`/api/sucursales/${s.idSucursal}`, { method })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo cambiar el estado de la sucursal')
      return
    }
    cargarDatos()
  }

  const sucursalesVisibles = sucursales.filter((s) =>
    limpiarNombre(s.nombre).toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  return (
    <main className="min-h-screen bg-bg p-6">
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Sucursales</h1>
            <p className="mt-1 text-sm text-muted">
              Gestioná los locales del sistema.{' '}
              {!loading && `${sucursales.length} de ${MAX_SUCURSALES} sucursales.`}
            </p>
          </div>
          <button
            type="button"
            onClick={mostrarForm ? cerrarForm : abrirNuevo}
            // La API también lo valida; esto solo evita abrir un formulario que va a fallar.
            disabled={!mostrarForm && limiteAlcanzado}
            title={!mostrarForm && limiteAlcanzado ? `Llegaste al máximo de ${MAX_SUCURSALES} sucursales.` : undefined}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent"
          >
            {mostrarForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {mostrarForm ? 'Cancelar' : 'Nueva sucursal'}
          </button>
        </header>

        {mostrarForm && (
          <div className="rounded-3xl bg-surface p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <CamposSucursal
                valores={form}
                localidadNueva={localidadNueva}
                usarLocalidadNueva={usarLocalidadNueva}
                localidades={localidades}
                onCambiar={(campo, valor) => setForm({ ...form, [campo]: valor })}
                onCambiarLocalidadNueva={(campo, valor) => setLocalidadNueva({ ...localidadNueva, [campo]: valor })}
                onUsarLocalidadNueva={setUsarLocalidadNueva}
              />

              {error && <p className="text-sm text-danger">{error}</p>}

              <button
                type="submit"
                className="inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full bg-accent px-6 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover"
              >
                {editandoId !== null ? 'Guardar cambios' : 'Crear sucursal'}
              </button>
            </form>
          </div>
        )}

        {error && !mostrarForm && <p className="text-sm text-danger">{error}</p>}

        <label className="flex w-full max-w-sm items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm">
          <Search className="size-4 text-muted" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar sucursal"
            aria-label="Buscar sucursal"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>

        {loading ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando...</p>
        ) : sucursalesVisibles.length === 0 ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay sucursales para mostrar.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
            {sucursalesVisibles.map((s) => (
              <div key={s.idSucursal} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Store className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{limpiarNombre(s.nombre)}</p>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${s.activa ? 'text-success' : 'text-danger'}`}>
                        <span className={`size-1.5 rounded-full ${s.activa ? 'bg-success' : 'bg-danger'}`} />
                        {s.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-sm text-muted">
                  <p className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    {s.direccion} — {s.localidad.nombre}, {s.localidad.provincia.nombre}
                  </p>
                  {s.whatsapp && <p>{s.whatsapp}</p>}
                  {s.horario && <p>{s.horario}</p>}
                  <p>{[s.ofreceRetiro && 'Retiro en el local', s.ofreceDelivery && 'Delivery'].filter(Boolean).join(' · ')}</p>
                  {/* URL pública del menú: no cambia si se renombra la sucursal (ver slugLibre). */}
                  <a
                    href={`/${s.slug}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 break-all text-accent hover:underline"
                  >
                    <Globe className="size-3.5 shrink-0" />
                    /{s.slug}
                  </a>
                </div>

                <div className="mt-auto flex gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => abrirEditar(s)}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs transition-colors hover:bg-bg"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActiva(s)}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs transition-colors hover:bg-bg"
                  >
                    <Power className="size-3.5" />
                    {s.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}