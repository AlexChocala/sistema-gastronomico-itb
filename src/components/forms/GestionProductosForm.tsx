'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

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
type RespuestaListado = { productos: Producto[]; categorias: Categoria[]; sucursales: Sucursal[] }
type RespuestaError = { error?: string }
type FiltroEstado = 'todos' | 'activos' | 'inactivos'

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
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null)

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es')
    return productos.filter((producto) => {
      const coincideTexto = !texto
        || producto.nombre.toLocaleLowerCase('es').includes(texto)
        || producto.descripcion?.toLocaleLowerCase('es').includes(texto)
      const coincideEstado = filtroEstado === 'todos'
        || (filtroEstado === 'activos' && producto.activo)
        || (filtroEstado === 'inactivos' && !producto.activo)
      const coincideCategoria = filtroCategoria === null || producto.idCategoria === filtroCategoria
      return coincideTexto && coincideEstado && coincideCategoria
    })
  }, [busqueda, filtroCategoria, filtroEstado, productos])

  const listar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await fetch('/api/productos/gestion?estado=todos', { cache: 'no-store' })
      const datos = await respuesta.json() as RespuestaListado & RespuestaError
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
      setProductos(datos.productos)
      setCategorias(datos.categorias)
      setSucursales(datos.sucursales)
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudieron cargar los productos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let paginaActiva = true

    async function cargarInicial() {
      try {
        const respuesta = await fetch('/api/productos/gestion?estado=todos', { cache: 'no-store' })
        const datos = await respuesta.json() as RespuestaListado & RespuestaError
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
        if (paginaActiva) {
          setProductos(datos.productos)
          setCategorias(datos.categorias)
          setSucursales(datos.sucursales)
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

    void cargarInicial()
    return () => {
      paginaActiva = false
    }
  }, [])

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
      await listar()
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
      await listar()
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo cambiar el estado.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Productos</h1>
          <p className="mt-1">Administración del menú y productos disponibles.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secundario" className="w-auto!"
            onClick={() => router.push('/productos/categorias')} disabled={cargando}>
            Administrar categorías
          </Button>
          <Button type="button" className="w-auto!" onClick={abrirNuevoProducto} disabled={cargando}>
            Nuevo producto
          </Button>
        </div>
      </header>

      <Card className="max-w-none!">
        <div className="flex flex-col gap-4">
          <Input
            id="buscar-producto"
            label="Buscar producto"
            placeholder="Nombre o descripción"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            {(['todos', 'activos', 'inactivos'] as const).map((estado) => (
              <Button
                key={estado}
                type="button"
                variant={filtroEstado === estado ? 'primario' : 'secundario'}
                onClick={() => setFiltroEstado(estado)}
              >
                {estado[0].toUpperCase() + estado.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="w-auto!"
              variant={filtroCategoria === null ? 'primario' : 'secundario'}
              onClick={() => setFiltroCategoria(null)}
            >
              Todas las categorías
            </Button>
            {categorias.map((categoria) => (
              <Button
                key={categoria.idCategoria}
                type="button"
                className="w-auto!"
                variant={filtroCategoria === categoria.idCategoria ? 'primario' : 'secundario'}
                onClick={() => setFiltroCategoria(categoria.idCategoria)}
              >
                {categoria.nombre}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {mostrarFormulario && (
        <Card className="max-w-none!">
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">
              {idEdicion === null ? 'Nuevo producto' : `Editar producto ${idEdicion}`}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input id="nombre" label="Nombre" value={formulario.nombre}
                onChange={(evento) => cambiarCampo('nombre', evento.target.value)} disabled={cargando} required />
              <Input id="descripcion" label="Descripción" value={formulario.descripcion}
                onChange={(evento) => cambiarCampo('descripcion', evento.target.value)} disabled={cargando} />
              <Input id="precio" label="Precio" type="number" min="0.01" step="0.01" value={formulario.precio}
                onChange={(evento) => cambiarCampo('precio', evento.target.value)} disabled={cargando} required />
              <div className="flex flex-col gap-1">
                <label htmlFor="categoria" className="text-sm font-medium">Categoría</label>
                <select
                  id="categoria"
                  value={formulario.idCategoria}
                  onChange={(evento) => cambiarCampo('idCategoria', evento.target.value)}
                  disabled={cargando || categorias.length === 0}
                  required
                  className="rounded-md border px-3 py-2"
                >
                  <option value="">Seleccioná una categoría</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.idCategoria} value={categoria.idCategoria}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
                {categorias.length === 0 && <p>No hay categorías activas disponibles.</p>}
              </div>
              <fieldset className="flex flex-col gap-2 md:col-span-2">
                <legend className="text-sm font-medium">Disponible en</legend>
                {sucursales.map((sucursal) => {
                  const idSucursal = String(sucursal.idSucursal)
                  return (
                    <label key={sucursal.idSucursal} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formulario.idSucursales.includes(idSucursal)}
                        onChange={(evento) => cambiarSucursal(idSucursal, evento.target.checked)}
                        disabled={cargando}
                      />
                      {sucursal.nombre}
                    </label>
                  )
                })}
                {sucursales.length === 0 && <p>No hay sucursales activas disponibles.</p>}
              </fieldset>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={cargando || categorias.length === 0 || sucursales.length === 0}>
                {cargando ? 'Guardando...' : idEdicion === null ? 'Crear producto' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="secundario" onClick={cerrarFormulario} disabled={cargando}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section className="flex flex-col gap-4" aria-live="polite" aria-busy={cargando}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Listado de productos</h2>
            <p>{productosFiltrados.length} de {productos.length} productos</p>
          </div>
          <Button type="button" className="w-auto!" variant="secundario"
            onClick={() => void listar()} disabled={cargando}>
            Actualizar lista
          </Button>
        </div>

        {mensaje && <p>{mensaje}</p>}
        {error && <p role="alert">{error}</p>}
        {cargando && productos.length === 0 && <p>Cargando productos...</p>}
        {!cargando && productosFiltrados.length === 0 && !error && (
          <p>No hay productos que coincidan con los filtros.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productosFiltrados.map((producto) => (
            <Card key={producto.idProducto} className="max-w-none!">
              <article className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">{producto.categoria.nombre}</p>
                  <p className="text-sm">{producto.activo ? 'Activo' : 'Inactivo'}</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 border-y py-4">
                  <h3 className="text-xl font-semibold">{producto.nombre}</h3>
                  <p>{producto.descripcion || 'Sin descripción.'}</p>
                  <p>
                    Sucursales: {producto.sucursales.length > 0
                      ? producto.sucursales.map((sucursal) => sucursal.sucursal.nombre).join(', ')
                      : 'Sin sucursales disponibles'}
                  </p>
                  <p className="mt-auto text-lg font-semibold">
                    {producto.precio.toLocaleString('es-AR', {
                      style: 'currency',
                      currency: 'ARS',
                    })}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" onClick={() => cargarParaEditar(producto)} disabled={cargando}>
                    Editar
                  </Button>
                  <Button type="button" variant="secundario"
                    onClick={() => void cambiarEstado(producto)} disabled={cargando}>
                    {producto.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </article>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
