'use client'

// Pantalla pública de Pedidos Mostrador (pestaña aparte, sin sidebar), para un monitor
// que ven los clientes. Solo muestra número y nombre de pila: nada de precios, productos
// ni datos de contacto (la API pública no los devuelve). Lee el mismo estado que cambia
// la pantalla de Cocina.
// El número es lo que el cliente busca con su ticket en la mano, así que es lo más grande;
// el nombre queda chico, de apoyo.

import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { LocalCerrado } from '@/components/caja/LocalCerrado'
import { useLocalAbierto } from '@/lib/caja/turnos-cliente'
import { usePedidosMostrador, type PedidoMostrador } from '@/lib/pedidos/pedidos-pantallas'

function Columna({
  titulo,
  pedidos,
  colorPunto,
  colorTitulo,
}: {
  titulo: string
  pedidos: PedidoMostrador[]
  colorPunto: string
  colorTitulo: string
}) {
  return (
    <section className="flex flex-col rounded-3xl bg-surface p-8">
      <h2 className={`screen-title flex items-center gap-4 ${colorTitulo}`}>
        <span className={`size-4 rounded-full ${colorPunto}`} />
        {titulo}
      </h2>
      <ul className="grid-cards mt-8 [--card-min:11rem]">
        {pedidos.map((pedido) => (
          <li key={pedido.idPedido} className="flex flex-col items-center gap-1 rounded-3xl bg-bg px-4 py-5 text-center">
            <span className="screen-number">#{pedido.idPedido}</span>
            <span className="max-w-full truncate text-muted">{pedido.cliente}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// La sucursal la resuelve el servidor: el acceso del equipo (link con código) o la sesión.
export default function PedidosMostradorPage() {
  const { sucursal } = useSucursalActiva()
  const { pedidos, error, recargar } = usePedidosMostrador(sucursal?.idSucursal ?? null)
  const localAbierto = useLocalAbierto()

  // La API ya filtra: solo pedidos para retirar en el local (de caja u online), porque los
  // delivery no los busca nadie en el mostrador, y solo en preparación o listos (los
  // "recibido" no: nadie confirmó todavía que se están preparando).
  const enPreparacion = pedidos.filter((pedido) => pedido.estado === 'en_preparacion')
  const paraRetirar = pedidos.filter((pedido) => pedido.estado === 'listo')


  // Sin caja abierta y sin pedidos para retirar, la pantalla descansa.
  if (localAbierto === false && pedidos.length === 0) return <LocalCerrado titulo="Pantalla del cliente" />

  return (
    <main className="grid min-h-screen gap-6 bg-bg p-6 md:grid-cols-2">
      {/* Flotante, para no mover las columnas del monitor. */}
      <EstadoConexion error={error} onReintentar={() => void recargar()} className="fixed inset-x-6 bottom-6 z-10" />
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
