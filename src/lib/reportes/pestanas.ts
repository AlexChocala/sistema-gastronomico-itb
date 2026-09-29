// Cada pestaña de Reportes: título, columnas y gráfico. La tabla de la pantalla, el PDF
// y el Excel leen de acá, así las columnas no se repiten en tres lugares.
// Sin React ni imports de servidor.

import type { MetodoPago, OrigenPedido, TipoEntrega } from '@/lib/pedidos/pedidos-estados'
import { formatearPrecio } from '@/lib/utils/precio'
import type { Agrupacion, DatosReportes } from './tipos'

export type IdPestana = 'periodo' | 'horario' | 'productos' | 'sucursales' | 'pago' | 'origen' | 'demanda' | 'pedidos'
export type TipoGrafico = 'linea' | 'barras' | 'barrasHorizontales' | 'torta' | 'mapa'
export type Formato = 'texto' | 'numero' | 'precio'
export type Valor = string | number
export type Columna = { titulo: string; formato: Formato }

export type Pestana = {
  id: IdPestana
  titulo: string
  columnas: Columna[]
  // Valores crudos: la pantalla y el PDF los formatean; el Excel los guarda como números.
  filas: (datos: DatosReportes, agrupacion: Agrupacion) => Valor[][]
  // Columnas que dibuja el gráfico: la etiqueta de cada barra o porción, y su valor.
  grafico: { tipo: TipoGrafico; etiqueta: number; valor: number } | null
  // Si falta, la pestaña se muestra siempre.
  disponible?: (datos: DatosReportes) => boolean
}

export const NOMBRES_METODO_PAGO: Record<MetodoPago, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia' }
export const NOMBRES_ORIGEN: Record<OrigenPedido, string> = { mostrador: 'Mostrador', online: 'Online' }
const NOMBRES_ENTREGA: Record<TipoEntrega, string> = { retiro: 'Retiro', delivery: 'Delivery' }
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const formatoDiaMes = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function formatear(valor: Valor, formato: Formato) {
  if (formato === 'texto' || typeof valor === 'string') return String(valor)
  return formato === 'precio' ? formatearPrecio(valor) : formatoNumero.format(valor)
}

function nombrePeriodo(periodo: string, agrupacion: Agrupacion) {
  if (agrupacion === 'mes') return formatoMes.format(new Date(periodo + '-01T00:00:00Z'))
  const fecha = new Date(periodo + 'T00:00:00Z')
  return agrupacion === 'semana' ? `Semana del ${formatoDiaMes.format(fecha)}` : formatoDia.format(fecha)
}

// 'AAAA-MM-DDTHH:mm' → 'DD/MM/AAAA HH:mm'
function fechaYHora(fecha: string) {
  const [dia, hora] = fecha.split('T')
  return `${dia.split('-').reverse().join('/')} ${hora}`
}

const nombreHora = (hora: number) => `${String(hora).padStart(2, '0')}:00`

const PEDIDOS: Columna = { titulo: 'Pedidos', formato: 'numero' }
const TOTAL: Columna = { titulo: 'Total vendido', formato: 'precio' }

export const PESTANAS: Pestana[] = [
  {
    id: 'periodo',
    titulo: 'Ventas por período',
    columnas: [{ titulo: 'Período', formato: 'texto' }, PEDIDOS, TOTAL],
    filas: (datos, agrupacion) =>
      datos.ventasPorPeriodo.map((f) => [nombrePeriodo(f.periodo, agrupacion), f.cantidadPedidos, f.totalVendido]),
    grafico: { tipo: 'linea', etiqueta: 0, valor: 2 },
  },
  {
    id: 'horario',
    titulo: 'Ventas por horario',
    columnas: [{ titulo: 'Hora', formato: 'texto' }, PEDIDOS, TOTAL],
    filas: (datos) => datos.ventasPorHora.map((f) => [nombreHora(f.hora), f.cantidadPedidos, f.totalVendido]),
    grafico: { tipo: 'barras', etiqueta: 0, valor: 1 },
  },
  {
    id: 'productos',
    titulo: 'Productos más vendidos',
    columnas: [{ titulo: 'Producto', formato: 'texto' }, { titulo: 'Cantidad', formato: 'numero' }, TOTAL],
    filas: (datos) => datos.productosMasVendidos.map((f) => [f.nombre, f.cantidad, f.totalVendido]),
    grafico: { tipo: 'barrasHorizontales', etiqueta: 0, valor: 1 },
  },
  {
    id: 'sucursales',
    titulo: 'Ventas por sucursal',
    columnas: [{ titulo: 'Sucursal', formato: 'texto' }, PEDIDOS, TOTAL],
    filas: (datos) => (datos.ventasPorSucursal ?? []).map((f) => [f.nombre, f.cantidadPedidos, f.totalVendido]),
    grafico: { tipo: 'barras', etiqueta: 0, valor: 2 },
    disponible: (datos) => datos.ventasPorSucursal !== null,
  },
  {
    id: 'pago',
    titulo: 'Métodos de pago',
    columnas: [{ titulo: 'Método', formato: 'texto' }, PEDIDOS, TOTAL],
    filas: (datos) =>
      datos.ventasPorMetodoPago.map((f) => [NOMBRES_METODO_PAGO[f.metodoPago], f.cantidadPedidos, f.totalVendido]),
    grafico: { tipo: 'torta', etiqueta: 0, valor: 2 },
  },
  {
    id: 'origen',
    titulo: 'Origen',
    columnas: [{ titulo: 'Origen', formato: 'texto' }, PEDIDOS, TOTAL],
    filas: (datos) => datos.ventasPorOrigen.map((f) => [NOMBRES_ORIGEN[f.origen], f.cantidadPedidos, f.totalVendido]),
    grafico: { tipo: 'torta', etiqueta: 0, valor: 1 },
  },
  {
    id: 'demanda',
    titulo: 'Demanda esperada',
    columnas: [{ titulo: 'Día', formato: 'texto' }, { titulo: 'Hora', formato: 'texto' }, { titulo: 'Pedidos promedio', formato: 'numero' }],
    filas: (datos) => datos.demanda.map((f) => [DIAS_SEMANA[f.diaSemana], nombreHora(f.hora), f.promedioPedidos]),
    grafico: { tipo: 'mapa', etiqueta: 0, valor: 2 },
  },
  {
    id: 'pedidos',
    titulo: 'Detalle de pedidos',
    columnas: [
      { titulo: 'N.º', formato: 'texto' },
      { titulo: 'Fecha', formato: 'texto' },
      { titulo: 'Sucursal', formato: 'texto' },
      { titulo: 'Cliente', formato: 'texto' },
      { titulo: 'Origen', formato: 'texto' },
      { titulo: 'Entrega', formato: 'texto' },
      { titulo: 'Pago', formato: 'texto' },
      { titulo: 'Productos', formato: 'numero' },
      { titulo: 'Subtotal', formato: 'precio' },
      { titulo: 'Total', formato: 'precio' },
    ],
    filas: (datos) =>
      datos.pedidos.map((p) => [
        p.idPedido, fechaYHora(p.fecha), p.sucursal, p.cliente, NOMBRES_ORIGEN[p.origen],
        NOMBRES_ENTREGA[p.tipoEntrega], NOMBRES_METODO_PAGO[p.metodoPago], p.cantidadProductos, p.subtotal, p.total,
      ]),
    grafico: null,
  },
]
