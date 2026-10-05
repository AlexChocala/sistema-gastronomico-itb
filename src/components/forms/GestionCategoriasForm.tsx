'use client'

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, Package, Pencil, Plus, Power, X } from '@/components/icons'
import { IconoCategoria } from '@/components/icons/IconoCategoria'
import { MAX_NOMBRE_VARIACION, MAX_VARIACIONES } from '@/lib/productos/productos-validacion'
import { CATEGORIAS_SUGERIDAS, type CategoriaSugerida } from '@/lib/productos/sugerencias-categorias'
import type { RolNombre } from '@/types'

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
  nombresVariaciones: string[]
  // `extras` es opcional hasta que la API lo devuelva (ver lib/productos/extras-tipos.ts).
  _count: { productos: number; extras?: number }
}

function textoExtras(cantidad: number | undefined) {
  if (cantidad === undefined) return 'Extras'
  if (cantidad === 0) return 'Agregar extras'
  return `${cantidad} ${cantidad === 1 ? 'extra' : 'extras'}`
}

type RespuestaCategorias = { categorias: Categoria[] }
type RespuestaError = { error?: string }

const formularioVacio = { nombre: '', descripcion: '', orden: '', nombresVariaciones: [] as string[] }

// Nombres de variaciones de la categoría: se agregan uno por uno, se ordenan arrastrando
// desde el ícono (o con las flechas del teclado sobre él) y se quitan con la X. La
// primera es la principal de la carta.
function CampoNombresVariaciones({
  nombres,
  onCambiar,
  deshabilitado,
}: {
  nombres: string[]
  onCambiar: (nombres: string[]) => void
  deshabilitado: boolean
}) {
  const [nuevo, setNuevo] = useState('')
  const texto = nuevo.trim()
  const repetido = nombres.some((nombre) => nombre.toLowerCase() === texto.toLowerCase())
  const puedeAgregar = texto !== '' && !repetido && nombres.length < MAX_VARIACIONES

  function agregar() {
    if (!puedeAgregar) return
    onCambiar([...nombres, texto])
    setNuevo('')
  }

  // Nombre que se está arrastrando (null = ninguno) y las filas, para medir sus posiciones.
  const [arrastrado, setArrastrado] = useState<string | null>(null)
  const filas = useRef(new Map<string, HTMLLIElement>())

  function moverA(nombre: string, destino: number) {
    const resto = nombres.filter((otro) => otro !== nombre)
    const lista = [...resto.slice(0, destino), nombre, ...resto.slice(destino)]
    if (lista.some((otro, indice) => otro !== nombres[indice])) onCambiar(lista)
  }

  // Mientras se arrastra, la fila va al lugar donde está el puntero: antes de la primera
  // fila cuya mitad queda por debajo de él. Así se ve moverse en vivo.
  function alArrastrar(evento: PointerEvent<HTMLButtonElement>) {
    if (arrastrado === null) return
    const otras = nombres.filter((nombre) => nombre !== arrastrado)
    const destino = otras.findIndex((nombre) => {
      const caja = filas.current.get(nombre)?.getBoundingClientRect()
      return caja !== undefined && evento.clientY < caja.top + caja.height / 2
    })
    moverA(arrastrado, destino === -1 ? otras.length : destino)
  }

  const claseBotonFila =
    'flex size-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text disabled:cursor-default disabled:opacity-30'

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="nueva-variacion" className="text-sm">
        Variaciones <span className="text-muted">(opcional)</span>
      </label>
      <p className="text-xs text-muted">
        Tamaño o cantidad que suelen tener sus productos (ej: Entera, Media). En cada producto elegís
        cuáles usa y les ponés el precio. <span className="text-text">La primera es la principal:</span> la
        que se muestra en la carta y viene elegida. Arrastralas desde el ícono para ordenarlas.
      </p>
      {nombres.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {nombres.map((nombre, indice) => (
            <li
              key={nombre}
              ref={(fila) => {
                if (fila) filas.current.set(nombre, fila)
                else filas.current.delete(nombre)
              }}
              className={`relative flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-1.5 text-sm transition-[background-color,box-shadow] ${arrastrado === nombre ? 'z-10 bg-surface shadow-lg ring-2 ring-accent/40' : 'bg-bg'}`}
            >
              <button
                type="button"
                disabled={deshabilitado || nombres.length < 2}
                aria-label={`Mover ${nombre} (posición ${indice + 1} de ${nombres.length}). Arrastrá o usá las flechas del teclado.`}
                // touch-none: en el celular, arrastrar mueve la fila en vez de desplazar la página.
                className={`${claseBotonFila} cursor-grab touch-none active:cursor-grabbing`}
                onPointerDown={(evento) => {
                  evento.currentTarget.setPointerCapture(evento.pointerId)
                  setArrastrado(nombre)
                }}
                onPointerMove={alArrastrar}
                onPointerUp={() => setArrastrado(null)}
                onPointerCancel={() => setArrastrado(null)}
                onKeyDown={(evento) => {
                  if (evento.key === 'ArrowUp' && indice > 0) {
                    evento.preventDefault()
                    moverA(nombre, indice - 1)
                  } else if (evento.key === 'ArrowDown' && indice < nombres.length - 1) {
                    evento.preventDefault()
                    moverA(nombre, indice + 1)
                  }
                }}
              >
                <GripVertical className="size-4" />
              </button>
              <span className="flex-1 truncate">{nombre}</span>
              {indice === 0 && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Principal</span>
              )}
              <button
                type="button"
                onClick={() => onCambiar(nombres.filter((otro) => otro !== nombre))}
                disabled={deshabilitado}
                aria-label={`Quitar ${nombre}`}
                className={`${claseBotonFila} hover:text-danger`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <input
          id="nueva-variacion"
          value={nuevo}
          maxLength={MAX_NOMBRE_VARIACION}
          placeholder="Ej: Docena"
          className={claseCampo}
          disabled={deshabilitado || nombres.length >= MAX_VARIACIONES}
          onChange={(evento) => setNuevo(evento.target.value)}
          onKeyDown={(evento) => {
            // Enter agrega la variación en lugar de enviar el formulario.
            if (evento.key === 'Enter') {
              evento.preventDefault()
              agregar()
            }
          }}
        />
        <button type="button" onClick={agregar} disabled={deshabilitado || !puedeAgregar} className={claseBotonSecundario}>
          <Plus className="size-4" />
          Agregar
        </button>
      </div>
      {repetido && texto !== '' && <p className="text-xs text-danger">Esa variación ya está en la lista.</p>}
      {nombres.length >= MAX_VARIACIONES && (
        <p className="text-xs text-muted">Podés cargar hasta {MAX_VARIACIONES} variaciones.</p>
      )}
    </div>
  )
}

async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  if (!respuesta.headers.get('content-type')?.includes('application/json')) {
    throw new Error('El servidor no devolvió una respuesta válida. Reiniciá la aplicación e intentá nuevamente.')
  }
  return respuesta.json() as Promise<T>
}

export function GestionCategoriasForm({ rol }: { rol: RolNombre }) {
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

  // Una categoría nueva va al final del menú (el orden se puede cambiar).
  function abrirNueva() {
    const siguienteOrden = Math.max(0, ...categorias.map((categoria) => categoria.orden)) + 1
    setFormulario({ ...formularioVacio, orden: String(siguienteOrden) })
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
      nombresVariaciones: categoria.nombresVariaciones,
    })
    setMensaje('')
    setError('')
  }

  // Completa el nombre y sus variaciones típicas; el resto del formulario no se toca.
  function usarSugerencia(sugerida: CategoriaSugerida) {
    setFormulario((actual) => ({ ...actual, nombre: sugerida.nombre, nombresVariaciones: [...sugerida.nombresVariaciones] }))
  }

  // Sugerencias que todavía no existen como categoría (sin distinguir mayúsculas).
  const sugerenciasDisponibles = CATEGORIAS_SUGERIDAS.filter(
    (sugerida) => !categorias.some((categoria) => categoria.nombre.toLowerCase() === sugerida.nombre.toLowerCase()),
  )

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
            nombresVariaciones: formulario.nombresVariaciones,
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
        <button type="button" className={`${claseBotonAcento} self-start`} onClick={abrirNueva} disabled={cargando}>
          <Plus className="size-4" />
          Nueva categoría
        </button>
      </header>

      <section className="flex flex-col gap-4" aria-live="polite" aria-busy={cargando}>
        <p className="text-sm text-muted">
          <span className="font-medium text-text">{categorias.length}</span>{' '}
          {categorias.length === 1 ? 'categoría' : 'categorías'}
        </p>

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
                  <span className={`size-1.5 rounded-full ${categoria.activa ? 'bg-success' : 'bg-muted'}`} />
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

              {categoria.nombresVariaciones.length > 0 && (
                <p className="text-xs text-muted">
                  Variaciones: <span className="text-text">{categoria.nombresVariaciones.join(' · ')}</span>
                </p>
              )}

        {(rol === 'admin' || rol === 'supervisor') && categoria.activa && (
                <button
                  type="button"
                  onClick={() => router.push(`/productos/extras?categoria=${categoria.idCategoria}`)}
                  className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <Plus className="size-4" />
                  {textoExtras(categoria._count.extras)}
                </button>
              )}

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

            {idEdicion === null && sugerenciasDisponibles.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Sugeridas</p>
                <div className="flex flex-wrap gap-2">
                  {sugerenciasDisponibles.map((sugerida) => {
                    const elegida = formulario.nombre.trim().toLowerCase() === sugerida.nombre.toLowerCase()
                    return (
                      <button
                        key={sugerida.nombre}
                        type="button"
                        onClick={() => usarSugerencia(sugerida)}
                        disabled={cargando}
                        aria-pressed={elegida}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm transition-colors ${elegida ? 'border-accent bg-accent-soft' : 'border-border text-muted hover:text-text'}`}
                      >
                        <IconoCategoria categoria={sugerida.nombre} className="size-4 text-accent" />
                        {sugerida.nombre}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted">Tocá una para completar el nombre y sus variaciones, o escribí la tuya.</p>
              </div>
            )}

            {/* De lo que se completa siempre a lo que casi nunca se toca. */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="nombre-categoria" className="text-sm">Nombre</label>
                <input id="nombre-categoria" value={formulario.nombre} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, nombre: evento.target.value }))}
                  disabled={cargando} required />
              </div>
              <CampoNombresVariaciones
                nombres={formulario.nombresVariaciones}
                onCambiar={(nombresVariaciones) => setFormulario((actual) => ({ ...actual, nombresVariaciones }))}
                deshabilitado={cargando}
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="descripcion-categoria" className="text-sm">
                  Descripción <span className="text-muted">(opcional)</span>
                </label>
                <input id="descripcion-categoria" value={formulario.descripcion} className={claseCampo}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, descripcion: evento.target.value }))}
                  disabled={cargando} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="orden-categoria" className="text-sm">
                  Posición en el menú
                  <span className="block text-xs text-muted">Las categorías se muestran de menor a mayor.</span>
                </label>
                <input id="orden-categoria" type="number" min="0" step="1" value={formulario.orden}
                  className={`${claseCampo} w-24! text-center`}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, orden: evento.target.value }))}
                  disabled={cargando} required />
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
