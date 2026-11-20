// Pagos de un pedido cobrado en Caja. Sin dependencias de servidor.
//
// Un pedido puede cobrarse de dos formas a la vez (pago dividido): una parte en efectivo y
// otra por transferencia. Cada parte es un Pago. Pedido.metodoPago guarda el método de mayor
// monto (en empate, efectivo), para lo que sigue mirando un solo método; lo cobrado por
// método sale siempre de los pagos.

import { ErrorPedido, type PagoCaja } from '@/lib/pedidos/pedidos-validacion'

export function repartirPagos(
  pedido: { metodoPago: PagoCaja['metodo']; pagos: PagoCaja[] | null },
  total: number,
): PagoCaja[] {
  if (pedido.pagos === null) return [{ metodo: pedido.metodoPago, monto: total }]
  const suma = pedido.pagos.reduce((acumulado, pago) => acumulado + pago.monto, 0)
  // Se compara al centavo: los montos llegan redondeados a 2 decimales.
  if (Math.abs(suma - total) >= 0.005) {
    throw new ErrorPedido(409, 'Los pagos no suman el total del pedido. Revisá cómo se divide el pago.')
  }
  return pedido.pagos
}

export function metodoPrincipal(pagos: PagoCaja[]): PagoCaja['metodo'] {
  return pagos.reduce((mayor, pago) => (pago.monto > mayor.monto ? pago : mayor), pagos[0]).metodo
}
