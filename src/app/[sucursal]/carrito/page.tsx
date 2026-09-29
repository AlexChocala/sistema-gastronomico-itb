// Carrito de una sucursal (/{slug}/carrito). El servidor valida la sucursal y pasa los
// productos vigentes del menú; el carrito en sí vive en el navegador (CarritoSucursal).

import type { Metadata } from 'next'
import { EncabezadoPaso } from '@/components/carta/compartidos/EncabezadoSucursal'
import { CarritoSucursal } from '@/components/carta/carrito/CarritoSucursal'
import { obtenerSucursalOFallar, productosDelMenu } from '../datos'

export async function generateMetadata({ params }: PageProps<'/[sucursal]/carrito'>): Promise<Metadata> {
  const { sucursal, negocio } = await obtenerSucursalOFallar((await params).sucursal)
  return { title: `Tu carrito · ${sucursal.nombre} · ${negocio.nombre}` }
}

export default async function PaginaCarrito({ params }: PageProps<'/[sucursal]/carrito'>) {
  const { sucursal } = await obtenerSucursalOFallar((await params).sucursal)
  const productos = await productosDelMenu(sucursal.idSucursal)

  return (
    <div className="flex flex-1 flex-col bg-bg text-text">
      <EncabezadoPaso titulo="Tu carrito" volverA={`/${sucursal.slug}`} textoVolver="Volver al menú" sucursal={sucursal.nombre} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <CarritoSucursal slug={sucursal.slug} productos={productos} />
      </main>
    </div>
  )
}
