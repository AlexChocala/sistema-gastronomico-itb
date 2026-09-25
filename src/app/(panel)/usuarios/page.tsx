// src/app/(panel)/usuarios/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Copy, KeyRound, Pencil, Plus, Power, Store, X } from '@/components/icons'

interface Usuario {
  idUsuario: number
  nombre: string
  apellido: string
  email: string
  username: string
  activo: boolean
  idRol: number
  rol: { idRol: number; nombre: string }
  idSucursal: number | null
  sucursal: { idSucursal: number; nombre: string } | null
}

interface Rol {
  idRol: number
  nombre: string
}

interface Sucursal {
  idSucursal: number
  nombre: string
}

const claseCampo =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent'
const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg'
const claseBotonAcento =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover'
const claseBotonIcono =
  'flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors'

function nombreSucursal(nombre: string) {
  return nombre.replace('Prueba - ', '')
}

function iniciales(u: Usuario) {
  return `${u.nombre[0] ?? ''}${u.apellido[0] ?? ''}`.toUpperCase()
}

// Campo con label para el modal del formulario.
function Campo({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">{label}</label>
      {children}
    </div>
  )
}

// Select con la misma forma de pastilla que los inputs.
function Selector(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${claseCampo} cursor-pointer appearance-none pr-10`} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

const formVacio = {
  nombre: '',
  apellido: '',
  email: '',
  username: '',
  idRol: '',
  idSucursal: '',
}

export default function UsuariosPage() {
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [passwordGenerada, setPasswordGenerada] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState(formVacio)

  async function cargarDatos() {
    setLoading(true)
    const res = await fetch('/api/usuarios')

    if (res.status === 403 || res.status === 401) {
      router.replace('/dashboard')
      return
    }

    const data = await res.json()
    setUsuarios(data.usuarios ?? [])
    setRoles(data.roles ?? [])
    setSucursales(data.sucursales ?? [])
    setEsAdmin(data.esAdmin ?? false)
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // El modal del formulario se cierra con Escape.
  useEffect(() => {
    if (!mostrarForm) return
    function alPresionarTecla(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setMostrarForm(false)
      setEditandoId(null)
      setForm(formVacio)
      setError('')
    }
    window.addEventListener('keydown', alPresionarTecla)
    return () => window.removeEventListener('keydown', alPresionarTecla)
  }, [mostrarForm])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm(formVacio)
    setError('')
    setMostrarForm(true)
  }

  function abrirEditar(u: Usuario) {
    setEditandoId(u.idUsuario)
    setForm({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      username: u.username,
      idRol: String(u.idRol),
      idSucursal: u.idSucursal ? String(u.idSucursal) : '',
    })
    setError('')
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(formVacio)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const esEdicion = editandoId !== null
    const url = esEdicion ? `/api/usuarios/${editandoId}` : '/api/usuarios'
    const method = esEdicion ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        idRol: Number(form.idRol),
        idSucursal: Number(form.idSucursal),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al guardar el usuario')
      return
    }

    if (!esEdicion && data.passwordGenerada) {
      setPasswordGenerada(data.passwordGenerada)
    }
    cerrarForm()
    cargarDatos()
  }

  async function toggleActivo(u: Usuario) {
    setError('')
    const method = u.activo ? 'DELETE' : 'PATCH'
    const res = await fetch(`/api/usuarios/${u.idUsuario}`, { method })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo cambiar el estado del usuario')
      return
    }
    cargarDatos()
  }

  const encabezado = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="page-title">Usuarios</h1>
        <p className="mt-1 text-sm text-muted">Administrá las cuentas, roles y sucursales del personal.</p>
      </div>
      {esAdmin && (
        <button type="button" className={claseBotonAcento} onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo usuario
        </button>
      )}
    </header>
  )

  if (loading) {
    return (
      <main className="flex flex-col gap-6 p-6">
        {encabezado}
        <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando usuarios...</p>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      {encabezado}

      {passwordGenerada && (
        <div className="flex flex-col gap-3 rounded-3xl bg-warning-surface p-5 sm:flex-row sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-warning">
            <KeyRound className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm">Usuario creado. Compartí esta contraseña temporal:</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wide">{passwordGenerada}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={claseBotonSecundario}
              onClick={() => void navigator.clipboard?.writeText(passwordGenerada)}
            >
              <Copy className="size-4" />
              Copiar
            </button>
            <button
              type="button"
              aria-label="Cerrar aviso"
              className={`${claseBotonIcono} text-muted hover:bg-surface hover:text-text`}
              onClick={() => setPasswordGenerada(null)}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {error && !mostrarForm && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          <span className="text-text">{usuarios.length}</span> {usuarios.length === 1 ? 'usuario' : 'usuarios'}
        </p>

        {usuarios.length === 0 ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay usuarios para mostrar.</p>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-surface p-2 shadow-sm">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Sucursal</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  {esAdmin && <th className="px-4 py-3 text-right font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr
                    key={u.idUsuario}
                    className={`border-t border-bg transition-colors hover:bg-bg/60 ${u.activo ? '' : 'text-muted'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm ${u.activo ? 'bg-accent-soft text-accent' : 'bg-bg text-muted'}`}
                        >
                          {iniciales(u)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate">{u.nombre} {u.apellido}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">@{u.username}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-bg px-2.5 py-1 text-xs capitalize">{u.rol.nombre}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.sucursal ? (
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <Store className="size-4" />
                          {nombreSucursal(u.sucursal.nombre)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${u.activo ? 'text-success' : 'text-muted'}`}>
                        <span className={`size-1.5 rounded-full ${u.activo ? 'bg-success' : 'bg-order-delivered'}`} />
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEditar(u)}
                            aria-label={`Editar ${u.nombre} ${u.apellido}`}
                            title="Editar"
                            className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActivo(u)}
                            aria-label={`${u.activo ? 'Desactivar' : 'Activar'} ${u.nombre} ${u.apellido}`}
                            title={u.activo ? 'Desactivar' : 'Activar'}
                            className={`${claseBotonIcono} ${u.activo ? 'text-danger hover:bg-danger/10' : 'text-success hover:bg-success/10'}`}
                          >
                            <Power className="size-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarForm && esAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-usuario"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-3xl bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-formulario-usuario" className="text-lg">
                  {editandoId !== null ? 'Editar usuario' : 'Nuevo usuario'}
                </h2>
                <p className="text-sm text-muted">
                  {editandoId !== null
                    ? `Usuario #${editandoId}`
                    : 'La contraseña se genera automáticamente al crearlo.'}
                </p>
              </div>
              <button type="button" onClick={cerrarForm} aria-label="Cerrar"
                className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}>
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="nombre" label="Nombre">
                <input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required className={claseCampo} />
              </Campo>
              <Campo id="apellido" label="Apellido">
                <input id="apellido" name="apellido" value={form.apellido} onChange={handleChange} required className={claseCampo} />
              </Campo>
              <Campo id="email" label="Email">
                <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className={claseCampo} />
              </Campo>
              <Campo id="username" label="Username">
                <input id="username" name="username" value={form.username} onChange={handleChange} required className={claseCampo} />
              </Campo>
              <Campo id="idRol" label="Rol">
                <Selector id="idRol" name="idRol" value={form.idRol} onChange={handleChange} required>
                  <option value="" disabled hidden>Seleccionar rol</option>
                  {roles.map((r) => (
                    <option key={r.idRol} value={r.idRol}>{r.nombre}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo id="idSucursal" label="Sucursal">
                <Selector id="idSucursal" name="idSucursal" value={form.idSucursal} onChange={handleChange} required>
                  <option value="" disabled hidden>Seleccionar sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.idSucursal} value={s.idSucursal}>{nombreSucursal(s.nombre)}</option>
                  ))}
                </Selector>
              </Campo>
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={cerrarForm} className={`${claseBotonSecundario} px-5 py-3`}>
                Cancelar
              </button>
              <button type="submit" className={`${claseBotonAcento} py-3`}>
                {editandoId !== null ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

