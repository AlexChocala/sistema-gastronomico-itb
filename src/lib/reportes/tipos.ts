// Contrato entre la pantalla de Reportes y el backend (GET /api/reportes).
//
// - Solo cuentan los pedidos con estado 'entregado'.
// - El rango se filtra por Pedido.fecha (cuando se hizo el pedido).
// - Fechas y horas en hora de Argentina.

import type { MetodoPago, OrigenPedido, TipoEntrega } from '@/lib/pedidos/pedidos-estados'

export type Agrupacion = 'dia' | 'semana' | 'mes'

// Query: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&sucursal=<id|todas>&agrupacion=dia|semana|mes
// Un supervisor solo puede pedir su sucursal; "todas" es solo para el admin.
export type FiltrosReportes = {
  desde: string // inclusive
  hasta: string // inclusive
  sucursal: number | 'todas'
  agrupacion: Agrupacion
}

type Totales = { totalVendido: number; cantidadPedidos: number }

export type ResumenVentas = Totales & { ticketPromedio: number }

// periodo: día 'AAAA-MM-DD', semana = su lunes 'AAAA-MM-DD', mes 'AAAA-MM'.
// Incluye los períodos sin ventas (en 0), ordenados.
export type VentaPorPeriodo = Totales & { periodo: string }

// Siempre 24 filas (hora 0 a 23).
export type VentaPorHora = Totales & { hora: number }

// Top 10 por cantidad.
export type ProductoMasVendido = { idProducto: number; nombre: string; cantidad: number; totalVendido: number }

export type VentaPorSucursal = Totales & { idSucursal: number; nombre: string }
export type VentaPorMetodoPago = Totales & { metodoPago: MetodoPago }
export type VentaPorOrigen = Totales & { origen: OrigenPedido }
export type VentaPorEntrega = Totales & { tipoEntrega: TipoEntrega }

// Promedio de pedidos por día de la semana (0 = domingo) y hora, en el rango elegido.
// Solo las combinaciones con pedidos.
export type DemandaEsperada = { diaSemana: number; hora: number; promedioPedidos: number }

// Una fila por pedido, del más nuevo al más viejo.
export type PedidoReporte = {
  idPedido: number
  fecha: string // 'AAAA-MM-DDTHH:mm'
  sucursal: string
  cliente: string // nombre y apellido
  origen: OrigenPedido
  tipoEntrega: TipoEntrega
  metodoPago: MetodoPago
  cantidadProductos: number // suma de las cantidades de sus detalles
  subtotal: number
  total: number
}

export type DatosReportes = {
  resumen: ResumenVentas
  ventasPorPeriodo: VentaPorPeriodo[]
  ventasPorHora: VentaPorHora[]
  productosMasVendidos: ProductoMasVendido[]
  ventasPorSucursal: VentaPorSucursal[] | null // null si se filtró una sucursal
  ventasPorMetodoPago: VentaPorMetodoPago[]
  ventasPorOrigen: VentaPorOrigen[]
  ventasPorEntrega: VentaPorEntrega[]
  demanda: DemandaEsperada[]
  pedidos: PedidoReporte[]
}
