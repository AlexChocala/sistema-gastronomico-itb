// src/app/(panel)/usuarios/page.tsx
// Usuarios activos y archivados en la misma pantalla: la URL elige la vista
// (/usuarios o /usuarios/archivados, que reutiliza este componente). Los archivados son
// los mismos usuarios en otro estado, por eso comparten tabla, búsqueda y filtros.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowUpDown, Copy, KeyRound, Pencil, Plus, Power, RotateCcw, Search, ShieldCheck, Store, Trash2, X,
} from '@/components/icons'
import { Desplegable } from '@/components/ui/Desplegable'
import { ExportarImportar } from '@/components/ui/ExportarImportar'
import { hoyEnArgentina } from '@/lib/reportes/fechas'
import { etiquetaRol, rolSinSucursal } from '@/lib/usuarios/roles'
import type { DatosExportables } from '@/lib/utils/exportar'

const COLUMNAS_EXPORTAR = ['ID', 'Nombre', 'Apellido', 'Email', 'Rol', 'Sucursal', 'Estado']

interface Usuario {
  idUsuario: number
  nombre: string
  apellido: string
  email: string
  activo: boolean
  fotoPerfilPath: string | null
  fotoPerfilUrl: string | null
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
type Vista = 'activos' | 'archivados'
type Orden = 'nombre' | 'apellido' | 'rol' | 'sucursal'

const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: 'nombre', texto: 'Ordenar por nombre' },
  { valor: 'apellido', texto: 'Ordenar por apellido' },
  { valor: 'rol', texto: 'Ordenar por rol' },
  { valor: 'sucursal', texto: 'Ordenar por sucursal' },
]

function compararUsuarios(orden: Orden) {
  const texto = (u: Usuario) => ({
    nombre: `${u.nombre} ${u.apellido}`,
    apellido: `${u.apellido} ${u.nombre}`,
    rol: etiquetaRol(u.rol.nombre),
    sucursal: textoSucursal(u),
  })[orden]
  return (a: Usuario, b: Usuario) =>
    texto(a).localeCompare(texto(b), 'es') || `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es')
}

function nombreSucursal(nombre: string) {
  return nombre.replace('Prueba - ', '')
}

function iniciales(u: Usuario) {
  return `${u.nombre[0] ?? ''}${u.apellido[0] ?? ''}`.toUpperCase()
}

// Sucursal que se muestra en la tabla y en la exportación.
function textoSucursal(u: Usuario) {
  if (u.sucursal) return nombreSucursal(u.sucursal.nombre)
  return rolSinSucursal(u.rol.nombre) ? 'Todas las sucursales' : ''
}

// Campo con label para el modal del formulario. Sin `id`, el label es un texto: los
// desplegables se nombran solos (aria-label) y no son un <input> al que apuntar.
function Campo({
  id,
  label,
  className = '',
  children,
}: {
  id?: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {id ? <label htmlFor={id} className="text-sm">{label}</label> : <span className="text-sm">{label}</span>}
      {children}
    </div>
  )
}

type FormUsuario = {
  nombre: string
  apellido: string
  email: string
  idRol: number | null
  idSucursal: number | null
}

const formVacio: FormUsuario = {
  nombre: '',
  apellido: '',
  email: '',
  idRol: null,
  idSucursal: null,
}

// Las dos listas a la vez: así el selector Activos | Archivados muestra cuántos hay en cada una.
async function pedirUsuarios() {
  const [resActivos, resArchivados] = await Promise.all([
    fetch('/api/usuarios', { cache: 'no-store' }),
    fetch('/api/usuarios?estado=archivados', { cache: 'no-store' }),
  ])
  if ([resActivos.status, resArchivados.status].some((estado) => estado === 401 || estado === 403)) return null
  const [activos, archivados] = await Promise.all([resActivos.json(), resArchivados.json()])
  return { ...activos, archivados: (archivados.usuarios ?? []) as Usuario[] }
}

export default function UsuariosPage() {
  const router = useRouter()
  const vista: Vista = usePathname() === '/usuarios/archivados' ? 'archivados' : 'activos'

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [archivados, setArchivados] = useState<Usuario[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [roles, setRoles] = useState<Rol[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [idUsuarioSesion, setIdUsuarioSesion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  // Contraseña temporal a mostrar, junto con el texto que explica de dónde viene
  // (alta de usuario o restablecimiento).
  const [passwordGenerada, setPasswordGenerada] = useState<{ password: string; texto: string } | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState<Usuario | null>(null)
  const [error, setError] = useState('')

  const usuarioEditado = usuarios.find((u) => u.idUsuario === editandoId) ?? null

  const [form, setForm] = useState(formVacio)
  const rolElegido = roles.find((r) => r.idRol === form.idRol) ?? null
  // El admin no elige sucursal: trabaja con todas.
  const llevaSucursal = !rolElegido || !rolSinSucursal(rolElegido.nombre)

  function aplicarDatos(data: NonNullable<Awaited<ReturnType<typeof pedirUsuarios>>>) {
    setUsuarios(data.usuarios ?? [])
    setArchivados(data.archivados)
    setRoles(data.roles ?? [])
    setSucursales(data.sucursales ?? [])
    setEsAdmin(data.esAdmin ?? false)
    setIdUsuarioSesion(data.idUsuarioSesion ?? null)
    setLoading(false)
  }

  async function cargarDatos() {
    setLoading(true)
    const data = await pedirUsuarios()
    if (!data) {
      router.replace('/dashboard')
      return
    }
    aplicarDatos(data)
    // La barra superior y el resto del panel salen del layout (servidor): se vuelven a pedir.
    router.refresh()
  }

  useEffect(() => {
    let paginaActiva = true

    async function cargarInicial() {
      const data = await pedirUsuarios()
      if (!data) {
        router.replace('/dashboard')
        return
      }
      if (paginaActiva) aplicarDatos(data)
    }

    void cargarInicial()
    return () => {
      paginaActiva = false
    }
  }, [router])

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

  // La confirmación de restablecer contraseña también se cierra con Escape.
  useEffect(() => {
    if (!confirmarRestablecer) return
    function alPresionarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmarRestablecer(null)
    }
    window.addEventListener('keydown', alPresionarTecla)
    return () => window.removeEventListener('keydown', alPresionarTecla)
  }, [confirmarRestablecer])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      idRol: u.idRol,
      idSucursal: u.idSucursal,
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

    // Los desplegables no son <select required>: se validan acá.
    if (form.idRol === null) {
      setError('Elegí el rol del usuario.')
      return
    }
    if (llevaSucursal && form.idSucursal === null) {
      setError('Elegí la sucursal donde trabaja.')
      return
    }

    const esEdicion = editandoId !== null
    const url = esEdicion ? `/api/usuarios/${editandoId}` : '/api/usuarios'
    const method = esEdicion ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, idSucursal: llevaSucursal ? form.idSucursal : null }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al guardar el usuario')
      return
    }

    if (!esEdicion && data.passwordGenerada) {
      setPasswordGenerada({ password: data.passwordGenerada, texto: 'Usuario creado. Compartí esta contraseña temporal:' })
    }
    cerrarForm()
    cargarDatos()
  }

  async function archivarUsuario(u: Usuario) {
    setError('')
    const res = await fetch(`/api/usuarios/${u.idUsuario}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo cambiar el estado del usuario')
      return
    }
    cargarDatos()
  }

  async function restablecerContrasena(u: Usuario) {
    setError('')
    setConfirmarRestablecer(null)
    const res = await fetch(`/api/usuarios/${u.idUsuario}/restablecer-contrasena`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo restablecer la contraseña')
      return
    }
    setPasswordGenerada({
      password: data.passwordGenerada,
      texto: `Contraseña de ${u.nombre} ${u.apellido} restablecida. Compartí esta contraseña temporal:`,
    })
  }

  async function quitarFotoPerfil(u: Usuario) {
    setError('')
    const res = await fetch(`/api/usuarios/${u.idUsuario}/foto-perfil`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo quitar la foto de perfil')
      return
    }
    // Se actualiza la lista sin pasar por "Cargando...", para que el modal siga abierto.
    const actualizados = await pedirUsuarios()
    if (actualizados) aplicarDatos(actualizados)
    // Si era la foto del propio admin, la barra superior también tiene que cambiar.
    router.refresh()
  }

  // PATCH sin cuerpo: reactiva la cuenta (la misma API que usaba la pantalla de archivados).
  async function reactivarUsuario(u: Usuario) {
    setError('')
    const res = await fetch(`/api/usuarios/${u.idUsuario}`, { method: 'PATCH' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo reactivar el usuario')
      return
    }
    cargarDatos()
  }

  // Búsqueda por nombre, apellido o email, filtros y orden: sobre la lista de la vista elegida.
  const textoBuscado = busqueda.trim().toLocaleLowerCase('es')
  const usuariosVisibles = (vista === 'activos' ? usuarios : archivados)
    .filter((u) => {
      const coincideTexto = !textoBuscado
        || [u.nombre, u.apellido, `${u.nombre} ${u.apellido}`, u.email].some((valor) => valor.toLocaleLowerCase('es').includes(textoBuscado))
      const coincideRol = !filtroRol || String(u.idRol) === filtroRol
      const coincideSucursal = !filtroSucursal
        || (filtroSucursal === 'todas' ? u.idSucursal === null : String(u.idSucursal) === filtroSucursal)
      return coincideTexto && coincideRol && coincideSucursal
    })
    .sort(compararUsuarios(orden))
  const hayFiltros = textoBuscado !== '' || filtroRol !== '' || filtroSucursal !== ''

  // Campo por campo, para que nada sensible que agregue la API llegue al archivo.
  // Sale lo que se ve: la vista elegida, con su búsqueda y filtros.
  function datosParaExportar(): DatosExportables {
    return {
      filas: usuariosVisibles.map((u) => [
        u.idUsuario, u.nombre, u.apellido, u.email, etiquetaRol(u.rol.nombre), textoSucursal(u),
        u.activo ? 'Activo' : 'Inactivo',
      ]),
      json: usuariosVisibles.map((u) => ({
        idUsuario: u.idUsuario,
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.email,
        rol: u.rol.nombre,
        sucursal: u.sucursal ? { idSucursal: u.sucursal.idSucursal, nombre: u.sucursal.nombre } : null,
        activo: u.activo,
      })),
    }
  }

  const encabezado = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="page-title">Usuarios</h1>
        <p className="mt-1 text-sm text-muted">Administrá las cuentas, roles y sucursales del personal.</p>
      </div>
      {esAdmin && (
        <div className="flex flex-wrap items-start gap-2">
          <ExportarImportar
            entidad="usuarios"
            columnas={COLUMNAS_EXPORTAR}
            nombreArchivo={`usuarios_${hoyEnArgentina()}`}
            cantidad={usuariosVisibles.length}
            aclaracionCantidad={vista === 'archivados' || hayFiltros ? 'Los que se ven en la lista, con la búsqueda y los filtros.' : undefined}
            obtenerDatos={datosParaExportar}
            puedeImportar={esAdmin}
            onImportado={() => void cargarDatos()}
          />
          <button type="button" className={claseBotonAcento} onClick={abrirNuevo}>
            <Plus className="size-4" />
            Nuevo usuario
          </button>
        </div>
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
            <p className="text-sm">{passwordGenerada.texto}</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wide">{passwordGenerada.password}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={claseBotonSecundario}
              onClick={() => void navigator.clipboard?.writeText(passwordGenerada.password)}
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

      <div className="flex flex-col gap-5">
        {/* Activos | Archivados: el mismo estilo que el selector de sucursal de Productos. */}
        <nav aria-label="Estado de las cuentas" className="grid w-fit grid-cols-2 gap-1 rounded-full bg-surface-muted/60 p-1 text-sm">
          {([
            { valor: 'activos', texto: 'Activos', href: '/usuarios', cantidad: usuarios.length },
            { valor: 'archivados', texto: 'Archivados', href: '/usuarios/archivados', cantidad: archivados.length },
          ] as const).map((opcion) => (
            <Link
              key={opcion.valor}
              href={opcion.href}
              aria-current={vista === opcion.valor ? 'page' : undefined}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 transition-colors ${vista === opcion.valor ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {opcion.texto}
              <span className="rounded-full bg-bg px-2 text-xs tabular-nums text-muted">{opcion.cantidad}</span>
            </Link>
          ))}
        </nav>

        {/* Buscador a la izquierda y filtros a la derecha, como en Productos. Filtra al escribir:
            la lista de personal es corta y llega completa. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex w-full items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm sm:w-80">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o email"
              aria-label="Buscar usuario por nombre, apellido o email"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <Desplegable
                etiqueta="Rol"
                icono={ShieldCheck}
                opciones={[{ valor: '', texto: 'Todos los roles' }, ...roles.map((r) => ({ valor: String(r.idRol), texto: etiquetaRol(r.nombre) }))]}
                valor={filtroRol}
                onElegir={setFiltroRol}
                textoVacio="Todos los roles"
              />
            </div>
            <div className="w-56">
              <Desplegable
                etiqueta="Sucursal"
                icono={Store}
                opciones={[
                  { valor: '', texto: 'Todas las sucursales' },
                  ...sucursales.map((s) => ({ valor: String(s.idSucursal), texto: nombreSucursal(s.nombre) })),
                  // El admin no tiene sucursal asignada: trabaja con todas.
                  { valor: 'todas', texto: 'Sin sucursal fija (admin)' },
                ]}
                valor={filtroSucursal}
                onElegir={setFiltroSucursal}
                textoVacio="Todas las sucursales"
              />
            </div>
            <div className="w-56">
              <Desplegable
                etiqueta="Orden"
                icono={ArrowUpDown}
                opciones={ORDENES}
                valor={orden}
                onElegir={setOrden}
                textoVacio="Ordenar por nombre"
              />
            </div>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-text">{usuariosVisibles.length}</span>{' '}
          {usuariosVisibles.length === 1 ? 'usuario' : 'usuarios'}{vista === 'archivados' && (usuariosVisibles.length === 1 ? ' archivado' : ' archivados')}
        </p>

        {usuariosVisibles.length === 0 ? (
          vista === 'archivados' && !hayFiltros ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-10 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-bg">
                <RotateCcw className="size-5 text-muted" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg">No hay usuarios archivados</h2>
                <p className="max-w-md text-sm text-muted">Cuando desactivás una cuenta aparece acá, y la podés reactivar cuando quieras.</p>
              </div>
            </div>
          ) : (
            <p className="rounded-3xl bg-surface p-10 text-center text-muted">
              {hayFiltros ? 'No hay usuarios que coincidan con la búsqueda.' : 'No hay usuarios para mostrar.'}
            </p>
          )
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-surface p-2 shadow-sm">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Sucursal</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  {esAdmin && <th className="px-4 py-3 text-right font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {usuariosVisibles.map((u) => (
                  <tr
                    key={u.idUsuario}
                    className={`border-t border-bg transition-colors hover:bg-bg/60 ${u.activo ? '' : 'text-muted'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.fotoPerfilUrl ? (
                          // URL del bucket: no pasa por next/image.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.fotoPerfilUrl}
                            alt=""
                            className={`size-10 shrink-0 rounded-full object-cover ${u.activo ? '' : 'opacity-60'}`}
                          />
                        ) : (
                          <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm ${u.activo ? 'bg-accent-soft text-accent' : 'bg-bg text-muted'}`}
                          >
                            {iniciales(u)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate">{u.nombre} {u.apellido}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-bg px-2.5 py-1 text-xs">{etiquetaRol(u.rol.nombre)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {textoSucursal(u) ? (
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <Store className="size-4" />
                          {textoSucursal(u)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${u.activo ? 'text-success' : 'text-muted'}`}>
                        <span className={`size-1.5 rounded-full ${u.activo ? 'bg-success' : 'bg-muted'}`} />
                        {u.activo ? 'Activo' : 'Archivado'}
                      </span>
                    </td>
                    {esAdmin && vista === 'archivados' && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => reactivarUsuario(u)}
                            aria-label={`Reactivar ${u.nombre} ${u.apellido}`}
                            className={`${claseBotonSecundario} py-1.5`}
                          >
                            <RotateCcw className="size-4" />
                            Reactivar
                          </button>
                        </div>
                      </td>
                    )}
                    {esAdmin && vista === 'activos' && (
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
                          {/* La propia contraseña se cambia desde el flujo normal, no desde acá. */}
                          {u.idUsuario !== idUsuarioSesion && (
                            <button
                              type="button"
                              onClick={() => setConfirmarRestablecer(u)}
                              aria-label={`Restablecer contraseña de ${u.nombre} ${u.apellido}`}
                              title="Restablecer contraseña"
                              className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}
                            >
                              <KeyRound className="size-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => archivarUsuario(u)}
                            aria-label={`Archivar ${u.nombre} ${u.apellido}`}
                            title="Archivar"
                            className={`${claseBotonIcono} text-danger hover:bg-danger/10`}
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
        // El scroll va en el fondo y no en el formulario: así la lista de un desplegable
        // puede salir del recuadro sin quedar recortada. `m-auto` centra sin cortar arriba.
        <div className="fixed inset-0 z-50 flex overflow-y-auto bg-text/40 p-4">
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-usuario"
            className="m-auto flex w-full max-w-xl flex-col gap-5 rounded-3xl bg-surface p-6 shadow-xl"
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
              <Campo id="email" label="Email" className="sm:col-span-2">
                <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className={claseCampo} />
              </Campo>
              <Campo label="Rol">
                <Desplegable
                  etiqueta="Rol"
                  icono={ShieldCheck}
                  opciones={roles.map((r) => ({ valor: r.idRol, texto: etiquetaRol(r.nombre) }))}
                  valor={form.idRol}
                  onElegir={(idRol) => setForm({ ...form, idRol })}
                  textoVacio="Elegí un rol"
                />
              </Campo>
              <Campo label="Sucursal">
                {llevaSucursal ? (
                  <Desplegable
                    etiqueta="Sucursal"
                    icono={Store}
                    opciones={sucursales.map((s) => ({ valor: s.idSucursal, texto: nombreSucursal(s.nombre) }))}
                    valor={form.idSucursal}
                    onElegir={(idSucursal) => setForm({ ...form, idSucursal })}
                    textoVacio="Elegí una sucursal"
                  />
                ) : (
                  // Mismo alto que el desplegable, para que la fila no salte al cambiar de rol.
                  <p className="flex items-center gap-3 rounded-full border border-transparent bg-bg px-4 py-2 text-sm text-muted">
                    <Store className="size-4 shrink-0 text-accent" />
                    Todas las sucursales
                  </p>
                )}
              </Campo>
            </div>

            {usuarioEditado?.fotoPerfilPath && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {usuarioEditado.fotoPerfilUrl && (
                    // URL del bucket: no pasa por next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={usuarioEditado.fotoPerfilUrl} alt="Foto de perfil actual" className="size-12 shrink-0 rounded-full object-cover" />
                  )}
                  <p className="text-sm text-muted">Foto de perfil cargada por el usuario.</p>
                </div>
                <button
                  type="button"
                  onClick={() => quitarFotoPerfil(usuarioEditado)}
                  className={`${claseBotonSecundario} shrink-0 whitespace-nowrap text-danger hover:bg-danger/10`}
                >
                  <Trash2 className="size-4" />
                  Quitar foto
                </button>
              </div>
            )}

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

      {confirmarRestablecer && esAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-restablecer-contrasena"
            aria-describedby="detalle-restablecer-contrasena"
            className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-surface text-warning">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h2 id="titulo-restablecer-contrasena" className="text-lg">Restablecer contraseña</h2>
                <p id="detalle-restablecer-contrasena" className="mt-1 text-sm text-muted">
                  Se va a generar una contraseña temporal para {confirmarRestablecer.nombre} {confirmarRestablecer.apellido}.
                  La actual deja de funcionar y va a tener que cambiarla al ingresar.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={() => setConfirmarRestablecer(null)} className={`${claseBotonSecundario} px-5 py-3`}>
                Cancelar
              </button>
              <button type="button" onClick={() => restablecerContrasena(confirmarRestablecer)} className={`${claseBotonAcento} py-3`}>
                Restablecer contraseña
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

