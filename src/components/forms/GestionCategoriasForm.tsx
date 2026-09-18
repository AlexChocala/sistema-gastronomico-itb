'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

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

  function limpiarFormulario() {
    setFormulario(formularioVacio)
    setIdEdicion(null)
  }

  function editar(categoria: Categoria) {
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
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Categorías</h1>
          <p className="mt-1">Organización y orden de los productos del menú.</p>
        </div>
        <Button type="button" variant="secundario" className="w-auto!" onClick={() => router.push('/productos')}>
          Volver a productos
        </Button>
      </header>

      <Card className="max-w-none!">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">
            {idEdicion === null ? 'Nueva categoría' : `Editar categoría ${idEdicion}`}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Input id="nombre-categoria" label="Nombre" value={formulario.nombre}
              onChange={(evento) => setFormulario((actual) => ({ ...actual, nombre: evento.target.value }))}
              disabled={cargando} required />
            <Input id="orden-categoria" label="Orden" type="number" min="0" step="1" value={formulario.orden}
              onChange={(evento) => setFormulario((actual) => ({ ...actual, orden: evento.target.value }))}
              disabled={cargando} required />
            <Input id="descripcion-categoria" label="Descripción" value={formulario.descripcion}
              onChange={(evento) => setFormulario((actual) => ({ ...actual, descripcion: evento.target.value }))}
              disabled={cargando} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={cargando}>
              {cargando ? 'Guardando...' : idEdicion === null ? 'Crear categoría' : 'Guardar cambios'}
            </Button>
            {idEdicion !== null && (
              <Button type="button" variant="secundario" onClick={limpiarFormulario} disabled={cargando}>
                Cancelar edición
              </Button>
            )}
          </div>
        </form>
      </Card>

      <section className="flex flex-col gap-4" aria-live="polite" aria-busy={cargando}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Categorías existentes</h2>
          <Button type="button" variant="secundario" className="w-auto!" onClick={() => void listar()} disabled={cargando}>
            Actualizar lista
          </Button>
        </div>
        {mensaje && <p>{mensaje}</p>}
        {error && <p role="alert">{error}</p>}
        {cargando && categorias.length === 0 && <p>Cargando categorías...</p>}
        {!cargando && categorias.length === 0 && !error && <p>No hay categorías cargadas.</p>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categorias.map((categoria) => (
            <Card key={categoria.idCategoria} className="max-w-none!">
              <article className="flex h-full flex-col gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{categoria.nombre}</h3>
                  <p>{categoria.descripcion || 'Sin descripción.'}</p>
                </div>
                <p>Orden: {categoria.orden}</p>
                <p>Productos asociados: {categoria._count.productos}</p>
                <p>Estado: {categoria.activa ? 'Activa' : 'Inactiva'}</p>
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button type="button" onClick={() => editar(categoria)} disabled={cargando}>Editar</Button>
                  <Button type="button" variant="secundario" onClick={() => void cambiarEstado(categoria)} disabled={cargando}>
                    {categoria.activa ? 'Desactivar' : 'Activar'}
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
