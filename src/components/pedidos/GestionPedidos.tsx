'use client'

// Pantalla de Pedidos del panel: seguimiento y cierre de cada pedido.
//
// Cada tarjeta muestra UNA acción principal según cómo se cargó el pedido:
//   Retiro    listo → "Marcar entregado"
//   Delivery  listo → "Enviar con cadete" → "Marcar entregado"
// Si el cliente cambia de idea, "Cambiar a delivery / retiro" es una acción secundaria
// (solo antes de que salga el pedido), para que un click de más no ensucie los datos.

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Banknote, Bike, CheckCheck, ChefHat, CircleCheck, Landmark, RotateCcw, Search, ShoppingBag,
  type LucideIcon,
} from '@/components/icons'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import {
  puedeIrACocina,
  usePedidosPantalla,
  type EstadoPedidoPantalla,
  type PedidoPantalla,
} from '@/lib/pedidos-pantallas'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })
const formatoDia = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function mismoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "16:30" si es de hoy, "Ayer · 16:30" o "24 sept · 16:30" si no: sin la fecha, un
// pedido viejo parece del día y no coincide con lo que cuenta el Dashboard.
function cuandoSeCargo(fechaIso: string) {
  const fecha = new Date(fechaIso)
  const hora = formatoHora.format(fecha)
  const hoy = new Date()
  if (mismoDia(fecha, hoy)) return hora
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  return `${mismoDia(fecha, ayer) ? 'Ayer' : formatoDia.format(fecha)} · ${hora}`
}

const etiquetaEntrega = {
  retiro: { texto: 'Para retirar', icono: ShoppingBag, clase: 'bg-accent-soft text-accent' },
  delivery: { texto: 'Delivery', icono: Bike, clase: 'bg-warning-surface text-warning' },
}

const estados: Record<EstadoPedidoPantalla, { texto: string; color: string; punto: string }> = {
  recibido: { texto: 'Recibido', color: 'text-accent', punto: 'bg-accent' },
  en_preparacion: { texto: 'En preparación', color: 'text-order-preparing', punto: 'bg-order-preparing' },
  listo: { texto: 'Listo', color: 'text-order-ready', punto: 'bg-order-ready' },
  enviado: { texto: 'Enviado', color: 'text-accent', punto: 'bg-accent' },
  entregado: { texto: 'Entregado', color: 'text-order-delivered', punto: 'bg-order-delivered' },
}

const filtros = [
  {
    valor: 'por_entregar',
    texto: 'Por entregar',
    incluye: (p: PedidoPantalla) => p.estado === 'listo' || p.estado === 'enviado',
  },
  {
    valor: 'en_cocina',
    texto: 'En cocina',
    incluye: (p: PedidoPantalla) =>
      (p.estado === 'recibido' || p.estado === 'en_preparacion') && puedeIrACocina(p),
  },
  {
    valor: 'pago_pendiente',
    texto: 'Pago pendiente',
    incluye: (p: PedidoPantalla) => p.estadoPago === 'pendiente' && p.estado !== 'entregado',
  },
  { valor: 'entregados', texto: 'Entregados', incluye: (p: PedidoPantalla) => p.estado === 'entregado' },
  { valor: 'todos', texto: 'Todos', incluye: () => true },
] as const

// Solo llevan contador las pestañas que piden acción: si todas lo tienen, ninguno resalta.
const filtrosConContador: readonly string[] = ['por_entregar', 'pago_pendiente']

type Filtro = (typeof filtros)[number]['valor']
type FiltroEntrega = 'todas' | 'retiro' | 'delivery'

type Acciones = Pick<
  ReturnType<typeof usePedidosPantalla>,
  'marcarEnviado' | 'marcarEntregado' | 'marcarPagado'
>

type AccionPrincipal = { texto: string; icono: LucideIcon; confirmacion: string; ejecutar: () => void }

// Decide el único botón principal de la tarjeta. `null` + `pista` cuando no hay nada
// para hacer desde esta pantalla (por ejemplo, el pedido está en manos de Cocina).
function accionPrincipal(
  pedido: PedidoPantalla,
  acciones: Acciones,
): { accion: AccionPrincipal | null; pista: string } {
  const { idPedido, estado, tipoEntrega, estadoPago, metodoPago } = pedido
  const cobraAlEntregar = estadoPago === 'pendiente'

  if (estado === 'entregado') return { accion: null, pista: '' }

  if (!puedeIrACocina(pedido)) {
    return {
      accion: {
        texto: 'Verificar transferencia',
        icono: Landmark,
        confirmacion: `Transferencia del pedido #${idPedido} verificada. Pasa a Cocina.`,
        ejecutar: () => acciones.marcarPagado(idPedido),
      },
      pista: 'Verificá el comprobante antes de enviarlo a Cocina.',
    }
  }

  if (estado === 'recibido' || estado === 'en_preparacion') {
    return { accion: null, pista: 'En cocina. Se habilita cuando esté listo.' }
  }

  if (tipoEntrega === 'retiro') {
    return {
      accion: {
        texto: cobraAlEntregar ? 'Cobrar y entregar' : 'Marcar entregado',
        icono: cobraAlEntregar ? Banknote : CheckCheck,
        confirmacion: `Pedido #${idPedido} entregado en mostrador.`,
        ejecutar: () => acciones.marcarEntregado(idPedido),
      },
      pista: cobraAlEntregar ? `Cobrar ${formatoPrecio.format(pedido.total)} en ${metodoPago}.` : '',
    }
  }

  if (estado === 'listo') {
    return {
      accion: {
        texto: 'Enviar con cadete',
        icono: Bike,
        confirmacion: `Pedido #${idPedido} salió con el cadete.`,
        ejecutar: () => acciones.marcarEnviado(idPedido),
      },
      pista: '',
    }
  }

  return {
    accion: {
      texto: cobraAlEntregar ? 'Entregado y cobrado' : 'Marcar entregado',
      icono: CheckCheck,
      confirmacion: `Pedido #${idPedido} entregado por delivery.`,
      ejecutar: () => acciones.marcarEntregado(idPedido),
    },
    pista: cobraAlEntregar ? `El cadete cobra ${formatoPrecio.format(pedido.total)} en efectivo.` : '',
  }
}

function TarjetaPedido({
  pedido,
  acciones,
  onCambiarEntrega,
  onAccion,
}: {
  pedido: PedidoPantalla
  acciones: Acciones
  onCambiarEntrega: () => void
  onAccion: (accion: AccionPrincipal) => void
}) {
  const entrega = etiquetaEntrega[pedido.tipoEntrega]
  const IconoEntrega = entrega.icono
  const estado = estados[pedido.estado]
  const { accion, pista } = accionPrincipal(pedido, acciones)
  const puedeCambiarEntrega = pedido.estado !== 'enviado' && pedido.estado !== 'entregado'
  const itemsVisibles = pedido.items.slice(0, 4)
  const itemsOcultos = pedido.items.length - itemsVisibles.length

  return (
    <article
      className={`flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm ${pedido.estado === 'entregado' ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg">{pedido.cliente}</h3>
          <p className="text-xs text-muted">
            {cuandoSeCargo(pedido.fecha)} · {pedido.origen === 'online' ? 'Pedido online' : 'Cargado en caja'}
          </p>
        </div>
        <span className="shrink-0 text-lg font-bold">#{pedido.idPedido}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${entrega.clase}`}>
          <IconoEntrega className="size-3.5" />
          {entrega.texto}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-xs ${estado.color}`}>
          <span className={`size-1.5 rounded-full ${estado.punto}`} />
          {estado.texto}
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${pedido.estadoPago === 'pagado' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
        >
          {pedido.metodoPago === 'efectivo' ? <Banknote className="size-3.5" /> : <Landmark className="size-3.5" />}
          {pedido.estadoPago === 'pagado' ? 'Pagado' : 'Pago pendiente'}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        {itemsVisibles.map((item) => (
          <li key={item.producto} className="flex gap-3">
            <span className="w-6 shrink-0 text-muted">{item.cantidad}x</span>
            <span className="min-w-0 flex-1">{item.producto}</span>
          </li>
        ))}
        {itemsOcultos > 0 && (
          <li className="pl-9 text-xs text-muted">
            + {itemsOcultos} {itemsOcultos === 1 ? 'producto más' : 'productos más'}
          </li>
        )}
      </ul>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-bold">{formatoPrecio.format(pedido.total)}</span>
        </div>

        {accion ? (
          <button
            type="button"
            onClick={() => onAccion(accion)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm text-on-accent transition-colors hover:bg-accent-hover"
          >
            <accion.icono className="size-4" />
            {accion.texto}
          </button>
        ) : pedido.estado === 'entregado' ? (
          <p className="inline-flex items-center justify-center gap-2 rounded-full bg-bg py-3 text-sm text-muted">
            <CircleCheck className="size-4" />
            {pedido.tipoEntrega === 'delivery' ? 'Entregado por delivery' : 'Entregado en mostrador'}
          </p>
        ) : (
          <p className="inline-flex items-center justify-center gap-2 rounded-full bg-bg py-3 text-sm text-muted">
            <ChefHat className="size-4" />
            {pista}
          </p>
        )}

        {accion && pista && <p className="-mt-1 text-center text-xs text-muted">{pista}</p>}

        {puedeCambiarEntrega && (
          <button
            type="button"
            onClick={onCambiarEntrega}
            className="cursor-pointer self-center text-xs text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
          >
            {pedido.tipoEntrega === 'retiro' ? 'Cambiar a delivery' : 'Cambiar a retiro en mostrador'}
          </button>
        )}
      </div>
    </article>
  )
}

const sinSuscripcion = () => () => {}

type UltimaAccion = { texto: string; anterior: PedidoPantalla }

export function GestionPedidos() {
  const { sucursal } = useSucursalActiva()
  const pedidosPantalla = usePedidosPantalla(sucursal?.idSucursal ?? null)
  const { pedidos, cambiarTipoEntrega, restaurarPedido } = pedidosPantalla
  // Las horas dependen de la zona horaria del navegador: se muestran solo en el cliente.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false)

  const [filtro, setFiltro] = useState<Filtro>('por_entregar')
  const [filtroEntrega, setFiltroEntrega] = useState<FiltroEntrega>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [ultimaAccion, setUltimaAccion] = useState<UltimaAccion | null>(null)

  // El aviso con "Deshacer" se oculta solo a los pocos segundos.
  useEffect(() => {
    if (!ultimaAccion) return
    const temporizador = setTimeout(() => setUltimaAccion(null), 6000)
    return () => clearTimeout(temporizador)
  }, [ultimaAccion])

  if (!enCliente) {
    return <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando pedidos...</p>
  }

  const texto = busqueda.trim().toLowerCase().replace('#', '')
  const coincideBusqueda = (p: PedidoPantalla) =>
    texto === '' || p.cliente.toLowerCase().includes(texto) || String(p.idPedido).includes(texto)
  const coincideEntrega = (p: PedidoPantalla) => filtroEntrega === 'todas' || p.tipoEntrega === filtroEntrega

  const base = pedidos.filter((p) => coincideBusqueda(p) && coincideEntrega(p))
  const filtroActivo = filtros.find((f) => f.valor === filtro) ?? filtros[0]
  const visibles = base.filter(filtroActivo.incluye).sort((a, b) => b.idPedido - a.idPedido)

  function ejecutar(pedido: PedidoPantalla, accion: AccionPrincipal) {
    accion.ejecutar()
    setUltimaAccion({ texto: accion.confirmacion, anterior: pedido })
  }

  function cambiarEntrega(pedido: PedidoPantalla) {
    const nuevo = pedido.tipoEntrega === 'retiro' ? 'delivery' : 'retiro'
    cambiarTipoEntrega(pedido.idPedido, nuevo)
    setUltimaAccion({
      texto: `Pedido #${pedido.idPedido} cambiado a ${nuevo === 'delivery' ? 'delivery' : 'retiro en mostrador'}.`,
      anterior: pedido,
    })
  }

  function deshacer() {
    if (!ultimaAccion) return
    restaurarPedido(ultimaAccion.anterior)
    setUltimaAccion(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="page-title">Pedidos</h1>
        <p className="mt-1 text-sm text-muted">Entregá, cobrá y seguí cada pedido de la sucursal.</p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => {
              const cantidad = base.filter(f.incluye).length
              const activo = filtro === f.valor
              return (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setFiltro(f.valor)}
                  aria-pressed={activo}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${activo ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                >
                  {f.texto}
                  {filtrosConContador.includes(f.valor) && cantidad > 0 && (
                    <span className="min-w-5 rounded-full bg-accent px-1.5 text-xs text-on-accent">
                      {cantidad}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted/60 p-1 text-sm">
            {([
              { valor: 'todas', texto: 'Todas' },
              { valor: 'retiro', texto: 'Retiro' },
              { valor: 'delivery', texto: 'Delivery' },
            ] as const).map(({ valor, texto: etiqueta }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltroEntrega(valor)}
                aria-pressed={filtroEntrega === valor}
                className={`cursor-pointer rounded-full px-3 py-1.5 transition-colors ${filtroEntrega === valor ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <label className="flex w-full items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm sm:w-56">
            <Search className="size-4 text-muted" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente o número"
              aria-label="Buscar pedido por cliente o número"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          </div>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay pedidos en esta sección.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
          {visibles.map((pedido) => (
            <TarjetaPedido
              key={pedido.idPedido}
              pedido={pedido}
              acciones={pedidosPantalla}
              onAccion={(accion) => ejecutar(pedido, accion)}
              onCambiarEntrega={() => cambiarEntrega(pedido)}
            />
          ))}
        </div>
      )}

      {ultimaAccion && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-full bg-text py-2 pr-2 pl-5 text-sm text-surface shadow-xl"
        >
          <CircleCheck className="size-4 shrink-0 text-success" />
          <span className="min-w-0 flex-1 truncate">{ultimaAccion.texto}</span>
          <button
            type="button"
            onClick={deshacer}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-accent transition-colors hover:bg-surface/10"
          >
            <RotateCcw className="size-3.5" />
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
