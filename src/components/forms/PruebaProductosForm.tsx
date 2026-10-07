'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

type Sucursal = { idSucursal: number; nombre: string }
type Producto = {
  idProducto: number
  nombre: string
  descripcion: string | null
  precio: number
  categoria: { idCategoria: number; nombre: string }
}
type Resultado = { sucursal: Sucursal; productos: Producto[] }

export function PruebaProductosForm({ sucursales, errorInicial = '' }: {
  sucursales: Sucursal[]
  errorInicial?: string
}) {
  const [idSucursal, setIdSucursal] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState(errorInicial)
  const [cargando, setCargando] = useState(false)

  function elegirSucursal(valor: string) {
    setIdSucursal(valor)
    setResultado(null)
    setError('')
  }

  async function consultar(evento: FormEvent) {
    evento.preventDefault()
    setCargando(true)
    setError('')
    setResultado(null)
    try {
      // La pantalla consulta el endpoint, igual que lo hará la carta definitiva.
      const respuesta = await fetch('/api/productos?' + new URLSearchParams({ idSucursal }), {
        cache: 'no-store',
      })
      const datos = await respuesta.json()
      if (!respuesta.ok) {
        setError(datos.error || 'No se pudieron consultar los productos.')
        return
      }
      if (!datos.sucursal || !Array.isArray(datos.productos)) {
        throw new Error('Respuesta inesperada')
      }
      setResultado(datos)
    } catch {
      setError('No se pudo obtener una respuesta del sistema. Intentá nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="p-4" lang="es">
      <Card>
        <div className="flex flex-col gap-4">
          <h1>Prueba de productos por sucursal</h1>
          <p>Elegí una sucursal o escribí su número y presioná Consultar.</p>
          <div className="flex flex-col gap-2">
            {sucursales.map((sucursal) => (
              <Button key={sucursal.idSucursal} type="button" disabled={cargando}
                onClick={() => elegirSucursal(String(sucursal.idSucursal))}>
                {sucursal.nombre} (ID {sucursal.idSucursal})
              </Button>
            ))}
            {!errorInicial && sucursales.length === 0 && <p>No hay sucursales activas cargadas.</p>}
          </div>
          <form onSubmit={consultar} className="flex flex-col gap-2">
            <Input id="sucursal-prueba" label="Número de sucursal" value={idSucursal}
              onChange={(evento) => elegirSucursal(evento.target.value)} disabled={cargando} required />
            <Button type="submit" disabled={cargando}>{cargando ? 'Consultando...' : 'Consultar'}</Button>
          </form>
          {error && <p role="alert">{error}</p>}
          <div aria-live="polite" aria-busy={cargando}>
            {resultado && (
              <>
                <h2>Productos de {resultado.sucursal.nombre}</h2>
                {resultado.productos.length === 0 ? <p>No hay productos disponibles.</p> : (
                  <ul className="flex flex-col gap-3">
                    {resultado.productos.map((producto) => (
                      <li key={producto.idProducto}>
                        <p><strong>{producto.nombre}</strong></p>
                        <p>{producto.descripcion}</p>
                        <p>Categoría: {producto.categoria.nombre}</p>
                        <p>Precio: {producto.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    </main>
  )
}
