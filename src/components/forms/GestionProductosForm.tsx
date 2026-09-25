'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Power, RotateCcw, Search, Store, Tags, X,
} from '@/components/icons'
import { IconoCategoria } from '@/components/icons/IconoCategoria'

type Producto = {
  idProducto: number
  nombre: string
  descripcion: string | null
  precio: number
  activo: boolean
  idCategoria: number
  categoria: { nombre: string }
  sucursales: {
    idSucursal: number
    disponible: boolean
    sucursal: { nombre: string }
  }[]
}

type Categoria = { idCategoria: number; nombre: string }
type Sucursal = { idSucursal: number; nombre: string }
type RespuestaListado = {
  productos: Producto[]
  categorias: Categoria[]
  sucursales: Sucursal[]
  total: number
  pagina: number
  limite: number
}
type RespuestaError = { error?: string }
type FiltroEstado = 'todos' | 'activos' | 'inactivos'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const filtrosEstado = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activos', texto: 'Activos' },
  { valor: 'inactivos', texto: 'Inactivos' },
] as const

const claseCampo =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60'
const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'
const claseBotonAcento =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

function claseChip(activo: boolean) {
  return `cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${activo ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`
}

const formularioVacio = {
  nombre: '',
  descripcion: '',
  precio: '',
  idCategoria: '',
  idSucursales: [] as string[],
}

export function GestionProductosForm() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [formulario, setFormulario] = useState(formularioVacio)
  const [idEdicion, setIdEdicion] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null)
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(20)
  const [total, setTotal] = useState(0)
  const [recarga, setRecarga] = useState(0)

  const totalPaginas = Math.max(1, Math.ceil(total / limite))

  useEffect(() => {
    let paginaActiva = true

    async function cargarListado() {
      setCargando(true)
      setError('')
      try {
        const parametros = new URLSearchParams({
          pagina: String(pagina),
          limite: String(limite),
          estado: filtroEstado,
        })
        if (busquedaAplicada) parametros.set('busqueda', busquedaAplicada)
        if (filtroCategoria !== null) parametros.set('idCategoria', String(filtroCategoria))

        const respuesta = await fetch(`/api/productos/gestion?${parametros}`, { cache: 'no-store' })
        const datos = await respuesta.json() as RespuestaListado & RespuestaError
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
        if (paginaActiva) {
          setProductos(datos.productos)
          setCategorias(datos.categorias)
          setSucursales(datos.sucursales)
          setTotal(datos.total)
          setLimite(datos.limite)
          const ultimaPagina = Math.max(1, Math.ceil(datos.total / datos.limite))
          if (pagina > ultimaPagina) setPagina(ultimaPagina)
        }
      } catch (errorDesconocido) {
        if (paginaActiva) {
          setError(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : 'No se pudieron cargar los productos.',
          )
        }
      } finally {
        if (paginaActiva) setCargando(false)
      }
    }

    void cargarListado()
    return () => {
      paginaActiva = false
    }
  }, [busquedaAplicada, filtroCategoria, filtroEstado, limite, pagina, recarga])

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

  function buscar(evento: FormEvent) {
    evento.preventDefault()
    const nuevaBusqueda = busqueda.trim()
    setPagina(1)
    setBusquedaAplicada(nuevaBusqueda)
    if (pagina === 1 && nuevaBusqueda === busquedaAplicada) {
      setRecarga((actual) => actual + 1)
    }
  }

  function cambiarFiltroEstado(estado: FiltroEstado) {
    setPagina(1)
    setFiltroEstado(estado)
  }

  function cambiarFiltroCategoria(idCategoria: number | null) {
    setPagina(1)
    setFiltroCategoria(idCategoria)
  }

  function cambiarCampo(campo: 'nombre' | 'descripcion' | 'precio' | 'idCategoria', valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }))
  }

  function cambiarSucursal(idSucursal: string, seleccionada: boolean) {
    setFormulario((actual) => ({
      ...actual,
      idSucursales: seleccionada
        ? [...actual.idSucursales, idSucursal]
        : actual.idSucursales.filter((id) => id !== idSucursal),
    }))
  }

  function cerrarFormulario() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
    setMostrarFormulario(false)
  }

  function abrirNuevoProducto() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
    setMensaje('')
    setError('')
    setMostrarFormulario(true)
  }

  function cargarParaEditar(producto: Producto) {
    setIdEdicion(producto.idProducto)
    setFormulario({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: String(producto.precio),
      idCategoria: String(producto.idCategoria),
      idSucursales: producto.sucursales.map((sucursal) => String(sucursal.idSucursal)),
    })
    setMensaje('')
    setError('')
    setMostrarFormulario(true)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (formulario.idSucursales.length === 0) {
      setError('Elegí al menos una sucursal para el producto.')
      return
    }
    setCargando(true)
    setMensaje('')
    setError('')

    try {
      const respuesta = await fetch(
        idEdicion === null ? '/api/productos/gestion' : `/api/productos/gestion/${idEdicion}`,
        {
          method: idEdicion === null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: formulario.nombre,
            descripcion: formulario.descripcion,
            precio: Number(formulario.precio),
            idCategoria: Number(formulario.idCategoria),
            idSucursales: formulario.idSucursales.map(Number),
          }),
        },
      )
      const datos = await respuesta.json() as RespuestaError
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar el producto.')
      setMensaje(idEdicion === null ? 'Producto creado.' : 'Producto actualizado.')
      cerrarFormulario()
      setRecarga((actual) => actual + 1)
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo guardar el producto.')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarEstado(producto: Producto) {
    setCargando(true)
    setMensaje('')
    setError('')

    try {
      const respuesta = await fetch(`/api/productos/gestion/${producto.idProducto}`, {
        method: producto.activo ? 'DELETE' : 'PATCH',
        headers: producto.activo ? undefined : { 'Content-Type': 'application/json' },
        body: producto.activo ? undefined : JSON.stringify({ activo: true }),
      })
      const datos = await respuesta.json() as RespuestaError
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cambiar el estado del producto.')
      setMensaje(producto.activo ? 'Producto desactivado.' : 'Producto activado.')
      setRecarga((actual) => actual + 1)
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
          <h1 className="page-title">Productos</h1>
          <p className="mt-1 text-sm text-muted">Administrá el menú y los productos disponibles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={claseBotonSecundario}
            onClick={() => router.push('/productos/categorias')} disabled={cargando}>
            <Tags className="size-4" />
            Categorías
          </button>
          <button type="button" className={claseBotonAcento} onClick={abrirNuevoProducto} disabled={cargando}>
            <Plus className="size-4" />
            Nuevo producto
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted/60 p-1 text-sm">
            {filtrosEstado.map(({ valor, texto }) => (
              <button
                key={valor}
                type="button"
                onClick={() => cambiarFiltroEstado(valor)}
                aria-pressed={filtroEstado === valor}
                className={claseChip(filtroEstado === valor)}
              >
                {texto}
              </button>
            ))}
          </div>
          <form onSubmit={buscar} role="search"
            className="flex w-full items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-4 shadow-sm sm:w-72">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por nombre o descripción"
              aria-label="Buscar producto"
              className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted"
            />
            <button type="submit" disabled={cargando}
              className="shrink-0 cursor-pointer rounded-full bg-accent-soft px-3 py-1 text-sm text-accent transition-colors hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-50">
              Buscar
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => cambiarFiltroCategoria(null)}
            aria-pressed={filtroCategoria === null} className={claseChip(filtroCategoria === null)}>
            Todas
          </button>
          {categorias.map((categoria) => (
            <button
              key={categoria.idCategoria}
              type="button"
              onClick={() => cambiarFiltroCategoria(categoria.idCategoria)}
              aria-pressed={filtroCategoria === categoria.idCategoria}
              className={claseChip(filtroCategoria === categoria.idCategoria)}
            >
              {categoria.nombre}
            </button>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-live="polite" aria-busy={cargando}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Mostrando <span className="text-text">{productos.length}</span> de{' '}
            <span className="text-text">{total}</span> productos
          </p>
          <button type="button" onClick={() => setRecarga((actual) => actual + 1)} disabled={cargando}
            className={claseBotonSecundario}>
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
        {cargando && productos.length === 0 && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando productos...</p>
        )}
        {!cargando && productos.length === 0 && !error && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">
            No hay productos que coincidan con los filtros.
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {productos.map((producto) => (
              <article
                key={producto.idProducto}
                className={`flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm transition-shadow hover:shadow-md ${producto.activo ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs ${producto.activo ? 'text-success' : 'text-muted'}`}>
                    <span className={`size-1.5 rounded-full ${producto.activo ? 'bg-success' : 'bg-order-delivered'}`} />
                    {producto.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="rounded-full bg-bg px-2.5 py-1 text-xs text-muted">
                    {producto.categoria.nombre}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <IconoCategoria categoria={producto.categoria.nombre} className="size-7" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="leading-tight">{producto.nombre}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {producto.descripcion || 'Sin descripción.'}
                    </p>
                  </div>
                </div>

                <p className="flex items-start gap-2 text-xs text-muted">
                  <Store className="size-4 shrink-0" />
                  <span>
                    {producto.sucursales.length > 0
                      ? producto.sucursales.map((sucursal) => sucursal.sucursal.nombre).join(', ')
                      : 'Sin sucursales disponibles'}
                  </span>
                </p>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                  <p className="text-lg font-bold">{formatoPrecio.format(producto.precio)}</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => cargarParaEditar(producto)}
                      disabled={cargando}
                      aria-label={`Editar ${producto.nombre}`}
                      title="Editar"
                      className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void cambiarEstado(producto)}
                      disabled={cargando}
                      aria-label={`${producto.activo ? 'Desactivar' : 'Activar'} ${producto.nombre}`}
                      title={producto.activo ? 'Desactivar' : 'Activar'}
                      className={`flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${producto.activo ? 'text-danger hover:bg-danger/10' : 'text-success hover:bg-success/10'}`}
                    >
                      <Power className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
          ))}
        </div>

        {totalPaginas > 1 && (
          <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={cargando || pagina <= 1}
              onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
              aria-label="Página anterior"
              className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface shadow-sm transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-text"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm text-muted">
              Página <span className="text-text">{pagina}</span> de {totalPaginas}
            </p>
            <button
              type="button"
              disabled={cargando || pagina >= totalPaginas}
              onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
              aria-label="Página siguiente"
              className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface shadow-sm transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-text"
            >
              <ChevronRight className="size-4" />
            </button>
          </nav>
        )}
      </section>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
          <form
            onSubmit={guardar}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-producto"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-3xl bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-formulario-producto" className="text-lg">
                  {idEdicion === null ? 'Nuevo producto' : 'Editar producto'}
                </h2>
                <p className="text-sm text-muted">
                  {idEdicion === null ? 'Cargá los datos del producto.' : `Producto #${idEdicion}`}
                </p>
              </div>
              <button type="button" onClick={cerrarFormulario} disabled={cargando} aria-label="Cerrar"
                className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="nombre" className="text-sm">Nombre</label>
                <input id="nombre" value={formulario.nombre} className={claseCampo}
                  onChange={(evento) => cambiarCampo('nombre', evento.target.value)} disabled={cargando} required />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="descripcion" className="text-sm">
                  Descripción <span className="text-muted">(opcional)</span>
                </label>
                <input id="descripcion" value={formulario.descripcion} className={claseCampo}
                  onChange={(evento) => cambiarCampo('descripcion', evento.target.value)} disabled={cargando} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="precio" className="text-sm">Precio</label>
                <input id="precio" type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={formulario.precio} className={claseCampo}
                  onChange={(evento) => cambiarCampo('precio', evento.target.value)} disabled={cargando} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="categoria" className="text-sm">Categoría</label>
                <div className="relative">
                  <select
                    id="categoria"
                    value={formulario.idCategoria}
                    onChange={(evento) => cambiarCampo('idCategoria', evento.target.value)}
                    disabled={cargando || categorias.length === 0}
                    required
                    className={`${claseCampo} cursor-pointer appearance-none pr-10`}
                  >
                    <option value="">Seleccioná una categoría</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.idCategoria} value={categoria.idCategoria}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
                </div>
                {categorias.length === 0 && (
                  <p className="text-xs text-danger">No hay categorías activas disponibles.</p>
                )}
              </div>

              <fieldset className="flex flex-col gap-2 sm:col-span-2">
                <legend className="mb-2 text-sm">Disponible en</legend>
                <div className="flex flex-wrap gap-2">
                  {sucursales.map((sucursal) => {
                    const idSucursal = String(sucursal.idSucursal)
                    return (
                      <label
                        key={sucursal.idSucursal}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text has-checked:border-accent has-checked:bg-accent-soft has-checked:text-text"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={formulario.idSucursales.includes(idSucursal)}
                          onChange={(evento) => cambiarSucursal(idSucursal, evento.target.checked)}
                          disabled={cargando}
                        />
                        <Store className="size-4" />
                        {sucursal.nombre}
                      </label>
                    )
                  })}
                </div>
                {sucursales.length === 0 && (
                  <p className="text-xs text-danger">No hay sucursales activas disponibles.</p>
                )}
              </fieldset>
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={cerrarFormulario} disabled={cargando}
                className={`${claseBotonSecundario} px-5 py-3`}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando || categorias.length === 0 || sucursales.length === 0}
                className={`${claseBotonAcento} py-3`}>
                {cargando ? 'Guardando...' : idEdicion === null ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

