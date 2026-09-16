'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
}

type RespuestaListado = { productos: Producto[] }
type RespuestaError = { error?: string }

const formularioVacio = {
  nombre: '',
  descripcion: '',
  precio: '',
  idCategoria: '',
}

export function GestionProductosForm() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [formulario, setFormulario] = useState(formularioVacio)
  const [idEdicion, setIdEdicion] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const listar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await fetch('/api/productos/gestion?estado=todos', { cache: 'no-store' })
      const datos = await respuesta.json() as RespuestaListado & RespuestaError
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
      setProductos(datos.productos)
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
        if (paginaActiva) setProductos(datos.productos)
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

  function cambiarCampo(campo: keyof typeof formulario, valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }))
  }

  function limpiarFormulario() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
  }

  function cargarParaEditar(producto: Producto) {
    setIdEdicion(producto.idProducto)
    setFormulario({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: String(producto.precio),
      idCategoria: String(producto.idCategoria),
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
        idEdicion === null ? '/api/productos/gestion' : `/api/productos/gestion/${idEdicion}`,
        {
          method: idEdicion === null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: formulario.nombre,
            descripcion: formulario.descripcion,
            precio: Number(formulario.precio),
            idCategoria: Number(formulario.idCategoria),
          }),
        },
      )
      const datos = await respuesta.json() as RespuestaError
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar el producto.')
      setMensaje(idEdicion === null ? 'Producto creado.' : 'Producto actualizado.')
      limpiarFormulario()
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
    <div className="flex flex-col gap-4">
      <Link href="/dashboard">Volver al dashboard</Link>

      <Card>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <h1>{idEdicion === null ? 'Crear producto' : `Editar producto ${idEdicion}`}</h1>
          <Input id="nombre" label="Nombre" value={formulario.nombre}
            onChange={(evento) => cambiarCampo('nombre', evento.target.value)} disabled={cargando} required />
          <Input id="descripcion" label="Descripción" value={formulario.descripcion}
            onChange={(evento) => cambiarCampo('descripcion', evento.target.value)} disabled={cargando} />
          <Input id="precio" label="Precio" type="number" min="0.01" step="0.01" value={formulario.precio}
            onChange={(evento) => cambiarCampo('precio', evento.target.value)} disabled={cargando} required />
          <Input id="categoria" label="Número de categoría" type="number" min="1" step="1"
            value={formulario.idCategoria}
            onChange={(evento) => cambiarCampo('idCategoria', evento.target.value)} disabled={cargando} required />
          <Button type="submit" disabled={cargando}>
            {cargando ? 'Guardando...' : idEdicion === null ? 'Crear' : 'Guardar cambios'}
          </Button>
          {idEdicion !== null && (
            <Button type="button" variant="secundario" onClick={limpiarFormulario} disabled={cargando}>
              Cancelar edición
            </Button>
          )}
        </form>
      </Card>

      <Card>
        <div className="flex flex-col gap-3" aria-live="polite" aria-busy={cargando}>
          <h2>Productos</h2>
          <Button type="button" variant="secundario" onClick={() => void listar()} disabled={cargando}>
            Actualizar lista
          </Button>
          {mensaje && <p>{mensaje}</p>}
          {error && <p role="alert">{error}</p>}
          {!cargando && productos.length === 0 && !error && <p>No hay productos cargados.</p>}
          {productos.map((producto) => (
            <div key={producto.idProducto} className="flex flex-col gap-2">
              <p><strong>{producto.nombre}</strong></p>
              <p>Precio: {producto.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p>Categoría: {producto.categoria.nombre} (ID {producto.idCategoria})</p>
              <p>Estado: {producto.activo ? 'Activo' : 'Inactivo'}</p>
              <Button type="button" onClick={() => cargarParaEditar(producto)} disabled={cargando}>
                Editar
              </Button>
              <Button type="button" variant="secundario" onClick={() => void cambiarEstado(producto)} disabled={cargando}>
                {producto.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
