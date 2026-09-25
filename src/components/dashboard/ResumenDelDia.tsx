'use client'

// Resumen del día para el Dashboard: números grandes, sin gráficos (los gráficos
// detallados van en Reportes). Los datos salen de usePedidosPantalla(), así que cuando
// exista la API de pedidos este componente no cambia.

import { useSyncExternalStore, type ReactNode } from 'react'
import {
  Banknote, Bike, CalendarDays, CheckCheck, ChefHat, CircleCheck, Clock, ClipboardList, ExternalLink, Flame,
  Globe, Landmark, Receipt, ShoppingBag, Store, Wallet, type LucideIcon,
} from '@/components/icons'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import {
  usePedidosPantalla,
  type EstadoPedidoPantalla,
  type PedidoPantalla,
} from '@/lib/pedidos-pantallas'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })

const estados: Record<EstadoPedidoPantalla, { texto: string; color: string; punto: string }> = {
  recibido: { texto: 'Recibido', color: 'text-accent', punto: 'bg-accent' },
  en_preparacion: { texto: 'En preparación', color: 'text-order-preparing', punto: 'bg-order-preparing' },
  listo: { texto: 'Listo', color: 'text-order-ready', punto: 'bg-order-ready' },
  enviado: { texto: 'Enviado', color: 'text-accent', punto: 'bg-accent' },
  entregado: { texto: 'Entregado', color: 'text-order-delivered', punto: 'bg-order-delivered' },
}

function esDeHoy(pedido: PedidoPantalla, hoy: Date) {
  const fecha = new Date(pedido.fecha)
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  )
}

function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-5 shadow-sm ${className}`}>{children}</div>
}

function Indicador({
  titulo,
  valor,
  detalle,
  icono: Icono,
  destacado = false,
}: {
  titulo: string
  valor: string
  detalle: ReactNode
  icono: LucideIcon
  destacado?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl p-5 shadow-sm ${destacado ? 'bg-accent text-on-accent' : 'bg-surface'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${destacado ? '' : 'text-muted'}`}>{titulo}</p>
        <span
          className={`flex size-9 items-center justify-center rounded-full ${destacado ? 'bg-on-accent/20' : 'bg-accent-soft text-accent'}`}
        >
          <Icono className="size-4" />
        </span>
      </div>
      <p className="text-3xl font-bold tracking-tight">{valor}</p>
      <p className={`text-xs ${destacado ? 'text-on-accent/80' : 'text-muted'}`}>{detalle}</p>
    </div>
  )
}

function EncabezadoTarjeta({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg">{titulo}</h2>
      <p className="text-xs text-muted">{subtitulo}</p>
    </div>
  )
}

const sinSuscripcion = () => () => {}

export function ResumenDelDia({ nombre }: { nombre: string }) {
  const { sucursal } = useSucursalActiva()
  const { pedidos } = usePedidosPantalla(sucursal?.idSucursal ?? null)
  // "Hoy" y las horas dependen de la zona horaria del navegador: se calculan solo en el
  // cliente para no generar diferencias de hidratación con el render del servidor.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false)

  if (!enCliente) {
    return <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando resumen...</p>
  }

  const hoy = new Date()
  const deHoy = pedidos.filter((pedido) => esDeHoy(pedido, hoy))

  const cobrados = deHoy.filter((pedido) => pedido.estadoPago === 'pagado')
  const ventas = cobrados.reduce((suma, pedido) => suma + pedido.total, 0)
  const porCobrar = deHoy
    .filter((pedido) => pedido.estadoPago === 'pendiente')
    .reduce((suma, pedido) => suma + pedido.total, 0)
  const ticketPromedio = cobrados.length > 0 ? ventas / cobrados.length : 0
  const online = deHoy.filter((pedido) => pedido.origen === 'online').length
  const enCurso = deHoy.filter((pedido) => pedido.estado !== 'entregado').length
  const entregados = deHoy.filter((pedido) => pedido.estado === 'entregado')
  const entregadosRetiro = entregados.filter((pedido) => pedido.tipoEntrega === 'retiro').length

  const porEstado = (estado: EstadoPedidoPantalla) =>
    deHoy.filter((pedido) => pedido.estado === estado).length

  const cobradoPor = (metodo: PedidoPantalla['metodoPago']) =>
    cobrados.filter((pedido) => pedido.metodoPago === metodo).reduce((suma, pedido) => suma + pedido.total, 0)

  const unidadesPorProducto = new Map<string, number>()
  for (const pedido of deHoy) {
    for (const item of pedido.items) {
      unidadesPorProducto.set(item.producto, (unidadesPorProducto.get(item.producto) ?? 0) + item.cantidad)
    }
  }
  const masVendidos = [...unidadesPorProducto.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const ultimos = [...deHoy]
    .sort((a, b) => b.idPedido - a.idPedido)
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Hola, {nombre.split(' ')[0]}</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays className="size-4" />
            <span className="first-letter:uppercase">{formatoFecha.format(hoy)}</span>
          </p>
        </div>
        <a
          href="/pantallas/caja"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Wallet className="size-4" />
          Abrir caja
          <ExternalLink className="size-3.5" />
        </a>
      </header>

      <section aria-label="Indicadores del día" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          destacado
          titulo="Ventas del día"
          valor={formatoPrecio.format(ventas)}
          icono={Banknote}
          detalle={`${cobrados.length} ${cobrados.length === 1 ? 'pedido cobrado' : 'pedidos cobrados'}`}
        />
        <Indicador
          titulo="Pedidos"
          valor={String(deHoy.length)}
          icono={ClipboardList}
          detalle={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><Store className="size-3.5" />{deHoy.length - online} mostrador</span>
              <span className="inline-flex items-center gap-1"><Globe className="size-3.5" />{online} online</span>
            </span>
          }
        />
        <Indicador
          titulo="Ticket promedio"
          valor={formatoPrecio.format(ticketPromedio)}
          icono={Receipt}
          detalle="Sobre los pedidos cobrados"
        />
        <Indicador
          titulo="Por cobrar"
          valor={formatoPrecio.format(porCobrar)}
          icono={Clock}
          detalle="Pedidos con pago pendiente"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta
            titulo="Pedidos ahora"
            subtitulo={`${enCurso} en curso · ${entregados.length} ${entregados.length === 1 ? 'entregado' : 'entregados'} hoy`}
          />
          {/* Los 4 estados en curso y, separado por una línea, el cierre del flujo. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto_minmax(0,1fr)]">
            {([
              { estado: 'recibido', icono: ClipboardList },
              { estado: 'en_preparacion', icono: ChefHat },
              { estado: 'listo', icono: CircleCheck },
              { estado: 'enviado', icono: Bike },
            ] as const).map(({ estado, icono: Icono }) => (
              <div key={estado} className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                <span className={`inline-flex items-center gap-1.5 text-xs ${estados[estado].color}`}>
                  <Icono className="size-4" />
                  {estados[estado].texto}
                </span>
                <span className="text-4xl font-bold">{porEstado(estado)}</span>
              </div>
            ))}
            <span aria-hidden="true" className="hidden w-px self-stretch bg-border sm:block" />
            <div className="col-span-2 flex flex-col gap-3 rounded-2xl border border-border p-4 sm:col-span-1">
              <span className={`inline-flex items-center gap-1.5 text-xs ${estados.entregado.color}`}>
                <CheckCheck className="size-4" />
                Entregados hoy
              </span>
              <span className="text-4xl font-bold">{entregados.length}</span>
              <span className="-mt-1 text-xs text-muted">
                {entregadosRetiro} retiro · {entregados.length - entregadosRetiro} delivery
              </span>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Cobrado por método" subtitulo="Pedidos pagados hoy" />
          <ul className="flex flex-col gap-3">
            {([
              { metodo: 'efectivo', texto: 'Efectivo', icono: Banknote },
              { metodo: 'transferencia', texto: 'Transferencia', icono: Landmark },
            ] as const).map(({ metodo, texto, icono: Icono }) => (
              <li key={metodo} className="flex items-center justify-between gap-3 rounded-2xl bg-bg p-4">
                <span className="inline-flex items-center gap-3 text-sm">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icono className="size-4" />
                  </span>
                  {texto}
                </span>
                <span className="text-lg font-bold">{formatoPrecio.format(cobradoPor(metodo))}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Más vendidos" subtitulo="Unidades pedidas hoy" />
          {masVendidos.length === 0 ? (
            <p className="rounded-2xl bg-bg p-6 text-center text-sm text-muted">Todavía no hay ventas hoy.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {masVendidos.map(([producto, unidades], indice) => (
                <li key={producto} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm ${indice === 0 ? 'bg-accent text-on-accent' : 'bg-bg text-muted'}`}
                  >
                    {indice === 0 ? <Flame className="size-4" /> : indice + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{producto}</span>
                  <span className="shrink-0 text-sm text-muted">
                    <span className="font-bold text-text">{unidades}</span> u.
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>

        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Últimos pedidos" subtitulo="Los 5 más recientes del día" />
          {ultimos.length === 0 ? (
            <p className="rounded-2xl bg-bg p-6 text-center text-sm text-muted">Todavía no hay pedidos hoy.</p>
          ) : (
            <ul className="flex flex-col">
              {ultimos.map((pedido) => {
                const Entrega = pedido.tipoEntrega === 'delivery' ? Bike : ShoppingBag
                return (
                  <li
                    key={pedido.idPedido}
                    className="flex items-center gap-3 border-t border-bg py-3 first:border-t-0 first:pt-0"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Entrega className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <strong className="font-bold">#{pedido.idPedido}</strong> · {pedido.cliente}
                      </p>
                      <p className="text-xs text-muted">
                        {formatoHora.format(new Date(pedido.fecha))} ·{' '}
                        {pedido.tipoEntrega === 'delivery' ? 'Delivery' : 'Retiro'}
                        {pedido.origen === 'online' && ' · Online'}
                        {pedido.estadoPago === 'pendiente' && <span className="text-warning"> · Pago pendiente</span>}
                      </p>
                    </div>
                    <span className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${estados[pedido.estado].color}`}>
                      <span className={`size-1.5 rounded-full ${estados[pedido.estado].punto}`} />
                      {estados[pedido.estado].texto}
                    </span>
                    <span className="w-24 shrink-0 text-right font-bold">{formatoPrecio.format(pedido.total)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}
