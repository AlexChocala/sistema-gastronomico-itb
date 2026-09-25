// src/app/(panel)/sucursales/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { MapPin, Pencil, Plus, Power, Search, Store, X } from '@/components/icons'

interface Localidad {
  idLocalidad: number
  nombre: string
  provincia: { idProvincia: number; nombre: string }
}

interface Sucursal {
  idSucursal: number
  nombre: string
  direccion: string
  telefono: string | null
  horario: string | null
  activa: boolean
  idLocalidad: number
  localidad: Localidad
}

const formVacio = {
  nombre: '',
  direccion: '',
  telefono: '',
  horario: '',
  idLocalidad: '',
}

const localidadNuevaVacia = { nombre: '', nombreProvincia: '' }

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

  useEffect(() => {
    cargarDatos()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'idLocalidad' && value === '__nueva__') {
      setUsarLocalidadNueva(true)
      setForm({ ...form, idLocalidad: '' })
      return
    }
    setForm({ ...form, [name]: value })
  }

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
      telefono: s.telefono ?? '',
      horario: s.horario ?? '',
      idLocalidad: String(s.idLocalidad),
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
      telefono: form.telefono || null,
      horario: form.horario || null,
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
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Sucursales</h1>
            <p className="mt-1 text-sm text-muted">Gestioná los locales del sistema.</p>
          </div>
          <button
            type="button"
            onClick={mostrarForm ? cerrarForm : abrirNuevo}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover"
          >
            {mostrarForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {mostrarForm ? 'Cancelar' : 'Nueva sucursal'}
          </button>
        </header>

        {mostrarForm && (
          <div className="rounded-3xl bg-surface p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nombre" className="text-sm">Nombre</label>
                  <input
                    id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required
                    className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="telefono" className="text-sm">Teléfono</label>
                  <input
                    id="telefono" name="telefono" type="tel"
                    pattern="[\d\s\-+()]{6,30}"
                    title="Solo números, espacios, guiones o paréntesis (6 a 30 caracteres)"
                    value={form.telefono} onChange={handleChange}
                    className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="direccion" className="text-sm">Dirección</label>
                  <input
                    id="direccion" name="direccion" value={form.direccion} onChange={handleChange} required
                    className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="horario" className="text-sm">Horario</label>
                  <input
                    id="horario" name="horario" value={form.horario} onChange={handleChange} placeholder="Ej: 9 a 22hs"
                    className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>

                {!usarLocalidadNueva ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="idLocalidad" className="text-sm">Localidad</label>
                    <select
                      id="idLocalidad" name="idLocalidad" value={form.idLocalidad} onChange={handleChange} required
                      className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                    >
                      <option value="" disabled hidden>Seleccionar localidad</option>
                      {localidades.map((l) => (
                        <option key={l.idLocalidad} value={l.idLocalidad}>
                          {l.nombre}, {l.provincia.nombre}
                        </option>
                      ))}
                      <option value="__nueva__">+ Agregar localidad nueva</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-2xl bg-bg p-4 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Nueva localidad</p>
                      <button
                        type="button"
                        onClick={() => setUsarLocalidadNueva(false)}
                        className="cursor-pointer text-xs text-muted hover:text-text"
                      >
                        Elegir de la lista
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        placeholder="Localidad (ej: Lanús)"
                        value={localidadNueva.nombre}
                        onChange={(e) => setLocalidadNueva({ ...localidadNueva, nombre: e.target.value })}
                        required
                        className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                      />
                      <input
                        placeholder="Provincia (ej: Buenos Aires)"
                        value={localidadNueva.nombreProvincia}
                        onChange={(e) => setLocalidadNueva({ ...localidadNueva, nombreProvincia: e.target.value })}
                        required
                        className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}
              </div>

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
                  {s.telefono && <p>{s.telefono}</p>}
                  {s.horario && <p>{s.horario}</p>}
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