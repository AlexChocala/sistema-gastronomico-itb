// Etiquetas de pedido compartidas por Pedidos, Dashboard, Cocina y Entregas: así el mismo
// estado se ve igual en todas las pantallas. Los colores salen de los tokens de
// styles/theme.css (el naranja de marca queda para las acciones, no para los estados).

import { Banknote, Bike, Landmark, ShoppingBag } from '@/components/icons'
import type {
  EstadoPagoPantalla,
  EstadoPedidoPantalla,
  PedidoPantalla,
} from '@/lib/pedidos/pedidos-pantallas'

// `color` es el del texto; `colorIcono` el de los íconos. El ámbar de "en preparación" tiene
// poco contraste como texto chico (2.9:1), pero se mantiene para que el estado se reconozca.
export const ESTADO_PEDIDO: Record<EstadoPedidoPantalla, { texto: string; color: string; colorIcono: string; punto: string }> = {
  pendiente_pago: { texto: 'Esperando comprobante', color: 'text-warning', colorIcono: 'text-warning', punto: 'bg-warning' },
  recibido: { texto: 'Recibido', color: 'text-order-received', colorIcono: 'text-order-received', punto: 'bg-order-received' },
  en_preparacion: { texto: 'En preparación', color: 'text-order-preparing', colorIcono: 'text-order-preparing', punto: 'bg-order-preparing' },
  listo: { texto: 'Listo', color: 'text-order-ready', colorIcono: 'text-order-ready', punto: 'bg-order-ready' },
  enviado: { texto: 'Enviado', color: 'text-order-sent', colorIcono: 'text-order-sent', punto: 'bg-order-sent' },
  entregado: { texto: 'Entregado', color: 'text-order-delivered', colorIcono: 'text-order-delivered', punto: 'bg-order-delivered' },
  cancelado: { texto: 'Cancelado', color: 'text-danger', colorIcono: 'text-danger', punto: 'bg-danger' },
}

// Punto + texto del estado. `texto` permite otro nombre (Cocina dice "Nuevo" en vez de "Recibido").
export function EstadoPedidoTexto({
  estado,
  texto,
  className = '',
}: {
  estado: EstadoPedidoPantalla
  texto?: string
  className?: string
}) {
  const visual = ESTADO_PEDIDO[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${visual.color} ${className}`}>
      <span className={`size-2 shrink-0 rounded-full ${visual.punto}`} />
      {texto ?? visual.texto}
    </span>
  )
}

// Retiro o delivery: neutra, porque es una categoría y no un estado.
export function EtiquetaEntrega({ tipo }: { tipo: PedidoPantalla['tipoEntrega'] }) {
  const Icono = tipo === 'delivery' ? Bike : ShoppingBag
  return (
    <span className="chip bg-bg text-text">
      <Icono className="size-4" strokeWidth={2} />
      {tipo === 'delivery' ? 'Delivery' : 'Para retirar'}
    </span>
  )
}

const TEXTO_PAGO: Record<EstadoPagoPantalla, string> = {
  pendiente: 'Pago pendiente',
  pendiente_verificacion: 'Transferencia a verificar',
  pagado: 'Pagado',
}

export function EtiquetaPago({
  estado,
  metodo,
  className = '',
}: {
  estado: EstadoPagoPantalla
  metodo?: PedidoPantalla['metodoPago']
  className?: string
}) {
  const color = estado === 'pagado' ? 'bg-success-surface text-success' : 'bg-danger-surface text-danger'
  const Icono = metodo === 'efectivo' ? Banknote : Landmark
  return (
    <span className={`chip ${color} ${className}`}>
      {metodo && <Icono className="size-4" strokeWidth={2} />}
      {TEXTO_PAGO[estado]}
    </span>
  )
}
