'use client'

// Pantalla de Entregas (pestaña aparte, sin sidebar): va detrás del mostrador, del lado
// del local. Muestra lo que Cocina ya dejó listo y tiene un solo trabajo: entregarlo.
//   - Retiro en mostrador: el empleado compara el ticket del cliente y marca "Entregado".
//   - Delivery: el cadete se acerca, se marca "Despachado con delivery" y, cuando vuelve
//     confirmado, "Entregado" (cobrado si el efectivo estaba pendiente).
// Se distingue de lejos: despachar (paso intermedio) = tarjeta blanca y botón claro;
// entregar (cierra el pedido) = botón naranja sólido, y los deliveries en camino además
// llevan un borde gris. Las tres columnas van juntas, de izquierda a derecha según
// avanza el pedido.
// Usa los mismos estados que Pedidos, así que lo que se marca acá se ve en todas partes.

import { useState } from 'react'
import { Banknote, Bike, Clock, MapPin, ShoppingBag, Truck } from '@/components/icons'
import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { OpcionesItem } from '@/components/pedidos/OpcionesItem'
import { PastillaSucursal, useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { ModalPin } from '@/components/caja/ModalPin'
import { useLocalAbierto, useTurnoCaja } from '@/lib/caja/turnos-cliente'
import { LocalCerrado } from '@/components/caja/LocalCerrado'
import { usePedidosPantalla, type PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { colorEspera, esperaDe, useAhora } from '@/lib/pedidos/tiempo'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

// cierra: la acción termina el pedido (Entregado); si no, es un paso intermedio (Despachado).
type Accion = { texto: string; ejecutar: () => Promise<unknown>; cierra: boolean }

function TarjetaEntrega({
  pedido, accion, ahora, enCamino = false,
}: {
  pedido: PedidoPantalla
  accion: Accion
  ahora: number
  enCamino?: boolean
}) {
  // Cuánto hace que está listo y nadie lo retiró o despachó.
  const espera = pedido.estado === 'listo' && pedido.fechaListo ? esperaDe(pedido.fechaListo, ahora) : null
  // Bloquea el botón hasta que responda el servidor, para que un doble toque no repita la acción.
  const [enviando, setEnviando] = useState(false)
  // Efectivo que todavía no se cobró: se cobra al entregar.
  const cobraAlEntregar = pedido.estadoPago === 'pendiente' && pedido.metodoPago === 'efectivo'
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
      className={`flex flex-col rounded-3xl border-2 bg-surface p-5 shadow-sm ${
        enCamino ? 'border-border' : 'border-transparent'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-lg">{pedido.cliente}</span>
        <strong className="shrink-0 text-2xl font-bold">#{pedido.idPedido}</strong>
      </header>

      {espera && (
        <p className={`mt-2 inline-flex items-center gap-1.5 text-sm ${colorEspera(espera.minutos)}`}>
          <Clock className="size-4" strokeWidth={2} />
          Listo {espera.texto.toLowerCase()}
        </p>
      )}

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
        {pedido.items.map((item, indice) => (
          <li key={indice} className="flex gap-2">
            <span className="w-7 shrink-0 text-muted">{item.cantidad}x</span>
            <div className="min-w-0">
              {item.producto}
              <OpcionesItem variacion={item.variacion} extras={item.extras} />
            </div>
          </li>
        ))}
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
              ? 'bg-brand text-on-brand hover:bg-brand-hover'
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
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icono className="size-5" strokeWidth={2} />
        {titulo}
        <span className="text-base font-normal text-muted">({cantidad})</span>
      </h2>
      {cantidad === 0 ? (
        <p className="rounded-3xl bg-surface p-8 text-center text-muted">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-4">{children}</div>
      )}
    </section>
  )
}

export default function EntregasPage() {
  const { sucursal } = useSucursalActiva()
  const ahora = useAhora()
  const {
    pedidos, cargando, error, recargar, errorAccion, limpiarErrorAccion, marcarEnviado, marcarEntregado,
  } = usePedidosPantalla(sucursal?.idSucursal ?? null)
  // Entregar un pedido con efectivo por cobrar pide el PIN de quien recibe la plata, que entra
  // a la caja con turno abierto.
  const { caja, turno } = useTurnoCaja()
  const localAbierto = useLocalAbierto()
  const [cobrando, setCobrando] = useState<PedidoPantalla | null>(null)
  const entregar = (pedido: PedidoPantalla) =>
    pedido.estadoPago === 'pendiente' ? Promise.resolve(setCobrando(pedido)) : marcarEntregado(pedido.idPedido)

  // Los que llevan más tiempo listos van primero.
  const masAntiguosPrimero = (a: PedidoPantalla, b: PedidoPantalla) =>
    new Date(a.fechaListo ?? a.fecha).getTime() - new Date(b.fechaListo ?? b.fecha).getTime()
  const aRetirar = pedidos.filter((p) => p.estado === 'listo' && p.tipoEntrega === 'retiro').sort(masAntiguosPrimero)
  const aDespachar = pedidos.filter((p) => p.estado === 'listo' && p.tipoEntrega === 'delivery').sort(masAntiguosPrimero)
  const enCamino = pedidos.filter((p) => p.estado === 'enviado')

  // Sin caja abierta y sin pedidos por entregar, la pantalla descansa.
  if (localAbierto === false && !cargando && aRetirar.length === 0 && aDespachar.length === 0 && enCamino.length === 0) {
    return <LocalCerrado titulo="Entregas" />
  }

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
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Columna titulo="Retiro en mostrador" icono={ShoppingBag} cantidad={aRetirar.length} vacio="No hay pedidos para retirar.">
            {aRetirar.map((pedido) => (
              <TarjetaEntrega
                key={pedido.idPedido}
                ahora={ahora}
                pedido={pedido}
                accion={{ texto: pedido.estadoPago === 'pendiente' ? 'Entregado y cobrado' : 'Entregado', ejecutar: () => entregar(pedido), cierra: true }}
              />
            ))}
          </Columna>

          <Columna titulo="Delivery: para despachar" icono={Bike} cantidad={aDespachar.length} vacio="No hay pedidos para despachar.">
            {aDespachar.map((pedido) => (
              <TarjetaEntrega
                key={pedido.idPedido}
                ahora={ahora}
                pedido={pedido}
                accion={{ texto: 'Despachado con delivery', ejecutar: () => marcarEnviado(pedido.idPedido), cierra: false }}
              />
            ))}
          </Columna>

          <Columna titulo="Delivery: en camino" icono={Truck} cantidad={enCamino.length} vacio="No hay deliveries en camino.">
            {enCamino.map((pedido) => (
              <TarjetaEntrega
                key={pedido.idPedido}
                ahora={ahora}
                pedido={pedido}
                enCamino
                accion={{
                  cierra: true,
                  texto: pedido.estadoPago === 'pendiente' ? 'Entregado y cobrado' : 'Entregado',
                  ejecutar: () => entregar(pedido),
                }}
              />
            ))}
          </Columna>
        </div>
      )}

      {cobrando && (
        <ModalPin
          titulo={`Cobrar pedido #${cobrando.idPedido}`}
          descripcion={`Recibís ${formatoPrecio.format(cobrando.total)} en efectivo.`}
          textoBoton="Entregado y cobrado"
          aviso={turno ? undefined : 'La caja está cerrada. Abrila desde Caja para registrar el cobro.'}
          onCerrar={() => setCobrando(null)}
          onConfirmar={async (pin) => {
            const resultado = await marcarEntregado(cobrando.idPedido, { pin, idCaja: caja!.idCaja })
            return resultado.ok ? null : resultado.error
          }}
        />
      )}
    </main>
  )
}
