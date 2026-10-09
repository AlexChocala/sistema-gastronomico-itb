'use client'

// Pantalla de Entregas (pestaña aparte, sin sidebar): va detrás del mostrador, del lado
// del local. Muestra lo que Cocina ya dejó listo y tiene un solo trabajo: entregarlo.
//   - Retiro en mostrador: el empleado compara el ticket del cliente y marca "Entregado".
//   - Delivery: el cadete se acerca, se marca "Despachado con delivery" y, cuando vuelve
//     confirmado, "Entregado" (cobrado si el efectivo estaba pendiente).
// Se distingue de lejos: despachar (paso intermedio) = tarjeta blanca y botón claro;
// entregar (cierra el pedido) = botón naranja sólido, y los deliveries en camino además
// llevan la tarjeta naranja suave.
// Usa los mismos estados que Pedidos, así que lo que se marca acá se ve en todas partes.

import { useState } from 'react'
import { Banknote, Bike, CheckCheck, CircleUserRound, MapPin, ShoppingBag } from '@/components/icons'
import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { PastillaSucursal, useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { usePedidosPantalla, type PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { textoOpciones } from '@/lib/pedidos/pedidos-estados'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

// cierra: la acción termina el pedido (Entregado); si no, es un paso intermedio (Despachado).
type Accion = { texto: string; ejecutar: () => Promise<unknown>; cierra: boolean }

function TarjetaEntrega({ pedido, accion, enCamino = false }: { pedido: PedidoPantalla; accion: Accion; enCamino?: boolean }) {
  // Bloquea el botón hasta que responda el servidor, para que un doble toque no repita la acción.
  const [enviando, setEnviando] = useState(false)
  // Efectivo que todavía no se cobró: se cobra al entregar.
  const cobraAlEntregar = pedido.estadoPago !== 'pagado' && pedido.metodoPago === 'efectivo'
  const esDelivery = pedido.tipoEntrega === 'delivery'

  async function confirmar() {
    setEnviando(true)
    try {
      await accion.ejecutar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <article
      className={`flex flex-col rounded-3xl border-2 p-5 shadow-sm ${
        enCamino ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CircleUserRound className="size-6 shrink-0 text-order-ready" strokeWidth={1.75} />
          <span className="truncate text-lg">{pedido.cliente}</span>
        </div>
        <span className="shrink-0 text-lg">
          Pedido <strong className="font-bold">#{pedido.idPedido}</strong>
        </span>
      </header>

      {esDelivery && pedido.direccion && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span className="break-words">
            {pedido.direccion}
            {pedido.localidad ? `, ${pedido.localidad}` : ''}
          </span>
        </p>
      )}

      <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-base">
        {pedido.items.map((item, indice) => {
          const opciones = textoOpciones(item.variacion, item.extras)
          return (
            <li key={indice} className="flex gap-2">
              <span className="w-7 shrink-0 text-muted">{item.cantidad}x</span>
              <span className="min-w-0">
                {item.producto}
                {opciones && <span className="block text-sm break-words text-muted">{opciones}</span>}
              </span>
            </li>
          )
        })}
      </ul>

      {cobraAlEntregar && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-warning-surface px-4 py-3 font-semibold">
          <Banknote className="size-5 shrink-0 text-warning" strokeWidth={2} />
          Cobrar {formatoPrecio.format(pedido.total)} en efectivo
        </p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={enviando}
          className={`w-full cursor-pointer rounded-full py-3 font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
            accion.cierra
              ? 'bg-accent text-on-accent hover:bg-accent-hover'
              : 'border-2 border-border bg-surface hover:bg-bg'
          }`}
        >
          {accion.texto}
        </button>
      </div>
    </article>
  )
}

function Columna({
  titulo, icono: Icono, vacio, cantidad, children,
}: {
  titulo: string
  icono: typeof Bike
  vacio: string
  cantidad: number
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icono className="size-5" strokeWidth={2} />
        {titulo}
        <span className="text-base font-normal text-muted">({cantidad})</span>
      </h2>
      {cantidad === 0 ? (
        <p className="rounded-3xl bg-surface p-8 text-center text-muted">{vacio}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">{children}</div>
      )}
    </section>
  )
}

export default function EntregasPage() {
  const { sucursal } = useSucursalActiva()
  const {
    pedidos, cargando, error, recargar, errorAccion, limpiarErrorAccion, marcarEnviado, marcarEntregado,
  } = usePedidosPantalla(sucursal?.idSucursal ?? null)

  const aRetirar = pedidos.filter((p) => p.estado === 'listo' && p.tipoEntrega === 'retiro')
  const aDespachar = pedidos.filter((p) => p.estado === 'listo' && p.tipoEntrega === 'delivery')
  const enCamino = pedidos.filter((p) => p.estado === 'enviado')

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-bg p-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="screen-title">Entregas</h1>
          <PastillaSucursal />
        </div>
        <p className="mt-1 text-muted">Pedidos listos para entregar al cliente o al cadete.</p>
      </header>

      <EstadoConexion
        error={error}
        errorAccion={errorAccion}
        onReintentar={() => void recargar()}
        onCerrarAviso={limpiarErrorAccion}
      />

      {cargando ? (
        <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando pedidos...</p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          <Columna titulo="Retiro en mostrador" icono={ShoppingBag} cantidad={aRetirar.length} vacio="No hay pedidos para retirar.">
            {aRetirar.map((pedido) => (
              <TarjetaEntrega
                key={pedido.idPedido}
                pedido={pedido}
                accion={{ texto: 'Entregado', ejecutar: () => marcarEntregado(pedido.idPedido), cierra: true }}
              />
            ))}
          </Columna>

          <div className="flex flex-col gap-8">
            <Columna titulo="Delivery: para despachar" icono={Bike} cantidad={aDespachar.length} vacio="No hay pedidos para despachar.">
              {aDespachar.map((pedido) => (
                <TarjetaEntrega
                  key={pedido.idPedido}
                  pedido={pedido}
                  accion={{ texto: 'Despachado con delivery', ejecutar: () => marcarEnviado(pedido.idPedido), cierra: false }}
                />
              ))}
            </Columna>

            {enCamino.length > 0 && (
              <Columna titulo="Delivery: en camino" icono={CheckCheck} cantidad={enCamino.length} vacio="">
                {enCamino.map((pedido) => (
                  <TarjetaEntrega
                    key={pedido.idPedido}
                    pedido={pedido}
                    enCamino
                    accion={{
                      cierra: true,
                      texto: pedido.estadoPago !== 'pagado' && pedido.metodoPago === 'efectivo' ? 'Entregado y cobrado' : 'Entregado',
                      ejecutar: () => marcarEntregado(pedido.idPedido),
                    }}
                  />
                ))}
              </Columna>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
