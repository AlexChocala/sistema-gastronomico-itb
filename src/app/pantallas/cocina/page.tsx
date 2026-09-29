'use client'

// Pantalla de Cocina (pestaña aparte, sin sidebar). Muestra los pedidos a preparar y
// cambia su estado; ese mismo estado es el que lee la pantalla de Pedidos Mostrador.
// "Listo" también vale para un pedido que nadie marcó como "Pendiente" (recibido → listo).

import { Bike, Check, CircleUserRound, ShoppingBag } from '@/components/icons'
import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { PastillaSucursal, useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { puedeIrACocina, usePedidosPantalla, type PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { textoOpciones } from '@/lib/pedidos/pedidos-estados'

const etiquetaEntrega = {
  retiro: { texto: 'Para retirar', icono: ShoppingBag, clase: 'bg-accent-soft text-accent' },
  delivery: { texto: 'Delivery', icono: Bike, clase: 'bg-warning-surface text-warning' },
}

function TarjetaPedido({
  pedido,
  onPendiente,
  onListo,
}: {
  pedido: PedidoPantalla
  onPendiente: () => void
  onListo: () => void
}) {
  const entrega = etiquetaEntrega[pedido.tipoEntrega]
  const IconoEntrega = entrega.icono
  const enPreparacion = pedido.estado === 'en_preparacion'

  return (
    <article className="flex flex-col rounded-3xl bg-surface p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CircleUserRound className="size-6 shrink-0 text-order-ready" strokeWidth={1.75} />
          <span className="truncate text-lg">{pedido.cliente}</span>
        </div>
        <span className="shrink-0 text-lg">
          Pedido <strong className="font-bold">#{pedido.idPedido}</strong>
        </span>
      </header>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${entrega.clase}`}>
          <IconoEntrega className="size-4" strokeWidth={2} />
          {entrega.texto}
        </span>
        {enPreparacion && (
          <span className="inline-flex items-center gap-1.5 text-sm text-order-preparing">
            <span className="size-2 rounded-full bg-order-preparing" />
            En preparación
          </span>
        )}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-base">
        {/* Key por posición: el mismo producto puede venir con otras opciones. */}
        {pedido.items.map((item, indice) => {
          const opciones = textoOpciones(item.variacion, item.extras)
          return (
            <li key={indice} className="flex gap-2">
              <span className="w-7 shrink-0 text-muted">{item.cantidad}x</span>
              <span className="min-w-0">
                {item.producto}
                {opciones && <span className="block text-sm font-semibold break-words text-muted">{opciones}</span>}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onPendiente}
          disabled={enPreparacion}
          className="cursor-pointer rounded-full border border-border bg-surface py-3 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-muted disabled:text-muted"
        >
          {enPreparacion ? 'En preparación' : 'Pendiente'}
        </button>
        <button
          type="button"
          onClick={onListo}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-order-ready py-3 text-on-primary transition-opacity hover:opacity-90"
        >
          <Check className="size-5" strokeWidth={2.25} />
          Listo
        </button>
      </div>
    </article>
  )
}

export default function CocinaPage() {
  const { sucursal } = useSucursalActiva()
  const {
    pedidos, cargando, error, recargar, errorAccion, limpiarErrorAccion, marcarEnPreparacion, marcarListo,
  } = usePedidosPantalla(sucursal?.idSucursal ?? null)

  // Cocina solo ve lo que tiene que preparar (recibido / en preparación): las
  // transferencias sin confirmar no llegan, y enviado y entregado ya son de Pedidos.
  const pedidosActivos = pedidos.filter(puedeIrACocina)
  const pedidosListos = pedidos.filter((pedido) => pedido.estado === 'listo')

  return (
    <main className="grid min-h-screen gap-6 bg-bg p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex flex-col gap-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="screen-title">Cocina</h1>
              <PastillaSucursal />
            </div>
            <p className="mt-1 text-muted">
              {pedidosActivos.length} {pedidosActivos.length === 1 ? 'pedido' : 'pedidos'} en curso
            </p>
          </div>
        </header>

        <EstadoConexion
          error={error}
          errorAccion={errorAccion}
          onReintentar={() => void recargar()}
          onCerrarAviso={limpiarErrorAccion}
        />

        {cargando ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando pedidos...</p>
        ) : pedidosActivos.length === 0 ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay pedidos pendientes.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-5">
            {pedidosActivos.map((pedido) => (
              <TarjetaPedido
                key={pedido.idPedido}
                pedido={pedido}
                onPendiente={() => void marcarEnPreparacion(pedido.idPedido)}
                onListo={() => void marcarListo(pedido.idPedido)}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
        <h2 className="text-xl font-semibold">Pedidos listos</h2>
        {pedidosListos.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay pedidos listos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedidosListos.map((pedido) => (
              <li key={pedido.idPedido} className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
                <span className="size-2 shrink-0 rounded-full bg-order-ready" />
                <span className="font-semibold">#{pedido.idPedido}</span>
                <span className="truncate text-muted">{pedido.cliente}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </main>
  )
}
