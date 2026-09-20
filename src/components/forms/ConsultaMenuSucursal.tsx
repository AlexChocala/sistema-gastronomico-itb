'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type ProductoMenu = {
  idProducto: number
  nombre: string
  descripcion: string | null
  precio: number
  categoria: {
    idCategoria: number
    nombre: string
  }
}

type RespuestaMenu = {
  sucursal: {
    idSucursal: number
    nombre: string
  }
  productos: ProductoMenu[]
  error?: string
}

async function leerRespuesta(respuesta: Response) {
  const tipoContenido = respuesta.headers.get('content-type')
  if (!tipoContenido?.includes('application/json')) {
    throw new Error('El servidor devolvió una respuesta inesperada. Reiniciá la aplicación e intentá otra vez.')
  }

  return await respuesta.json() as RespuestaMenu
}

function formatearPrecio(precio: number) {
  return precio.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
  })
}

export function ConsultaMenuSucursal({ idSucursal }: { idSucursal: number }) {
  const [menu, setMenu] = useState<RespuestaMenu | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let paginaActiva = true

    async function cargarMenu() {
      setCargando(true)
      setError('')

      try {
        const respuesta = await fetch(`/api/productos?idSucursal=${idSucursal}`, {
          cache: 'no-store',
        })
        const datos = await leerRespuesta(respuesta)

        if (!respuesta.ok) {
          throw new Error(datos.error || 'No se pudo cargar el menú.')
        }

        if (paginaActiva) setMenu(datos)
      } catch (errorDesconocido) {
        if (paginaActiva) {
          setError(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : 'No se pudo cargar el menú.',
          )
        }
      } finally {
        if (paginaActiva) setCargando(false)
      }
    }

    void cargarMenu()
    return () => {
      paginaActiva = false
    }
  }, [idSucursal, recarga])

  return (
    <section className="space-y-6" aria-labelledby="titulo-menu">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <h1 id="titulo-menu" className="text-3xl font-semibold">
            Consultar menú
          </h1>
          <p className="mt-2 opacity-70">
            Productos disponibles para tomar pedidos en tu sucursal.
          </p>
        </div>
        <Button
          type="button"
          variant="secundario"
          className="w-auto!"
          disabled={cargando}
          onClick={() => setRecarga((actual) => actual + 1)}
        >
          {cargando ? 'Actualizando...' : 'Actualizar menú'}
        </Button>
      </header>

      {error && <p role="alert">{error}</p>}

      {!error && cargando && <p>Cargando productos...</p>}

      {!error && !cargando && menu && (
        <>
          <h2 className="text-xl font-semibold">Sucursal {menu.sucursal.nombre}</h2>

          {menu.productos.length === 0 ? (
            <Card className="max-w-none!">
              <p>No hay productos disponibles en esta sucursal.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {menu.productos.map((producto) => (
                <Card key={producto.idProducto} className="max-w-none!">
                  <p className="text-sm opacity-70">{producto.categoria.nombre}</p>
                  <h3 className="mt-2 text-lg font-semibold">{producto.nombre}</h3>
                  {producto.descripcion && (
                    <p className="mt-2 text-sm opacity-80">{producto.descripcion}</p>
                  )}
                  <p className="mt-4 font-semibold">{formatearPrecio(producto.precio)}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
