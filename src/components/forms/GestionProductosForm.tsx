'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Package, Pencil, Plus, Power, Search, Store, X,
} from '@/components/icons'
import { IconoCategoria } from '@/components/icons/IconoCategoria'
import { CampoVariaciones } from '@/components/productos/CampoVariaciones'
import { CrearCategoriaRapida } from '@/components/productos/CrearCategoriaRapida'
import { CampoFotoProducto } from '@/components/productos/CampoFotoProducto'
import { CrearExtraRapido } from '@/components/productos/CrearExtraRapido'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { Aviso } from '@/components/ui/Aviso'
import { Desplegable } from '@/components/ui/Desplegable'
import { ExportarImportar } from '@/components/ui/ExportarImportar'
import type { CategoriaCreada } from '@/lib/productos/categorias-api'
import { extrasDisponiblesDeEjemplo } from '@/lib/productos/extras-api'
import type { ExtraAsignado, ExtraDisponible } from '@/lib/productos/extras-tipos'
import {
  armarVariaciones, filaPrincipal, filasIniciales, filasParaCategoria,
  type FilaVariacion, type VariacionGuardada,
} from '@/lib/productos/variaciones-formulario'
import { ordenarVariaciones, variacionPrincipal } from '@/lib/productos/variacion-principal'
import { hoyEnArgentina } from '@/lib/reportes/fechas'
import { quitarImagen, subirImagen, validarImagen } from '@/lib/storage/imagenes-cliente'
import type { DatosExportables } from '@/lib/utils/exportar'
import type { RolNombre } from '@/types'

type Producto = {
  idProducto: number
  nombre: string
  descripcion: string | null
  precio: number
  activo: boolean
  idCategoria: number
  categoria: { nombre: string }
  // URL pública de la foto (Supabase Storage); null si no tiene.
  imagenUrl?: string | null
  sucursales: {
    idSucursal: number
    disponible: boolean
    sucursal: { nombre: string }
  }[]
  // Opcional hasta que la API de productos devuelva los extras (ver extras-tipos.ts).
  extras?: ExtraAsignado[]
  // Las vigentes, de la más barata a la más cara.
  variaciones: VariacionGuardada[]
}

type Categoria = { idCategoria: number; nombre: string; nombresVariaciones: string[] }
type Sucursal = { idSucursal: number; nombre: string }
type RespuestaListado = {
  productos: Producto[]
  categorias: Categoria[]
  sucursales: Sucursal[]
  extras?: ExtraDisponible[]
  total: number
  pagina: number
  limite: number
}
type RespuestaError = { error?: string }
type FiltroEstado = 'todos' | 'activos' | 'inactivos'
const OPCIONES_ESTADO: { valor: FiltroEstado; texto: string }[] = [
  { valor: 'todos', texto: 'Todos los estados' },
  { valor: 'activos', texto: 'Solo activos' },
  { valor: 'inactivos', texto: 'Solo inactivos' },
]

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const claseCampo =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60'
const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'
const claseBotonAcento =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

function claseChip(activo: boolean) {
  return `cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${activo ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`
}

type FiltrosListado = { estado: FiltroEstado; busqueda: string; idCategoria: number | null; idSucursal: number | null }

function parametrosDelListado(pagina: number, limite: number, filtros: FiltrosListado) {
  const parametros = new URLSearchParams({ pagina: String(pagina), limite: String(limite), estado: filtros.estado })
  if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda)
  if (filtros.idCategoria !== null) parametros.set('idCategoria', String(filtros.idCategoria))
  if (filtros.idSucursal !== null) parametros.set('idSucursal', String(filtros.idSucursal))
  return parametros
}

// La API devuelve hasta 100 productos por página.
const LIMITE_EXPORTAR = 100

const COLUMNAS_EXPORTAR = ['ID', 'Nombre', 'Descripción', 'Categoría', 'Precio', 'Estado', 'Sucursales']

const formularioVacio = {
  nombre: '',
  descripcion: '',
  precio: '',
  idCategoria: '',
  idSucursales: [] as string[],
  idExtras: [] as string[],
  variaciones: [] as FilaVariacion[],
}

export function GestionProductosForm({ rol }: { rol: RolNombre }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [extras, setExtras] = useState<ExtraDisponible[]>([])
  // Mientras la API no devuelva `extras`, se muestran los de ejemplo y no se envían:
  // hoy la validación de productos rechaza campos desconocidos.
  const [extrasDeEjemplo, setExtrasDeEjemplo] = useState(false)
  const [formulario, setFormulario] = useState(formularioVacio)
  const [idEdicion, setIdEdicion] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  // Panel "Nueva categoría" abierto en el formulario: bloquea el resto hasta crearla.
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const bloqueadoPorCategoria = creandoCategoria || categorias.length === 0
  // Foto del producto: se sube o se quita recién al guardar (ver guardar()).
  const [fotoActual, setFotoActual] = useState<string | null>(null)
  const [fotoNueva, setFotoNueva] = useState<File | null>(null)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null)
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(20)
  const [total, setTotal] = useState(0)
  const [recarga, setRecarga] = useState(0)
  // Por defecto, productos de la sucursal activa. Solo el admin puede ver el catálogo
  // completo (incluye productos sin sucursal, para poder asignarles una).
  const { sucursal, puedeElegir } = useSucursalActiva()
  const [verTodasLasSucursales, setVerTodasLasSucursales] = useState(false)
  const idSucursalFiltro = puedeElegir && verTodasLasSucursales ? null : (sucursal?.idSucursal ?? null)

  const totalPaginas = Math.max(1, Math.ceil(total / limite))
  const extrasDeCategoria = extras.filter((extra) => String(extra.idCategoria) === formulario.idCategoria)
  const categoriaElegida = categorias.find((categoria) => String(categoria.idCategoria) === formulario.idCategoria)
  // Con variaciones elegidas, el precio sale de ellas y la carta muestra la principal.
  const principal = filaPrincipal(formulario.variaciones)

  useEffect(() => {
    let paginaActiva = true

    async function cargarListado() {
      setCargando(true)
      setError('')
      try {
        const parametros = parametrosDelListado(pagina, limite, {
          estado: filtroEstado, busqueda: busquedaAplicada, idCategoria: filtroCategoria, idSucursal: idSucursalFiltro,
        })

        const respuesta = await fetch(`/api/productos/gestion?${parametros}`, { cache: 'no-store' })
        const datos = await respuesta.json() as RespuestaListado & RespuestaError
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
        if (paginaActiva) {
          setProductos(datos.productos)
          setCategorias(datos.categorias)
          setSucursales(datos.sucursales)
          setExtras(datos.extras ?? extrasDisponiblesDeEjemplo())
          setExtrasDeEjemplo(datos.extras === undefined)
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
  }, [busquedaAplicada, filtroCategoria, filtroEstado, idSucursalFiltro, limite, pagina, recarga])

  // El modal del formulario se cierra con Escape (salvo mientras guarda).
  useEffect(() => {
    if (!mostrarFormulario) return
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key !== 'Escape' || cargando) return
      setFormulario(formularioVacio)
      setIdEdicion(null)
      setCreandoCategoria(false)
      reiniciarFoto(null)
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

  function cambiarCampo(campo: 'nombre' | 'descripcion' | 'precio', valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }))
  }

  // Cada categoría tiene sus extras y sus variaciones: al cambiarla se habilitan todos los
  // de la nueva (lo más común) y se desmarcan las excepciones.
  // `nombres` se pasa cuando la categoría se acaba de crear y todavía no está en `categorias`.
  function cambiarCategoria(idCategoria: string, nombres = categorias.find((categoria) => String(categoria.idCategoria) === idCategoria)?.nombresVariaciones ?? []) {
    setFormulario((actual) => ({
      ...actual,
      idCategoria,
      idExtras: extras.filter((extra) => String(extra.idCategoria) === idCategoria).map((extra) => String(extra.idExtra)),
      variaciones: filasParaCategoria(nombres, actual.variaciones),
    }))
  }

  // Creada desde el formulario (CrearCategoriaRapida): se suma a la lista y queda elegida.
  function agregarCategoriaCreada(categoria: CategoriaCreada) {
    setCategorias((actuales) => [...actuales, categoria])
    cambiarCategoria(String(categoria.idCategoria), categoria.nombresVariaciones)
    setCreandoCategoria(false)
  }

  // Elegir una categoría que ya existe cancela la creación de una nueva.
  function elegirCategoriaExistente(idCategoria: string) {
    setCreandoCategoria(false)
    cambiarCategoria(idCategoria)
  }

  // Creado desde el formulario (CrearExtraRapido): se suma a los de la categoría y queda tildado.
  function agregarExtraCreado(extra: ExtraDisponible) {
    setExtras((actuales) => [...actuales, extra])
    cambiarSeleccion('idExtras', String(extra.idExtra), true)
  }

  function cambiarSeleccion(campo: 'idSucursales' | 'idExtras', id: string, seleccionado: boolean) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: seleccionado ? [...actual[campo], id] : actual[campo].filter((otro) => otro !== id),
    }))
  }

  function reiniciarFoto(actual: string | null) {
    setFotoActual(actual)
    setFotoNueva(null)
    setQuitarFoto(false)
    setErrorFoto('')
  }

  // Se valida al elegir (tipo y tamaño) para avisar al toque; el servidor vuelve a validar.
  function elegirFoto(archivo: File) {
    const invalida = validarImagen(archivo)
    setErrorFoto(invalida ?? '')
    if (invalida) return
    setFotoNueva(archivo)
    setQuitarFoto(false)
  }

  // Quitar una foto recién elegida vuelve a la guardada; quitar la guardada la marca para borrar.
  function quitarFotoElegida() {
    setErrorFoto('')
    if (fotoNueva) setFotoNueva(null)
    else setQuitarFoto(true)
  }

  function cerrarFormulario() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
    setCreandoCategoria(false)
    reiniciarFoto(null)
    setMostrarFormulario(false)
  }

  // Un producto nuevo arranca disponible en la sucursal en la que se está trabajando.
  function abrirNuevoProducto() {
    const enSucursalActiva = sucursales.some((otra) => otra.idSucursal === sucursal?.idSucursal)
    setFormulario({ ...formularioVacio, idSucursales: enSucursalActiva && sucursal ? [String(sucursal.idSucursal)] : [] })
    setIdEdicion(null)
    setMensaje('')
    setError('')
    setCreandoCategoria(false)
    reiniciarFoto(null)
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
      idExtras: (producto.extras ?? []).map((extra) => String(extra.idExtra)),
      variaciones: filasIniciales(
        categorias.find((categoria) => categoria.idCategoria === producto.idCategoria)?.nombresVariaciones ?? [],
        producto,
      ),
    })
    setMensaje('')
    setError('')
    setCreandoCategoria(false)
    reiniciarFoto(producto.imagenUrl ?? null)
    setMostrarFormulario(true)
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (formulario.idSucursales.length === 0) {
      setError('Elegí al menos una sucursal para el producto.')
      return
    }
    const resultadoVariaciones = armarVariaciones(formulario.variaciones)
    if ('error' in resultadoVariaciones) {
      setError(resultadoVariaciones.error)
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
            // Con variaciones, el precio del producto es el de la más barata.
            precio: resultadoVariaciones.precio ?? Number(formulario.precio),
            idCategoria: Number(formulario.idCategoria),
            idSucursales: formulario.idSucursales.map(Number),
            ...(extrasDeEjemplo ? {} : { idExtras: formulario.idExtras.map(Number) }),
            variaciones: resultadoVariaciones.variaciones,
          }),
        },
      )
      const datos = await respuesta.json() as RespuestaError & { producto?: { idProducto: number } }
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar el producto.')

      // La foto va después: necesita el id (en un producto nuevo recién existe ahora). Si
      // falla, el producto ya quedó guardado y se avisa para reintentar desde Editar.
      const idProducto = idEdicion ?? datos.producto?.idProducto
      let avisoFoto = ''
      if (idProducto && (fotoNueva || (quitarFoto && fotoActual))) {
        const endpoint = `/api/productos/gestion/${idProducto}/imagen`
        try {
          if (fotoNueva) await subirImagen(endpoint, fotoNueva)
          else await quitarImagen(endpoint)
        } catch (errorFotoDesconocido) {
          const detalle = errorFotoDesconocido instanceof Error ? errorFotoDesconocido.message : ''
          avisoFoto = `El producto se guardó, pero no la foto. ${detalle} Probá de nuevo desde Editar.`
        }
      }

      setMensaje(idEdicion === null ? 'Producto creado.' : 'Producto actualizado.')
      if (avisoFoto) setError(avisoFoto)
      cerrarFormulario()
      setRecarga((actual) => actual + 1)
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo guardar el producto.')
    } finally {
      setCargando(false)
    }
  }

  // Todas las páginas con los filtros que están elegidos, no solo la que se ve.
  async function obtenerProductosParaExportar(): Promise<DatosExportables> {
    const filtros = { estado: filtroEstado, busqueda: busquedaAplicada, idCategoria: filtroCategoria, idSucursal: idSucursalFiltro }
    const todos: Producto[] = []
    for (let paginaPedida = 1; ; paginaPedida++) {
      const respuesta = await fetch(`/api/productos/gestion?${parametrosDelListado(paginaPedida, LIMITE_EXPORTAR, filtros)}`, { cache: 'no-store' })
      const datos = await respuesta.json() as RespuestaListado & RespuestaError
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
      todos.push(...datos.productos)
      if (todos.length >= datos.total || datos.productos.length === 0) break
    }

    return {
      filas: todos.map((p) => [
        p.idProducto, p.nombre, p.descripcion ?? '', p.categoria.nombre, p.precio, p.activo ? 'Activo' : 'Inactivo',
        p.sucursales.map((s) => s.sucursal.nombre).join(', '),
      ]),
      json: todos.map((p) => ({
        idProducto: p.idProducto,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        activo: p.activo,
        categoria: p.categoria.nombre,
        sucursales: p.sucursales.map((s) => ({ idSucursal: s.idSucursal, nombre: s.sucursal.nombre, disponible: s.disponible })),
      })),
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
          <p className="mt-1 text-sm text-muted">Cargá y editá lo que se vende en tu menú.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {/* Importar es solo del admin: un supervisor podría cargar datos masivos por error. */}
          <ExportarImportar
            entidad="productos"
            columnas={COLUMNAS_EXPORTAR}
            nombreArchivo={`productos_${hoyEnArgentina()}`}
            cantidad={total}
            aclaracionCantidad="Con los filtros que tenés aplicados."
            obtenerDatos={obtenerProductosParaExportar}
            puedeImportar={rol === 'admin'}
            onImportado={() => setRecarga((actual) => actual + 1)}
          />
          <button type="button" className={claseBotonAcento} onClick={abrirNuevoProducto} disabled={cargando}>
            <Plus className="size-4" />
            Nuevo producto
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-5">
        {/* Buscador a la izquierda (es lo más usado) y selectores a la derecha, separados. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={buscar} role="search"
            className="flex w-full items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm sm:w-80">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar producto y Enter"
              aria-label="Buscar producto por nombre o descripción"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle y no desplegable: se va y vuelve seguido entre la sucursal y el catálogo completo. */}
            {puedeElegir && sucursal && (
              <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-muted/60 p-1 text-sm">
                {[
                  { todas: false, texto: sucursal.nombre, descripcion: `Solo ${sucursal.nombre}` },
                  { todas: true, texto: 'Todas', descripcion: 'Todas las sucursales' },
                ].map(({ todas, texto, descripcion }) => (
                  <button
                    key={texto}
                    type="button"
                    onClick={() => {
                      setPagina(1)
                      setVerTodasLasSucursales(todas)
                    }}
                    aria-pressed={verTodasLasSucursales === todas}
                    aria-label={descripcion}
                    title={descripcion}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 truncate rounded-full px-3 py-1.5 transition-colors ${verTodasLasSucursales === todas ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                  >
                    {!todas && <Store className="size-3.5 shrink-0 text-accent" />}
                    {texto}
                  </button>
                ))}
              </div>
            )}
            {/* Activos/Inactivos se cambia poco: desplegable en vez de una fila de botones. */}
            <div className="w-52">
              <Desplegable
                etiqueta="Estado"
                icono={Power}
                opciones={OPCIONES_ESTADO}
                valor={filtroEstado}
                onElegir={cambiarFiltroEstado}
                textoVacio="Todos los estados"
              />
            </div>
          </div>
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
        {/* Cuántos resultados hay con los filtros elegidos, justo arriba de las tarjetas. */}
        {productos.length > 0 && (
          <p className="text-sm text-muted">
            <span className="font-medium text-text">{total}</span> {total === 1 ? 'producto' : 'productos'}
          </p>
        )}
        {mensaje && (
          <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">{mensaje}</p>
        )}
        {error && !mostrarFormulario && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        )}
        {cargando && productos.length === 0 && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando productos...</p>
        )}
        {/* Local recién empezado: sin categorías no hay productos. Se lo guía, sin cara de error. */}
        {!cargando && productos.length === 0 && !error && categorias.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-accent-soft">
              <Package className="size-6 text-accent" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg">Empezá armando tu carta</h2>
              <p className="max-w-md text-sm text-muted">
                Creá las categorías de tu menú (Hamburguesas, Pizzas, Bebidas…) y después cargá tus productos.
              </p>
            </div>
            <Link href="/productos/categorias" className={claseBotonAcento}>
              <Plus className="size-4" />
              Crear categorías
            </Link>
          </div>
        )}
        {!cargando && productos.length === 0 && !error && categorias.length > 0 && (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">
            No hay productos que coincidan con los filtros.
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {productos.map((producto) => {
            // Igual que en la carta: el precio de la variación principal (si tiene).
            const nombresCategoria = categorias.find((categoria) => categoria.idCategoria === producto.idCategoria)?.nombresVariaciones ?? []
            const principalProducto = variacionPrincipal(producto.variaciones, nombresCategoria)
            return (
              <article
                key={producto.idProducto}
                className={`flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm transition-shadow hover:shadow-md ${producto.activo ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs ${producto.activo ? 'text-success' : 'text-muted'}`}>
                    <span className={`size-1.5 rounded-full ${producto.activo ? 'bg-success' : 'bg-muted'}`} />
                    {producto.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="rounded-full bg-bg px-2.5 py-1 text-xs text-muted">
                    {producto.categoria.nombre}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {producto.imagenUrl ? (
                    // URL del bucket: no pasa por next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={producto.imagenUrl} alt="" loading="lazy" decoding="async"
                      className="size-14 shrink-0 object-contain" />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <IconoCategoria categoria={producto.categoria.nombre} className="size-7" strokeWidth={1.5} />
                    </span>
                  )}
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

                {producto.variaciones.length > 0 && (
                  <p className="text-xs text-muted">
                    Variaciones:{' '}
                    <span className="text-text">
                      {ordenarVariaciones(producto.variaciones, nombresCategoria).map((variacion) => variacion.nombre).join(' · ')}
                    </span>
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                  <p className="text-lg font-bold">
                    {formatoPrecio.format(producto.precio + (principalProducto?.precioAdicional ?? 0))}
                    {principalProducto && <span className="ml-1.5 text-sm font-normal text-muted">{principalProducto.nombre}</span>}
                  </p>
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
            )
          })}
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
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col rounded-3xl bg-surface shadow-xl"
          >
            {/* Título y botones fijos; solo el contenido del medio tiene scroll. */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
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

            {/* En el orden en que se piensa: la categoría define el precio (variaciones) y los extras. */}
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm">Categoría</legend>
                {categorias.length === 0 ? (
                  <CrearCategoriaRapida
                    nombresExistentes={[]}
                    onCreada={agregarCategoriaCreada}
                    abierta
                    onAbrir={() => {}}
                    onCerrar={() => {}}
                    sinCategorias
                    deshabilitado={cargando}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categorias.map((categoria) => (
                      <label
                        key={categoria.idCategoria}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text has-checked:border-accent has-checked:bg-accent-soft has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
                      >
                        <input
                          type="radio"
                          name="categoria-producto"
                          className="sr-only"
                          checked={!creandoCategoria && formulario.idCategoria === String(categoria.idCategoria)}
                          onChange={() => elegirCategoriaExistente(String(categoria.idCategoria))}
                          disabled={cargando}
                          required
                        />
                        <IconoCategoria categoria={categoria.nombre} className="size-4 text-accent" />
                        {categoria.nombre}
                      </label>
                    ))}
                    <CrearCategoriaRapida
                      nombresExistentes={categorias.map((categoria) => categoria.nombre)}
                      onCreada={agregarCategoriaCreada}
                      abierta={creandoCategoria}
                      onAbrir={() => setCreandoCategoria(true)}
                      onCerrar={() => setCreandoCategoria(false)}
                      sinCategorias={false}
                      deshabilitado={cargando}
                    />
                  </div>
                )}
              </fieldset>

              {/* Mientras se crea una categoría el resto se ve pero no se puede tocar: todavía no
                  hay categoría elegida, y sus variaciones y extras aparecen recién al crearla. */}
              <div inert={bloqueadoPorCategoria} aria-hidden={bloqueadoPorCategoria}
                className={`flex flex-col gap-6 transition-opacity motion-reduce:transition-none ${bloqueadoPorCategoria ? 'opacity-40 select-none' : ''}`}>
              <div className="flex flex-col gap-2">
                <label htmlFor="nombre" className="text-sm">Nombre</label>
                <input id="nombre" value={formulario.nombre} className={claseCampo}
                  onChange={(evento) => cambiarCampo('nombre', evento.target.value)} disabled={cargando} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="descripcion" className="text-sm">
                  Descripción <span className="text-muted">(opcional)</span>
                </label>
                <input id="descripcion" value={formulario.descripcion} className={claseCampo}
                  onChange={(evento) => cambiarCampo('descripcion', evento.target.value)} disabled={cargando} />
              </div>

              <CampoFotoProducto
                urlActual={fotoActual}
                archivo={fotoNueva}
                quitar={quitarFoto}
                categoria={categoriaElegida?.nombre ?? ''}
                onElegir={elegirFoto}
                onQuitar={quitarFotoElegida}
                error={errorFoto}
                deshabilitado={cargando}
              />

              {!categoriaElegida || creandoCategoria ? (
                <p className="rounded-2xl bg-bg p-4 text-center text-sm text-muted">
                  {creandoCategoria
                    ? 'Al crear la categoría vas a cargar acá el precio, las variaciones y los extras.'
                    : 'Elegí una categoría para cargar el precio, las variaciones y los extras.'}
                </p>
              ) : (
                <>
                  {/* El precio, destacado: único o por variación. */}
                  <section aria-labelledby="titulo-precio" className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 id="titulo-precio" className="font-semibold">Precio</h3>
                      {principal && (
                        <p className="text-xs text-muted">
                          En la carta:{' '}
                          <span className="text-text">
                            {principal.nombre}
                            {Number(principal.precio) > 0 && ` · ${formatoPrecio.format(Number(principal.precio))}`}
                          </span>
                        </p>
                      )}
                    </div>
                    {!principal && (
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">$</span>
                        <input id="precio" type="number" inputMode="decimal" min="0.01" step="0.01"
                          value={formulario.precio} aria-label="Precio" placeholder="Precio del producto"
                          className={`${claseCampo} bg-surface pl-8 text-base`}
                          onChange={(evento) => cambiarCampo('precio', evento.target.value)} disabled={cargando} required />
                      </div>
                    )}
                    <CampoVariaciones
                      filas={formulario.variaciones}
                      onCambiar={(variaciones) => setFormulario((actual) => ({ ...actual, variaciones }))}
                      nombreCategoria={categoriaElegida.nombre}
                      deshabilitado={cargando}
                    />
                  </section>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm">
                      Extras que admite <span className="text-muted">(opcional)</span>
                    </legend>
                    {extrasDeEjemplo && extrasDeCategoria.length > 0 && (
                      <Aviso tipo="info" titulo="Datos de ejemplo" className="mb-2">
                        Los extras todavía no están conectados con la base: lo que elijas acá no se guarda.
                      </Aviso>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {extrasDeCategoria.map((extra) => {
                        const idExtra = String(extra.idExtra)
                        return (
                          <label
                            key={extra.idExtra}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text has-checked:border-accent has-checked:bg-accent-soft has-checked:text-text"
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={formulario.idExtras.includes(idExtra)}
                              onChange={(evento) => cambiarSeleccion('idExtras', idExtra, evento.target.checked)}
                              disabled={cargando}
                            />
                            {extra.nombre}
                            <span className="tabular-nums">
                              {extra.precioAdicional > 0 ? `+${formatoPrecio.format(extra.precioAdicional)}` : 'Sin cargo'}
                            </span>
                          </label>
                        )
                      })}
                      {/* Con datos de ejemplo no se crea: no se guardaría. */}
                      {!extrasDeEjemplo && (
                        <CrearExtraRapido
                          idCategoria={categoriaElegida.idCategoria}
                          nombreCategoria={categoriaElegida.nombre}
                          onCreado={agregarExtraCreado}
                          deshabilitado={cargando}
                        />
                      )}
                    </div>
                  </fieldset>

                  <fieldset className="flex flex-col gap-2">
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
                              onChange={(evento) => cambiarSeleccion('idSucursales', idSucursal, evento.target.checked)}
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
                </>
              )}
              </div>

              {error && (
                <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
              )}
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-border px-6 py-4">
              <button type="button" onClick={cerrarFormulario} disabled={cargando}
                className={`${claseBotonSecundario} px-5 py-3`}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando || bloqueadoPorCategoria || sucursales.length === 0}
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

