import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import type { Agrupacion, DatosReportes, FiltrosReportes, PedidoReporte, ProductoMasVendido, VentaPorPeriodo } from './tipos'

export class ErrorReporte extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje)
  }
}

const DIA = 86_400_000
const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function fechaArgentina(fecha: Date) {
  const partes = Object.fromEntries(formato.formatToParts(fecha).map(({ type, value }) => [type, value]))
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}`
}

function diaValido(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor < '1900-01-01' || valor > '9998-12-31') return false
  const fecha = new Date(valor + 'T00:00:00Z')
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}

export function leerFiltros(parametros: URLSearchParams): FiltrosReportes {
  const desde = parametros.get('desde')
  const hasta = parametros.get('hasta')
  const sucursal = parametros.get('sucursal')
  const agrupacion = parametros.get('agrupacion')
  if (!diaValido(desde) || !diaValido(hasta)) {
    throw new ErrorReporte(400, 'Ingresá fechas válidas con formato AAAA-MM-DD.')
  }
  if (desde > hasta) throw new ErrorReporte(400, 'La fecha desde no puede ser posterior a hasta.')
  if (agrupacion !== 'dia' && agrupacion !== 'semana' && agrupacion !== 'mes') {
    throw new ErrorReporte(400, 'La agrupación debe ser día, semana o mes.')
  }
  if (sucursal !== 'todas' && (!sucursal || !/^[1-9]\d*$/.test(sucursal) || !Number.isSafeInteger(Number(sucursal)))) {
    throw new ErrorReporte(400, 'Seleccioná una sucursal válida.')
  }
  return { desde, hasta, agrupacion, sucursal: sucursal === 'todas' ? 'todas' : Number(sucursal) }
}

export function validarPermisos(rol: string, idSucursal: number | null, filtros: FiltrosReportes) {
  if (rol !== 'admin' && rol !== 'supervisor') {
    throw new ErrorReporte(403, 'No tenés permiso para consultar reportes.')
  }
  if (rol === 'supervisor' && (idSucursal === null || filtros.sucursal !== idSucursal)) {
    throw new ErrorReporte(403, 'Solo podés consultar reportes de tu sucursal.')
  }
}

// Convierte medianoche local a un instante UTC usando la zona, no la del servidor.
function inicioLocal(dia: string) {
  const objetivo = new Date(dia + 'T00:00:00Z').getTime()
  let instante = objetivo
  for (let i = 0; i < 4; i++) {
    const local = new Date(fechaArgentina(new Date(instante)) + 'Z').getTime()
    if (local === objetivo) break
    instante += objetivo - local
  }
  return new Date(instante)
}

export function limitesDelRango(filtros: FiltrosReportes) {
  const siguiente = new Date(new Date(filtros.hasta + 'T00:00:00Z').getTime() + DIA).toISOString().slice(0, 10)
  // Fin exclusivo: incluye todos los milisegundos del último día.
  return { gte: inicioLocal(filtros.desde), lt: inicioLocal(siguiente) }
}

function periodoDe(dia: string, agrupacion: Agrupacion) {
  if (agrupacion === 'mes') return dia.slice(0, 7)
  if (agrupacion === 'dia') return dia
  const fecha = new Date(dia + 'T00:00:00Z')
  return new Date(fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * DIA).toISOString().slice(0, 10)
}

const camposPedido = {
  idPedido: true, fecha: true, idSucursal: true, origenPedido: true,
  metodoPago: true, subtotal: true, total: true,
  cliente: { select: { nombre: true, apellido: true } },
  sucursal: { select: { nombre: true } },
  tipoEntrega: { select: { nombre: true } },
  detalles: { select: {
    idProducto: true, cantidad: true, subtotal: true,
    producto: { select: { nombre: true } },
  } },
} satisfies Prisma.PedidoSelect

type PedidoConsultado = Prisma.PedidoGetPayload<{ select: typeof camposPedido }>
type SucursalConsultada = { idSucursal: number; nombre: string }
const dinero = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100

export function calcularReportes(
  filtros: FiltrosReportes, pedidos: PedidoConsultado[], sucursales: SucursalConsultada[],
): DatosReportes {
  const periodos = new Map<string, VentaPorPeriodo>()
  const vecesPorDia = Array<number>(7).fill(0)
  const fin = new Date(filtros.hasta + 'T00:00:00Z').getTime()
  for (let actual = new Date(filtros.desde + 'T00:00:00Z').getTime(); actual <= fin; actual += DIA) {
    const fecha = new Date(actual)
    const periodo = periodoDe(fecha.toISOString().slice(0, 10), filtros.agrupacion)
    if (!periodos.has(periodo)) periodos.set(periodo, { periodo, totalVendido: 0, cantidadPedidos: 0 })
    vecesPorDia[fecha.getUTCDay()]++
  }
  const ventasPorHora = Array.from({ length: 24 }, (_, hora) => ({ hora, totalVendido: 0, cantidadPedidos: 0 }))
  const porSucursal = new Map(sucursales.map((s) => [s.idSucursal, { ...s, totalVendido: 0, cantidadPedidos: 0 }]))
  const ventasPorMetodoPago = (['efectivo', 'transferencia'] as const).map((metodoPago) => ({ metodoPago, totalVendido: 0, cantidadPedidos: 0 }))
  const ventasPorOrigen = (['mostrador', 'online'] as const).map((origen) => ({ origen, totalVendido: 0, cantidadPedidos: 0 }))
  const productos = new Map<number, ProductoMasVendido>()
  const franjas = new Map<string, { diaSemana: number; hora: number; cantidad: number }>()
  const filas: PedidoReporte[] = []
  let totalVendido = 0

  for (const pedido of [...pedidos].sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.idPedido - a.idPedido)) {
    const fecha = fechaArgentina(pedido.fecha).slice(0, 16)
    const dia = fecha.slice(0, 10)
    const hora = Number(fecha.slice(11, 13))
    const origen = pedido.origenPedido
    const metodoPago = pedido.metodoPago
    const tipoEntrega = pedido.tipoEntrega.nombre
    if ((origen !== 'mostrador' && origen !== 'online') ||
        (metodoPago !== 'efectivo' && metodoPago !== 'transferencia') ||
        (tipoEntrega !== 'retiro' && tipoEntrega !== 'delivery')) {
      throw new ErrorReporte(500, 'Hay pedidos con datos incompatibles con el reporte. Contactá al administrador.')
    }
    const periodo = periodos.get(periodoDe(dia, filtros.agrupacion))
    if (!periodo) throw new Error('Pedido fuera del rango de reportes')
    for (const fila of [
      periodo, ventasPorHora[hora], porSucursal.get(pedido.idSucursal),
      ventasPorMetodoPago.find((f) => f.metodoPago === metodoPago),
      ventasPorOrigen.find((f) => f.origen === origen),
    ]) {
      if (fila) { fila.totalVendido += pedido.total; fila.cantidadPedidos++ }
    }
    totalVendido += pedido.total
    for (const detalle of pedido.detalles) {
      const fila = productos.get(detalle.idProducto) ?? {
        idProducto: detalle.idProducto, nombre: detalle.producto.nombre, cantidad: 0, totalVendido: 0,
      }
      fila.cantidad += detalle.cantidad
      fila.totalVendido += detalle.subtotal
      productos.set(detalle.idProducto, fila)
    }
    const diaSemana = new Date(dia + 'T00:00:00Z').getUTCDay()
    const clave = `${diaSemana}-${hora}`
    const franja = franjas.get(clave) ?? { diaSemana, hora, cantidad: 0 }
    franja.cantidad++
    franjas.set(clave, franja)
    filas.push({
      idPedido: pedido.idPedido, fecha, sucursal: pedido.sucursal.nombre,
      cliente: [pedido.cliente.nombre, pedido.cliente.apellido].filter(Boolean).join(' '),
      origen, metodoPago, tipoEntrega,
      cantidadProductos: pedido.detalles.reduce((suma, d) => suma + d.cantidad, 0),
      subtotal: dinero(pedido.subtotal), total: dinero(pedido.total),
    })
  }
  const redondear = <T extends { totalVendido: number }>(filas: T[]) =>
    filas.map((fila) => ({ ...fila, totalVendido: dinero(fila.totalVendido) }))
  return {
    resumen: { totalVendido: dinero(totalVendido), cantidadPedidos: pedidos.length, ticketPromedio: pedidos.length ? Math.round(totalVendido / pedidos.length) : 0 },
    ventasPorPeriodo: redondear([...periodos.values()]),
    ventasPorHora: redondear(ventasPorHora),
    productosMasVendidos: redondear([...productos.values()].sort((a, b) => b.cantidad - a.cantidad || a.idProducto - b.idProducto).slice(0, 10)),
    ventasPorSucursal: filtros.sucursal === 'todas' ? redondear([...porSucursal.values()]) : null,
    ventasPorMetodoPago: redondear(ventasPorMetodoPago),
    ventasPorOrigen: redondear(ventasPorOrigen),
    demanda: [...franjas.values()].map(({ diaSemana, hora, cantidad }) => ({
      diaSemana, hora, promedioPedidos: Math.round(cantidad / vecesPorDia[diaSemana] * 10) / 10,
    })).sort((a, b) => a.diaSemana - b.diaSemana || a.hora - b.hora),
    pedidos: filas,
  }
}

export async function consultarReportes(filtros: FiltrosReportes): Promise<DatosReportes> {
  const sucursales = await prisma.sucursal.findMany({
    where: filtros.sucursal === 'todas' ? {} : { idSucursal: filtros.sucursal },
    select: { idSucursal: true, nombre: true },
    orderBy: { idSucursal: 'asc' },
  })
  if (filtros.sucursal !== 'todas' && !sucursales.length) {
    throw new ErrorReporte(404, 'La sucursal seleccionada no existe.')
  }
  const pedidos = await prisma.pedido.findMany({
    where: {
      estadoPedido: 'entregado',
      fecha: limitesDelRango(filtros),
      ...(filtros.sucursal === 'todas' ? {} : { idSucursal: filtros.sucursal }),
    },
    select: camposPedido,
    orderBy: [{ fecha: 'desc' }, { idPedido: 'desc' }],
  })
  return calcularReportes(filtros, pedidos, sucursales)
}

