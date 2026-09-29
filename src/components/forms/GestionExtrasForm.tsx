'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Pencil, Plus, Power, RotateCcw, X } from '@/components/icons'
import { Aviso } from '@/components/ui/Aviso'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'
import { crearExtra, desactivarExtra, editarExtra, listarExtras } from '@/lib/productos/extras-api'
import type { Extra, RespuestaListadoExtras } from '@/lib/productos/extras-tipos'

const claseCampo =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60'
const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'
const claseBotonAcento =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'
const claseBotonIcono =
  'flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50'

function claseChip(activo: boolean) {
  return `inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${activo ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`
}

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function textoPrecio(precio: number) {
  return precio > 0 ? `+${formatoPrecio.format(precio)}` : 'Sin cargo'
}

const sinDatos: RespuestaListadoExtras = { categorias: [], productos: [], extras: [] }
const formularioVacio = { nombre: '', precioAdicional: '', idProductos: [] as number[] }

function mensajeDeError(error: unknown, alternativo: string) {
  return error instanceof Error ? error.message : alternativo
}

// Conserva la categoría elegida si sigue activa; si no, la pedida por URL o la primera.
function categoriaValida(datos: RespuestaListadoExtras, ...candidatas: (number | null)[]) {
  const ids = datos.categorias.map((categoria) => categoria.idCategoria)
  return candidatas.find((id) => id !== null && ids.includes(id)) ?? ids[0] ?? null
}

export function GestionExtrasForm({ idCategoriaInicial }: { idCategoriaInicial: number | null }) {
  const router = useRouter()
  const [datos, setDatos] = useState(sinDatos)
  const [esEjemplo, setEsEjemplo] = useState(false)
  const [idCategoria, setIdCategoria] = useState<number | null>(idCategoriaInicial)
  const [formulario, setFormulario] = useState(formularioVacio)
  const [idEdicion, setIdEdicion] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const cerrarMensaje = useCallback(() => setMensaje(''), [])

  const categoria = datos.categorias.find((actual) => actual.idCategoria === idCategoria)
  const extrasDeCategoria = datos.extras.filter((extra) => extra.idCategoria === idCategoria)
  const productosDeCategoria = datos.productos.filter((producto) => producto.idCategoria === idCategoria)
  const todosMarcados = productosDeCategoria.every((producto) => formulario.idProductos.includes(producto.idProducto))

  async function listar() {
    setCargando(true)
    setError('')
    try {
      const resultado = await listarExtras()
      setDatos(resultado.datos)
      setEsEjemplo(resultado.esEjemplo)
      setIdCategoria((actual) => categoriaValida(resultado.datos, actual, idCategoriaInicial))
    } catch (errorDesconocido) {
      setError(mensajeDeError(errorDesconocido, 'No se pudieron cargar los extras.'))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    let paginaActiva = true
    async function cargarInicial() {
      try {
        const resultado = await listarExtras()
        if (paginaActiva) {
          setDatos(resultado.datos)
          setEsEjemplo(resultado.esEjemplo)
          setIdCategoria(categoriaValida(resultado.datos, idCategoriaInicial))
        }
      } catch (errorDesconocido) {
        if (paginaActiva) setError(mensajeDeError(errorDesconocido, 'No se pudieron cargar los extras.'))
      } finally {
        if (paginaActiva) setCargando(false)
      }
    }
    void cargarInicial()
    return () => { paginaActiva = false }
  }, [idCategoriaInicial])

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

  function elegirCategoria(id: number) {
    setIdCategoria(id)
    // En la URL, para que al recargar se quede en la misma categoría. history nativo y no
    // router.replace: así no se vuelve a renderizar la página en el servidor.
    window.history.replaceState(null, '', `?categoria=${id}`)
  }

  function limpiarFormulario() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
    setError('')
    setMostrarFormulario(false)
  }

  function abrirNuevo() {
    // Lo normal es que un extra nuevo sirva para toda la categoría: se desmarcan las excepciones.
    setFormulario({ ...formularioVacio, idProductos: productosDeCategoria.map((producto) => producto.idProducto) })
    setIdEdicion(null)
    setMensaje('')
    setError('')
    setMostrarFormulario(true)
  }

  function editar(extra: Extra) {
    setIdEdicion(extra.idExtra)
    setFormulario({
      nombre: extra.nombre,
      precioAdicional: String(extra.precioAdicional),
      idProductos: extra.productos.map((producto) => producto.idProducto),
    })
    setMensaje('')
    setError('')
    setMostrarFormulario(true)
  }

  function cambiarProducto(idProducto: number, marcado: boolean) {
    setFormulario((actual) => ({
      ...actual,
      idProductos: marcado ? [...actual.idProductos, idProducto] : actual.idProductos.filter((id) => id !== idProducto),
    }))
  }

  function marcarTodos() {
    setFormulario((actual) => ({
      ...actual,
      idProductos: todosMarcados ? [] : productosDeCategoria.map((producto) => producto.idProducto),
    }))
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (idCategoria === null) return
    setCargando(true)
    setMensaje('')
    setError('')
    try {
      const cambios = {
        nombre: formulario.nombre,
        precioAdicional: Number(formulario.precioAdicional),
        idProductos: formulario.idProductos,
      }
      if (idEdicion === null) await crearExtra({ idCategoria, ...cambios })
      else await editarExtra(idEdicion, cambios)
      setMensaje(idEdicion === null ? 'Extra creado.' : 'Extra actualizado.')
      limpiarFormulario()
      await listar()
    } catch (errorDesconocido) {
      setError(mensajeDeError(errorDesconocido, 'No se pudo guardar el extra.'))
    } finally {
      setCargando(false)
    }
  }

  async function cambiarEstado(extra: Extra) {
    setCargando(true)
    setMensaje('')
    setError('')
    try {
      if (extra.activo) await desactivarExtra(extra.idExtra)
      else await editarExtra(extra.idExtra, { activo: true })
      setMensaje(extra.activo ? 'Extra desactivado.' : 'Extra activado.')
      await listar()
    } catch (errorDesconocido) {
      setError(mensajeDeError(errorDesconocido, 'No se pudo cambiar el estado del extra.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Extras</h1>
          <p className="mt-1 text-sm text-muted">
            Agregados que el cliente puede sumar. Cada categoría tiene los suyos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={claseBotonSecundario} onClick={() => router.push('/productos')}>
            <ArrowLeft className="size-4" />
            Productos
          </button>
          <button type="button" className={claseBotonAcento} onClick={abrirNuevo} disabled={cargando || !categoria}>
            <Plus className="size-4" />
            Nuevo extra
          </button>
        </div>
      </header>

      {esEjemplo && (
        <Aviso tipo="info" titulo="Datos de ejemplo">
          Los extras todavía no están conectados con la base: los cambios son de prueba y se pierden al recargar.
        </Aviso>
      )}
      {error && !mostrarFormulario && (
        <Aviso tipo="error" onCerrar={() => setError('')}>{error}</Aviso>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categorías">
          {datos.categorias.map((actual) => (
            <button
              key={actual.idCategoria}
              type="button"
              role="tab"
              aria-selected={actual.idCategoria === idCategoria}
              onClick={() => elegirCategoria(actual.idCategoria)}
              className={claseChip(actual.idCategoria === idCategoria)}
            >
              {actual.nombre}
              <span className="rounded-full bg-bg px-2 text-xs text-muted tabular-nums">
                {datos.extras.filter((extra) => extra.idCategoria === actual.idCategoria).length}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={claseBotonSecundario} onClick={() => void listar()} disabled={cargando}>
          <RotateCcw className={`size-4 ${cargando ? 'animate-spin [animation-direction:reverse]' : ''}`} />
          Actualizar
        </button>
      </div>

      <section className="flex flex-col gap-4" aria-busy={cargando}>
        {cargando && datos.categorias.length === 0 && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando extras...</p>
        )}
        {!cargando && datos.categorias.length === 0 && !error && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">
            No hay categorías activas. Creá una en Categorías para cargarle extras.
          </p>
        )}
        {categoria && extrasDeCategoria.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-10 text-center">
            <p>{categoria.nombre} no tiene extras.</p>
            <p className="max-w-md text-sm text-muted">
              Si sus productos no llevan agregados (como las bebidas), no hace falta cargar nada.
            </p>
            <button type="button" className={claseBotonSecundario} onClick={abrirNuevo} disabled={cargando}>
              <Plus className="size-4" />
              Agregar un extra a {categoria.nombre}
            </button>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {extrasDeCategoria.map((extra) => (
            <article
              key={extra.idExtra}
              className={`flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm transition-shadow hover:shadow-md ${extra.activo ? '' : 'opacity-60'}`}
            >
              <span className={`inline-flex items-center gap-1.5 text-xs ${extra.activo ? 'text-success' : 'text-muted'}`}>
                <span className={`size-1.5 rounded-full ${extra.activo ? 'bg-success' : 'bg-muted'}`} />
                {extra.activo ? 'Activo' : 'Inactivo'}
              </span>

              <div className="min-w-0">
                <h3 className="leading-tight">{extra.nombre}</h3>
                <p className="mt-0.5 text-sm text-muted tabular-nums">{textoPrecio(extra.precioAdicional)}</p>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                <p className="inline-flex items-center gap-2 text-sm text-muted">
                  <Package className="size-4" />
                  <span>
                    <span className="font-bold text-text">{extra.productos.length}</span> de {productosDeCategoria.length}{' '}
                    {productosDeCategoria.length === 1 ? 'producto' : 'productos'}
                  </span>
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => editar(extra)}
                    disabled={cargando}
                    aria-label={`Editar ${extra.nombre}`}
                    title="Editar"
                    className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void cambiarEstado(extra)}
                    disabled={cargando}
                    aria-label={`${extra.activo ? 'Desactivar' : 'Activar'} ${extra.nombre}`}
                    title={extra.activo ? 'Desactivar' : 'Activar'}
                    className={`${claseBotonIcono} ${extra.activo ? 'text-danger hover:bg-danger/10' : 'text-success hover:bg-success/10'}`}
                  >
                    <Power className="size-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {mostrarFormulario && categoria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
          <form
            onSubmit={guardar}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-extra"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-3xl bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-formulario-extra" className="text-lg">
                  {idEdicion === null ? 'Nuevo extra' : 'Editar extra'}
                </h2>
                <p className="text-sm text-muted">Para {categoria.nombre}</p>
              </div>
              <button type="button" onClick={limpiarFormulario} disabled={cargando} aria-label="Cerrar"
                className={`${claseBotonIcono} text-muted hover:bg-bg hover:text-text`}>
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div className="flex flex-col gap-2">
                <label htmlFor="nombre-extra" className="text-sm">Nombre</label>
                <input id="nombre-extra" value={formulario.nombre} maxLength={80} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, nombre: evento.target.value }))}
                  disabled={cargando} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="precio-extra" className="text-sm">Precio adicional</label>
                <input id="precio-extra" type="number" inputMode="decimal" min="0" step="0.01"
                  value={formulario.precioAdicional} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, precioAdicional: evento.target.value }))}
                  disabled={cargando} required />
              </div>
              <p className="text-xs text-muted sm:col-span-2">Poné 0 si el extra no tiene cargo.</p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 flex w-full items-center justify-between gap-3 text-sm">
                ¿Qué productos lo admiten?
                {productosDeCategoria.length > 1 && (
                  <button type="button" onClick={marcarTodos} disabled={cargando}
                    className="cursor-pointer text-accent hover:underline disabled:cursor-not-allowed">
                    {todosMarcados ? 'Quitar todos' : 'Marcar todos'}
                  </button>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {productosDeCategoria.map((producto) => (
                  <label
                    key={producto.idProducto}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text has-checked:border-accent has-checked:bg-accent-soft has-checked:text-text"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formulario.idProductos.includes(producto.idProducto)}
                      onChange={(evento) => cambiarProducto(producto.idProducto, evento.target.checked)}
                      disabled={cargando}
                    />
                    {producto.nombre}
                  </label>
                ))}
              </div>
              {productosDeCategoria.length === 0 && (
                <p className="text-xs text-muted">
                  {categoria.nombre} todavía no tiene productos activos. Podés asignarlo después desde cada producto.
                </p>
              )}
            </fieldset>

            {error && <Aviso tipo="error">{error}</Aviso>}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={limpiarFormulario} disabled={cargando}
                className={`${claseBotonSecundario} px-5 py-3`}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando} className={`${claseBotonAcento} py-3`}>
                {cargando ? 'Guardando...' : idEdicion === null ? 'Crear extra' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {mensaje && <AvisoFlotante mensaje={mensaje} onCerrar={cerrarMensaje} />}
    </div>
  )
}
