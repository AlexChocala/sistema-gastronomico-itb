'use client'

// Pantalla pública de Pedidos Mostrador (pestaña aparte, sin sidebar), para un monitor
// que ven los clientes. Solo muestra número y nombre: nada de precios ni productos.
// Lee el mismo estado que cambia la pantalla de Cocina.

import { use } from 'react'
import { usePedidosPantalla, type PedidoPantalla } from '@/lib/pedidos-pantallas'

function Columna({
  titulo,
  pedidos,
  colorPunto,
  colorTitulo,
}: {
  titulo: string
  pedidos: PedidoPantalla[]
  colorPunto: string
  colorTitulo: string
}) {
  return (
    <section className="flex flex-col rounded-3xl bg-surface p-8">
      <h2 className={`screen-title flex items-center gap-4 ${colorTitulo}`}>
        <span className={`size-4 rounded-full ${colorPunto}`} />
        {titulo}
      </h2>
      <ul className="mt-8 flex flex-col gap-4">
        {pedidos.map((pedido) => (
          <li key={pedido.idPedido} className="screen-item flex items-baseline gap-5">
            <span className="w-24 shrink-0 font-bold">#{pedido.idPedido}</span>
            <span className="truncate">{pedido.cliente}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Es pública (sin sesión), así que la sucursal viaja en la URL: ?sucursal=ID. El link
// del sidebar ya la incluye.
export default function PedidosMostradorPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string }>
}) {
  const idSucursal = Number(use(searchParams).sucursal)
  const sucursalValida = Number.isInteger(idSucursal) && idSucursal > 0
  const { pedidos } = usePedidosPantalla(sucursalValida ? idSucursal : null)

  if (!sucursalValida) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6">
        <p className="screen-item rounded-3xl bg-surface p-10 text-center text-muted">
          Abrí esta pantalla desde el panel para elegir la sucursal.
        </p>
      </main>
    )
  }

  // Los pedidos "nuevo" no se muestran: nadie confirmó todavía que se están preparando.
  const enPreparacion = pedidos.filter((pedido) => pedido.estado === 'en_preparacion')
  const paraRetirar = pedidos.filter((pedido) => pedido.estado === 'listo')

  return (
    <main className="grid min-h-screen gap-6 bg-bg p-6 md:grid-cols-2">
      <Columna
        titulo="En preparación"
        pedidos={enPreparacion}
        colorPunto="bg-order-preparing"
        colorTitulo="text-text"
      />
      <Columna
        titulo="Para retirar"
        pedidos={paraRetirar}
        colorPunto="bg-order-ready"
        colorTitulo="text-order-ready"
      />
    </main>
  )
}
