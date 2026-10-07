'use client'

// Pantalla de Cocina (pestaña aparte, sin sidebar). Muestra los pedidos a preparar y
// cambia su estado; ese mismo estado es el que lee la pantalla de Pedidos Mostrador.
// Un solo botón por pedido con la próxima acción: recibido → en preparación → listo.
// Así todo pedido pasa por "En preparación" en el mostrador antes de "Para retirar".

import { useState } from 'react'
import { Bike, CircleUserRound, ShoppingBag } from '@/components/icons'
import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { PastillaSucursal, useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { puedeIrACocina, usePedidosPantalla, type PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { textoOpciones } from '@/lib/pedidos/pedidos-estados'

const etiquetaEntrega = {
  retiro: { texto: 'Para retirar', icono: ShoppingBag, clase: 'bg-accent-soft text-accent' },
  delivery: { texto: 'Delivery', icono: Bike, clase: 'bg-warning-surface text-warning' },
}

// El estado se informa con una etiqueta; el verde queda para lo que ya está listo.
const etiquetaEstado = {
  nuevo: { texto: 'Nuevo', clasePunto: 'bg-muted', claseTexto: 'text-muted' },
  enPreparacion: { texto: 'En preparación', clasePunto: 'bg-order-preparing', claseTexto: 'text-order-preparing' },
}

function TarjetaPedido({
  pedido,
  onEmpezar,
  onListo,
}: {
  pedido: PedidoPantalla
  onEmpezar: () => Promise<unknown>
  onListo: () => Promise<unknown>
}) {
  const entrega = etiquetaEntrega[pedido.tipoEntrega]
  const IconoEntrega = entrega.icono
  const enPreparacion = pedido.estado === 'en_preparacion'
  const estado = etiquetaEstado[enPreparacion ? 'enPreparacion' : 'nuevo']
  // Bloquea el botón hasta que responda el servidor: como queda en el mismo lugar,
  // un doble toque pasaría el pedido de "Nuevo" a "Listo" sin querer.
  const [enviando, setEnviando] = useState(false)

  async function avanzar() {
    setEnviando(true)
    try {
      await (enPreparacion ? onListo() : onEmpezar())
    } finally {
      setEnviando(false)
    }
  }

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
        <span className={`inline-flex items-center gap-1.5 text-sm ${estado.claseTexto}`}>
          <span className={`size-2 rounded-full ${estado.clasePunto}`} />
          {estado.texto}
        </span>
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

      {/* Instrucción para cocinar: destacada para que no se pase por alto. */}
      {pedido.aclaracion && (
        <p className="mt-4 rounded-2xl bg-warning-surface px-4 py-3 text-base font-semibold break-words">
          <span className="block text-xs font-normal text-warning">Aclaración</span>
          {pedido.aclaracion}
        </p>
      )}

      {/* Mismo color en los dos pasos: es una acción, no un estado. */}
      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => void avanzar()}
          disabled={enviando}
          className="w-full cursor-pointer rounded-full bg-accent py-3 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
        >
          {enPreparacion ? 'Marcar como listo' : 'Empezar a preparar'}
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
                onEmpezar={() => marcarEnPreparacion(pedido.idPedido)}
                onListo={() => marcarListo(pedido.idPedido)}
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
