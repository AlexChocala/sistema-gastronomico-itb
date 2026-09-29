// Máquina de estados de un pedido. Funciones puras, sin imports de servidor: la usan la
// API (que es la que decide, ver lib/pedidos/pedidos-internos.ts) y las pantallas, para la
// actualización optimista y para saber qué botones mostrar.
//
// Cada pedido tiene DOS estados independientes:
//   estado (la comida): pendiente_pago (solo online por transferencia) → recibido →
//                       en_preparacion → listo → enviado (solo delivery) → entregado
//   estadoPago (la plata): pendiente (efectivo online, se cobra al entregar)
//                          pendiente_verificacion (transferencia sin confirmar) → pagado
//
// Transiciones permitidas (acción: desde → hasta):
//   confirmarPago        pendiente_pago + pendiente_verificacion → recibido + pagado
//                        (solo online por transferencia)
//   marcarEnPreparacion  recibido → en_preparacion
//   marcarListo          recibido | en_preparacion → listo (Cocina ofrece "Listo" también
//                        en un pedido que nadie marcó como "Pendiente")
//   marcarEnviado        listo → enviado (solo delivery)
//   marcarEntregado      listo (retiro) | enviado (delivery) → entregado, y queda pagado
//                        (entregar cobra el efectivo pendiente)
//   deshacer             vuelve UN paso atrás: solo al estado desde el que una de las
//                        acciones de arriba lleva exactamente al estado actual.

export type EstadoPedido = 'pendiente_pago' | 'recibido' | 'en_preparacion' | 'listo' | 'enviado' | 'entregado'
export type EstadoPago = 'pendiente' | 'pendiente_verificacion' | 'pagado'
export type MetodoPago = 'efectivo' | 'transferencia'
export type TipoEntrega = 'retiro' | 'delivery'
export type OrigenPedido = 'mostrador' | 'online'

export const ESTADOS_PEDIDO: readonly EstadoPedido[] = [
  'pendiente_pago', 'recibido', 'en_preparacion', 'listo', 'enviado', 'entregado',
]

export type AccionEstado = 'confirmarPago' | 'marcarEnPreparacion' | 'marcarListo' | 'marcarEnviado' | 'marcarEntregado'

export const ACCIONES_ESTADO: readonly AccionEstado[] = [
  'confirmarPago', 'marcarEnPreparacion', 'marcarListo', 'marcarEnviado', 'marcarEntregado',
]

// Lo mínimo de un pedido que hace falta para decidir una transición.
export type PedidoTransicion = {
  origen: OrigenPedido
  tipoEntrega: TipoEntrega
  metodoPago: MetodoPago
  estado: EstadoPedido
  estadoPago: EstadoPago
}

export type Estados = Pick<PedidoTransicion, 'estado' | 'estadoPago'>

// Forma en que la API interna devuelve cada pedido a las pantallas del personal (Caja,
// Cocina, Pedidos, Dashboard). Celular, dirección e indicaciones son datos personales:
// esta forma NUNCA se devuelve en una respuesta pública (ver PedidoMostrador).
export interface ItemPedidoPantalla {
  idProducto: number
  cantidad: number
  producto: string
  precioUnitario: number
  // Opciones elegidas, por nombre (null / vacía si no tiene).
  variacion: string | null
  extras: string[]
}

// Opciones de una línea en una sola línea de texto, para cocina, pedidos y el carrito:
// "Doble · + Cheddar, + Panceta". Vacío si no tiene variación ni extras.
export function textoOpciones(variacion: string | null, extras: string[]) {
  return [variacion, extras.map((extra) => `+ ${extra}`).join(', ')].filter(Boolean).join(' · ')
}

export interface PedidoPantalla extends PedidoTransicion {
  idPedido: number
  idSucursal: number
  fecha: string // ISO
  cliente: string
  // Null en los pedidos de Caja para retirar (ahí no se pide).
  telefono: string | null
  // Solo delivery.
  direccion: string | null
  idLocalidad: number | null
  localidad: string | null
  referencias: string | null
  items: ItemPedidoPantalla[]
  total: number
}

// Lo único que ve el monitor público de Pedidos Mostrador: número, nombre de pila y estado.
export type PedidoMostrador = {
  idPedido: number
  cliente: string
  estado: 'en_preparacion' | 'listo'
}

// Zona de delivery de la sucursal (para elegir la localidad de un delivery).
export type ZonaDelivery = { idLocalidad: number; nombre: string }

// Mensaje único para cualquier transición que ya no corresponde: casi siempre es otra
// pantalla (u otra pestaña) que movió el pedido antes.
export const MENSAJE_CONFLICTO_ESTADO = 'Este pedido ya cambió de estado. Actualizamos la lista.'

// Regla única de negocio: qué pedidos ve Cocina. Solo los que tiene que preparar:
// 'recibido' y 'en_preparacion'. Un pedido por transferencia nace en 'pendiente_pago' y
// no llega a Cocina hasta que Pedidos confirma el pago (ahí pasa a 'recibido').
export function puedeIrACocina(pedido: Pick<PedidoTransicion, 'estado'>) {
  return pedido.estado === 'recibido' || pedido.estado === 'en_preparacion'
}

// El tipo de entrega se puede cambiar solo antes de que el pedido salga.
export function puedeCambiarEntrega(pedido: Pick<PedidoTransicion, 'estado'>) {
  return pedido.estado !== 'enviado' && pedido.estado !== 'entregado'
}

// Estados que resultan de aplicar `accion`, o null si no corresponde desde el estado actual.
export function aplicarAccion(pedido: PedidoTransicion, accion: AccionEstado): Estados | null {
  const { estado, estadoPago, tipoEntrega } = pedido
  switch (accion) {
    case 'confirmarPago':
      return pedido.origen === 'online' && pedido.metodoPago === 'transferencia' &&
        estado === 'pendiente_pago' && estadoPago === 'pendiente_verificacion'
        ? { estado: 'recibido', estadoPago: 'pagado' }
        : null
    case 'marcarEnPreparacion':
      return estado === 'recibido' ? { estado: 'en_preparacion', estadoPago } : null
    case 'marcarListo':
      return estado === 'recibido' || estado === 'en_preparacion' ? { estado: 'listo', estadoPago } : null
    case 'marcarEnviado':
      return tipoEntrega === 'delivery' && estado === 'listo' ? { estado: 'enviado', estadoPago } : null
    case 'marcarEntregado':
      return (tipoEntrega === 'retiro' && estado === 'listo') || (tipoEntrega === 'delivery' && estado === 'enviado')
        ? { estado: 'entregado', estadoPago: 'pagado' }
        : null
  }
}

// Cómo estaba el pago antes de entregar. Se deduce del pedido (no hace falta guardarlo):
// Caja cobra antes de crear el pedido, la transferencia online se confirmó antes de ir a
// Cocina, y solo el efectivo online queda pendiente hasta la entrega.
export function estadoPagoAntesDeEntregar(pedido: Pick<PedidoTransicion, 'origen' | 'metodoPago'>): EstadoPago {
  return pedido.origen === 'online' && pedido.metodoPago === 'efectivo' ? 'pendiente' : 'pagado'
}

// Estados a los que vuelve "Deshacer" si el pedido estaba en `estadoAnterior`, o null si
// no es un paso atrás válido. El pago anterior no lo manda el cliente: se deduce, así
// nadie puede usar "Deshacer" para dejar impago un pedido cobrado.
export function deshacerA(pedido: PedidoTransicion, estadoAnterior: EstadoPedido): Estados | null {
  const estadoPago: EstadoPago = estadoAnterior === 'pendiente_pago'
    ? 'pendiente_verificacion'
    : pedido.estado === 'entregado'
      ? estadoPagoAntesDeEntregar(pedido)
      : pedido.estadoPago
  const anterior: PedidoTransicion = { ...pedido, estado: estadoAnterior, estadoPago }
  const llegaAlActual = ACCIONES_ESTADO.some((accion) => {
    const resultado = aplicarAccion(anterior, accion)
    return resultado?.estado === pedido.estado && resultado.estadoPago === pedido.estadoPago
  })
  return llegaAlActual ? { estado: estadoAnterior, estadoPago } : null
}
