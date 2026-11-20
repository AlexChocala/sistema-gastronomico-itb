'use client'

// Pantalla de Cocina (pestaña aparte, sin sidebar). Muestra los pedidos a preparar y
// cambia su estado; ese mismo estado es el que lee la pantalla de Pedidos Mostrador.
// Un solo botón por pedido con la próxima acción: recibido → en preparación → listo.
// Así todo pedido pasa por "En preparación" en el mostrador antes de "Para retirar".
// Al empezar un pedido (de Caja u online) se imprime su comanda para pegarla en la bolsa:
// Cocina no depende del papel de Caja.
// Se distingue de lejos: pendiente = tarjeta blanca y botón claro; en preparación =
// borde de color y botón naranja sólido. Cada tarjeta muestra cuánto hace que se cargó el
// pedido (y se marca si se demora), y los más viejos van primero.

import { useEffect, useState } from 'react'
import { Clock, Printer, Volume2, VolumeOff } from '@/components/icons'
import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { EstadoPedidoTexto, EtiquetaEntrega } from '@/components/pedidos/EtiquetasPedido'
import { OpcionesItem } from '@/components/pedidos/OpcionesItem'
import { ComandaCocina } from '@/components/pantallas/TicketsPedido'
import { PastillaSucursal, useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { puedeIrACocina, usePedidosPantalla, type PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { useAvisoPedidosNuevos } from '@/lib/pedidos/aviso-sonoro'
import { LocalCerrado } from '@/components/caja/LocalCerrado'
import { useLocalAbierto } from '@/lib/caja/turnos-cliente'
import { colorEspera, esperaDe, useAhora } from '@/lib/pedidos/tiempo'

function TarjetaPedido({
  pedido,
  onEmpezar,
  onListo,
  onImprimir,
  ahora,
}: {
  pedido: PedidoPantalla
  onEmpezar: () => Promise<{ ok: boolean }>
  onListo: () => Promise<{ ok: boolean }>
  onImprimir: () => void
  ahora: number
}) {
  const enPreparacion = pedido.estado === 'en_preparacion'
  // Cuenta desde que llegó a Cocina (una transferencia no cuenta la espera del comprobante).
  const espera = pedido.fechaEnCocina ? esperaDe(pedido.fechaEnCocina, ahora) : null
  // Bloquea el botón hasta que responda el servidor: como queda en el mismo lugar,
  // un doble toque pasaría el pedido de "Nuevo" a "Listo" sin querer.
  const [enviando, setEnviando] = useState(false)

  async function avanzar() {
    setEnviando(true)
    try {
      const resultado = await (enPreparacion ? onListo() : onEmpezar())
      // Primer paso: sale la comanda para pegar en la bolsa.
      if (resultado.ok && !enPreparacion) onImprimir()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <article
      className={`flex flex-col rounded-3xl border-2 bg-surface p-5 shadow-sm ${
        enPreparacion ? 'border-order-preparing' : 'border-transparent'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-lg">{pedido.cliente}</span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onImprimir}
            aria-label="Imprimir ticket"
            title="Imprimir ticket"
            className="cursor-pointer rounded-full p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
          >
            <Printer className="size-5" />
          </button>
          <strong className="text-2xl font-bold">#{pedido.idPedido}</strong>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <EtiquetaEntrega tipo={pedido.tipoEntrega} />
        {espera && (
          <span className={`inline-flex items-center gap-1.5 text-sm ${colorEspera(espera.minutos)}`}>
            <Clock className="size-4" strokeWidth={2} />
            {espera.texto}
          </span>
        )}
      </div>
      {enPreparacion && <EstadoPedidoTexto estado={pedido.estado} className="mt-2" />}

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-base">
        {/* Key por posición: el mismo producto puede venir con otras opciones. */}
        {pedido.items.map((item, indice) => (
          <li key={indice} className="flex gap-2">
            <span className="w-7 shrink-0 text-muted">{item.cantidad}x</span>
            <div className="min-w-0">
              {item.producto}
              <OpcionesItem variacion={item.variacion} extras={item.extras} className="font-semibold" />
            </div>
          </li>
        ))}
      </ul>

      {/* Instrucción para cocinar: destacada para que no se pase por alto. */}
      {pedido.aclaracion && (
        <p className="mt-4 rounded-2xl bg-warning-surface px-4 py-3 text-base font-semibold break-words">
          <span className="block text-xs font-normal text-muted">Aclaración</span>
          {pedido.aclaracion}
        </p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => void avanzar()}
          disabled={enviando}
          className={`w-full cursor-pointer rounded-full py-3 font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
            enPreparacion
              ? 'bg-brand text-on-brand hover:bg-brand-hover'
              : 'border-2 border-border bg-surface hover:bg-bg'
          }`}
        >
          {enPreparacion ? 'Pedido listo' : 'Empezar a preparar'}
        </button>
      </div>
    </article>
  )
}

export default function CocinaPage() {
  const { sucursal } = useSucursalActiva()
  const ahora = useAhora()
  // Pedido cuya comanda se imprime: se renderiza oculto y recién ahí se abre el diálogo.
  const [paraImprimir, setParaImprimir] = useState<{ pedido: PedidoPantalla } | null>(null)
  useEffect(() => {
    if (paraImprimir) window.print()
  }, [paraImprimir])
  const {
    pedidos, cargando, error, recargar, errorAccion, limpiarErrorAccion, marcarEnPreparacion, marcarListo,
  } = usePedidosPantalla(sucursal?.idSucursal ?? null, { segundoPlano: true })

  // Cocina solo ve lo que tiene que preparar (recibido / en preparación): las
  // transferencias sin confirmar no llegan, y enviado y entregado ya son de Pedidos.
  // Primero los pendientes, después los que ya están en preparación; en cada grupo, los
  // que llevan más tiempo esperando van arriba.
  const pedidosActivos = pedidos.filter(puedeIrACocina)
    .sort((a, b) =>
      Number(a.estado === 'en_preparacion') - Number(b.estado === 'en_preparacion')
      || new Date(a.fechaEnCocina ?? a.fecha).getTime() - new Date(b.fechaEnCocina ?? b.fecha).getTime())
  // Suena cuando entra un pedido nuevo a Cocina.
  const localAbierto = useLocalAbierto()
  const { sonidoActivo, activar } = useAvisoPedidosNuevos(pedidosActivos.map((pedido) => pedido.idPedido), !cargando)
  // Los que llevan más tiempo listos (sin que los retiren) van primero.
  const pedidosListos = pedidos.filter((pedido) => pedido.estado === 'listo')
    .sort((a, b) => new Date(a.fechaListo ?? a.fecha).getTime() - new Date(b.fechaListo ?? b.fecha).getTime())

  // Sin caja abierta y sin pedidos en curso, la pantalla descansa.
  if (localAbierto === false && !cargando && pedidosActivos.length === 0 && pedidosListos.length === 0) {
    return <LocalCerrado titulo="Cocina" />
  }

  return (
    <>
    <main className="grid min-h-screen gap-6 bg-bg p-6 print:hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
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
          <button
            type="button"
            onClick={activar}
            aria-label={sonidoActivo ? 'Sonido activado' : 'Activar sonido'}
            title={sonidoActivo ? 'Sonido activado' : 'Activar sonido'}
            className={`cursor-pointer rounded-full p-2.5 transition-colors hover:bg-surface ${sonidoActivo ? 'text-accent' : 'text-muted'}`}
          >
            {sonidoActivo ? <Volume2 className="size-6" /> : <VolumeOff className="size-6" />}
          </button>
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
          <div className="grid-cards [--card-min:18rem]">
            {pedidosActivos.map((pedido) => (
              <TarjetaPedido
                key={pedido.idPedido}
                pedido={pedido}
                ahora={ahora}
                onEmpezar={() => marcarEnPreparacion(pedido.idPedido)}
                onListo={() => marcarListo(pedido.idPedido)}
                onImprimir={() => setParaImprimir({ pedido })}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4 self-start rounded-3xl bg-surface p-5">
        <h2 className="text-xl font-semibold">Pedidos listos</h2>
        {pedidosListos.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay pedidos listos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedidosListos.map((pedido) => {
              const espera = pedido.fechaListo ? esperaDe(pedido.fechaListo, ahora) : null
              return (
                <li key={pedido.idPedido} className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
                  <span className="size-2 shrink-0 rounded-full bg-order-ready" />
                  <span className="font-semibold">#{pedido.idPedido}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{pedido.cliente}</span>
                  {espera && <span className={`shrink-0 text-xs ${colorEspera(espera.minutos)}`}>{espera.texto.replace('Hace ', '')}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </main>
    {paraImprimir && <ComandaCocina pedido={paraImprimir.pedido} />}
    </>
  )
}
