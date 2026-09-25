'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Pencil, Plus, Power, RotateCcw, X } from '@/components/icons'
import { IconoCategoria } from '@/components/icons/IconoCategoria'

const claseCampo =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60'
const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'
const claseBotonAcento =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'
const claseBotonIcono =
  'flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50'

type Categoria = {
  idCategoria: number
  nombre: string
  descripcion: string | null
  orden: number
  activa: boolean
  _count: { productos: number }
}

type RespuestaCategorias = { categorias: Categoria[] }
type RespuestaError = { error?: string }

const formularioVacio = { nombre: '', descripcion: '', orden: '' }

async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  if (!respuesta.headers.get('content-type')?.includes('application/json')) {
    throw new Error('El servidor no devolvió una respuesta válida. Reiniciá la aplicación e intentá nuevamente.')
  }
  return respuesta.json() as Promise<T>
}

export function GestionCategoriasForm() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [formulario, setFormulario] = useState(formularioVacio)
  const [idEdicion, setIdEdicion] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  async function solicitarCategorias() {
    const respuesta = await fetch('/api/productos/categorias', { cache: 'no-store' })
    const datos = await leerRespuesta<RespuestaCategorias & RespuestaError>(respuesta)
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar las categorías.')
    return datos.categorias
  }

  async function listar() {
    setCargando(true)
    setError('')
    try {
      setCategorias(await solicitarCategorias())
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudieron cargar las categorías.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    let paginaActiva = true
    async function cargarInicial() {
      try {
        const resultado = await solicitarCategorias()
        if (paginaActiva) setCategorias(resultado)
      } catch (errorDesconocido) {
        if (paginaActiva) {
          setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudieron cargar las categorías.')
        }
      } finally {
        if (paginaActiva) setCargando(false)
      }
    }
    void cargarInicial()
    return () => { paginaActiva = false }
  }, [])

  // El modal del formulario se cierra con Escape (salvo mientras guarda).
  useEffect(() => {
    if (!mostrarFormulario) return
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key !== 'Escape' || cargando) return
      setFormulario(formularioVacio)
      setIdEdicion(null)
      setMostrarFormulario(false)
    }
    window.addEventListener('keydown', alPresionarTecla)
    return () => window.removeEventListener('keydown', alPresionarTecla)
  }, [mostrarFormulario, cargando])

  function limpiarFormulario() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
    setMostrarFormulario(false)
  }

  function abrirNueva() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
    setMensaje('')
    setError('')
    setMostrarFormulario(true)
  }

  function editar(categoria: Categoria) {
    setMostrarFormulario(true)
    setIdEdicion(categoria.idCategoria)
    setFormulario({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion ?? '',
      orden: String(categoria.orden),
    })
    setMensaje('')
    setError('')
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setCargando(true)
    setMensaje('')
    setError('')
    try {
      const respuesta = await fetch(
        idEdicion === null ? '/api/productos/categorias' : `/api/productos/categorias/${idEdicion}`,
        {
          method: idEdicion === null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: formulario.nombre,
            descripcion: formulario.descripcion,
            orden: Number(formulario.orden),
          }),
        },
      )
      const datos = await leerRespuesta<RespuestaError>(respuesta)
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar la categoría.')
      setMensaje(idEdicion === null ? 'Categoría creada.' : 'Categoría actualizada.')
      limpiarFormulario()
      await listar()
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo guardar la categoría.')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarEstado(categoria: Categoria) {
    setCargando(true)
    setMensaje('')
    setError('')
    try {
      const respuesta = await fetch(`/api/productos/categorias/${categoria.idCategoria}`, {
        method: categoria.activa ? 'DELETE' : 'PATCH',
        headers: categoria.activa ? undefined : { 'Content-Type': 'application/json' },
        body: categoria.activa ? undefined : JSON.stringify({ activa: true }),
      })
      const datos = await leerRespuesta<RespuestaError>(respuesta)
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cambiar el estado de la categoría.')
      setMensaje(categoria.activa ? 'Categoría desactivada.' : 'Categoría activada.')
      await listar()
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo cambiar el estado.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="mt-1 text-sm text-muted">Organizá y ordená las secciones del menú.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={claseBotonSecundario} onClick={() => router.push('/productos')}>
            <ArrowLeft className="size-4" />
            Productos
          </button>
          <button type="button" className={claseBotonAcento} onClick={abrirNueva} disabled={cargando}>
            <Plus className="size-4" />
            Nueva categoría
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-4" aria-live="polite" aria-busy={cargando}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            <span className="text-text">{categorias.length}</span>{' '}
            {categorias.length === 1 ? 'categoría' : 'categorías'}
          </p>
          <button type="button" className={claseBotonSecundario} onClick={() => void listar()} disabled={cargando}>
            <RotateCcw className={`size-4 ${cargando ? 'animate-spin [animation-direction:reverse]' : ''}`} />
            Actualizar
          </button>
        </div>

        {mensaje && (
          <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">{mensaje}</p>
        )}
        {error && !mostrarFormulario && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        )}
        {cargando && categorias.length === 0 && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando categorías...</p>
        )}
        {!cargando && categorias.length === 0 && !error && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay categorías cargadas.</p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {categorias.map((categoria) => (
            <article
              key={categoria.idCategoria}
              className={`flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm transition-shadow hover:shadow-md ${categoria.activa ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 text-xs ${categoria.activa ? 'text-success' : 'text-muted'}`}>
                  <span className={`size-1.5 rounded-full ${categoria.activa ? 'bg-success' : 'bg-order-delivered'}`} />
                  {categoria.activa ? 'Activa' : 'Inactiva'}
                </span>
                <span className="rounded-full bg-bg px-2.5 py-1 text-xs text-muted" title="Orden en el menú">
                  Orden {categoria.orden}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <IconoCategoria categoria={categoria.nombre} className="size-7" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <h3 className="leading-tight">{categoria.nombre}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {categoria.descripcion || 'Sin descripción.'}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                <p className="inline-flex items-center gap-2 text-sm text-muted">
                  <Package className="size-4" />
                  <span>
                    <span className="font-bold text-text">{categoria._count.productos}</span>{' '}
                    {categoria._count.productos === 1 ? 'producto' : 'productos'}
                  </span>
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => editar(categoria)}
                    disabled={cargando}
                    aria-label={`Editar ${categoria.nombre}`}
                    title="Editar"
                    className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void cambiarEstado(categoria)}
                    disabled={cargando}
                    aria-label={`${categoria.activa ? 'Desactivar' : 'Activar'} ${categoria.nombre}`}
                    title={categoria.activa ? 'Desactivar' : 'Activar'}
                    className={`${claseBotonIcono} ${categoria.activa ? 'text-danger hover:bg-danger/10' : 'text-success hover:bg-success/10'}`}
                  >
                    <Power className="size-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
          <form
            onSubmit={guardar}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-categoria"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-3xl bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-formulario-categoria" className="text-lg">
                  {idEdicion === null ? 'Nueva categoría' : 'Editar categoría'}
                </h2>
                <p className="text-sm text-muted">
                  {idEdicion === null ? 'Agregá una sección al menú.' : `Categoría #${idEdicion}`}
                </p>
              </div>
              <button type="button" onClick={limpiarFormulario} disabled={cargando} aria-label="Cerrar"
                className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}>
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="flex flex-col gap-2">
                <label htmlFor="nombre-categoria" className="text-sm">Nombre</label>
                <input id="nombre-categoria" value={formulario.nombre} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, nombre: evento.target.value }))}
                  disabled={cargando} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="orden-categoria" className="text-sm">Orden</label>
                <input id="orden-categoria" type="number" min="0" step="1" value={formulario.orden} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, orden: evento.target.value }))}
                  disabled={cargando} required />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="descripcion-categoria" className="text-sm">
                  Descripción <span className="text-muted">(opcional)</span>
                </label>
                <input id="descripcion-categoria" value={formulario.descripcion} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, descripcion: evento.target.value }))}
                  disabled={cargando} />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={limpiarFormulario} disabled={cargando}
                className={`${claseBotonSecundario} px-5 py-3`}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando} className={`${claseBotonAcento} py-3`}>
                {cargando ? 'Guardando...' : idEdicion === null ? 'Crear categoría' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
