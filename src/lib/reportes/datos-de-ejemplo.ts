// DATOS FALSOS, TEMPORALES. Respetan el contrato de tipos.ts para que la pantalla de
// Reportes funcione antes de que exista GET /api/reportes. Cuando el backend esté listo,
// reportes-api.ts deja de usar este archivo y se puede borrar.
//
// Genera pedidos entregados y calcula cada reporte a partir de ellos, así los números
// son coherentes entre sí. La semilla es por día y sucursal: los mismos filtros siempre
// dan los mismos datos.

import type { Agrupacion, DatosReportes, FiltrosReportes, PedidoReporte } from './tipos'

const DIA_MS = 24 * 60 * 60 * 1000

const SUCURSALES = [
  { idSucursal: 1, nombre: 'Centro' },
  { idSucursal: 2, nombre: 'Quilmes' },
  { idSucursal: 3, nombre: 'Palermo' },
]

const PRODUCTOS = [
  { idProducto: 1, nombre: 'Hamburguesa clásica', precio: 8500 },
  { idProducto: 2, nombre: 'Hamburguesa doble', precio: 11000 },
  { idProducto: 3, nombre: 'Pizza muzzarella', precio: 9500 },
  { idProducto: 4, nombre: 'Pizza napolitana', precio: 10500 },
  { idProducto: 5, nombre: 'Empanada de carne', precio: 1500 },
  { idProducto: 6, nombre: 'Milanesa con papas', precio: 12000 },
  { idProducto: 7, nombre: 'Papas fritas', precio: 4500 },
  { idProducto: 8, nombre: 'Gaseosa 500 ml', precio: 2500 },
  { idProducto: 9, nombre: 'Cerveza 1 L', precio: 5000 },
  { idProducto: 10, nombre: 'Flan casero', precio: 3500 },
  { idProducto: 11, nombre: 'Agua 500 ml', precio: 1800 },
]

const CLIENTES = [
  'Juan Pérez', 'María González', 'Lucas Fernández', 'Sofía Romero', 'Martín López',
  'Valentina Díaz', 'Tomás Álvarez', 'Camila Torres', 'Nicolás Ruiz', 'Lucía Benítez',
]

// Peso de cada hora (0 a 23): más movimiento al mediodía y a la noche.
const PESO_POR_HORA = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 5, 3, 1, 1, 1, 2, 4, 6, 6, 4, 2]
const PESO_TOTAL = PESO_POR_HORA.reduce((suma, peso) => suma + peso, 0)

type Azar = () => number

// Generador pseudoaleatorio con semilla (mulberry32).
function crearAzar(semilla: number): Azar {
  let estado = semilla >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function entero(azar: Azar, min: number, max: number) {
  return min + Math.floor(azar() * (max - min + 1))
}

function elegir<T>(azar: Azar, lista: readonly T[]): T {
  return lista[Math.floor(azar() * lista.length)]
}

function elegirHora(azar: Azar) {
  let resto = azar() * PESO_TOTAL
  for (let hora = 0; hora < 24; hora++) {
    resto -= PESO_POR_HORA[hora]
    if (resto < 0) return hora
  }
  return 21
}

// Las fechas 'AAAA-MM-DD' se manejan como días de calendario (en UTC, sin zona horaria).
function aFecha(dia: string) {
  return new Date(dia + 'T00:00:00Z')
}

function aTexto(fecha: Date) {
  return fecha.toISOString().slice(0, 10)
}

function diasDelRango(desde: string, hasta: string) {
  const dias: string[] = []
  const fin = aFecha(hasta).getTime()
  for (let actual = aFecha(desde).getTime(); actual <= fin; actual += DIA_MS) {
    dias.push(aTexto(new Date(actual)))
  }
  return dias
}

function claveDePeriodo(dia: string, agrupacion: Agrupacion) {
  if (agrupacion === 'mes') return dia.slice(0, 7)
  if (agrupacion === 'semana') {
    const fecha = aFecha(dia)
    const desdeElLunes = (fecha.getUTCDay() + 6) % 7
    return aTexto(new Date(fecha.getTime() - desdeElLunes * DIA_MS))
  }
  return dia
}

type PedidoDeEjemplo = PedidoReporte & {
  idSucursal: number
  lineas: { idProducto: number; cantidad: number; subtotal: number }[]
}

function generarPedidosDelDia(dia: string, sucursal: { idSucursal: number; nombre: string }) {
  const numeroDeDia = Math.floor(aFecha(dia).getTime() / DIA_MS)
  const azar = crearAzar(numeroDeDia * 31 + sucursal.idSucursal)
  const finDeSemana = [0, 5, 6].includes(aFecha(dia).getUTCDay())
  const cantidad = entero(azar, 12, 22) + (finDeSemana ? entero(azar, 6, 12) : 0)

  const pedidos: Omit<PedidoDeEjemplo, 'idPedido'>[] = []
  for (let i = 0; i < cantidad; i++) {
    const hora = elegirHora(azar)
    const minuto = entero(azar, 0, 59)
    const origen = azar() < 0.55 ? 'mostrador' : 'online'

    const lineas = Array.from({ length: entero(azar, 1, 4) }, () => {
      const producto = elegir(azar, PRODUCTOS)
      const cantidadProducto = entero(azar, 1, 2)
      return { idProducto: producto.idProducto, cantidad: cantidadProducto, subtotal: producto.precio * cantidadProducto }
    })
    const subtotal = lineas.reduce((suma, linea) => suma + linea.subtotal, 0)

    pedidos.push({
      idSucursal: sucursal.idSucursal,
      fecha: `${dia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
      sucursal: sucursal.nombre,
      cliente: elegir(azar, CLIENTES),
      origen,
      tipoEntrega: origen === 'online' && azar() < 0.5 ? 'delivery' : 'retiro',
      metodoPago: origen === 'online' && azar() < 0.6 ? 'transferencia' : 'efectivo',
      cantidadProductos: lineas.reduce((suma, linea) => suma + linea.cantidad, 0),
      subtotal,
      total: subtotal,
      lineas,
    })
  }
  return pedidos
}

function sumar<T extends { totalVendido: number; cantidadPedidos: number }>(fila: T, pedido: PedidoDeEjemplo) {
  fila.totalVendido += pedido.total
  fila.cantidadPedidos += 1
}

export function generarDatosDeEjemplo(filtros: FiltrosReportes): DatosReportes {
  const dias = diasDelRango(filtros.desde, filtros.hasta)
  const sucursales =
    filtros.sucursal === 'todas'
      ? SUCURSALES
      : [{
          idSucursal: filtros.sucursal,
          nombre: SUCURSALES.find((s) => s.idSucursal === filtros.sucursal)?.nombre ?? `Sucursal ${filtros.sucursal}`,
        }]

  const pedidos: PedidoDeEjemplo[] = dias
    .flatMap((dia) => sucursales.flatMap((sucursal) => generarPedidosDelDia(dia, sucursal)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((pedido, indice) => ({ ...pedido, idPedido: 1000 + indice }))

  const totalVendido = pedidos.reduce((suma, pedido) => suma + pedido.total, 0)

  const periodos = new Map<string, { periodo: string; totalVendido: number; cantidadPedidos: number }>()
  for (const dia of dias) {
    const periodo = claveDePeriodo(dia, filtros.agrupacion)
    if (!periodos.has(periodo)) periodos.set(periodo, { periodo, totalVendido: 0, cantidadPedidos: 0 })
  }

  const ventasPorHora = Array.from({ length: 24 }, (_, hora) => ({ hora, totalVendido: 0, cantidadPedidos: 0 }))
  const productos = new Map<number, { cantidad: number; totalVendido: number }>()
  const porSucursal = new Map(sucursales.map((s) => [s.idSucursal, { ...s, totalVendido: 0, cantidadPedidos: 0 }]))
  const ventasPorMetodoPago = (['efectivo', 'transferencia'] as const).map((metodoPago) => ({ metodoPago, totalVendido: 0, cantidadPedidos: 0 }))
  const ventasPorOrigen = (['mostrador', 'online'] as const).map((origen) => ({ origen, totalVendido: 0, cantidadPedidos: 0 }))
  const ventasPorEntrega = (['retiro', 'delivery'] as const).map((tipoEntrega) => ({ tipoEntrega, totalVendido: 0, cantidadPedidos: 0 }))
  const pedidosPorFranja = new Map<string, number>()

  for (const pedido of pedidos) {
    const dia = pedido.fecha.slice(0, 10)
    const hora = Number(pedido.fecha.slice(11, 13))

    sumar(periodos.get(claveDePeriodo(dia, filtros.agrupacion))!, pedido)
    sumar(ventasPorHora[hora], pedido)
    sumar(porSucursal.get(pedido.idSucursal)!, pedido)
    sumar(ventasPorMetodoPago.find((fila) => fila.metodoPago === pedido.metodoPago)!, pedido)
    sumar(ventasPorOrigen.find((fila) => fila.origen === pedido.origen)!, pedido)
    sumar(ventasPorEntrega.find((fila) => fila.tipoEntrega === pedido.tipoEntrega)!, pedido)

    for (const linea of pedido.lineas) {
      const fila = productos.get(linea.idProducto) ?? { cantidad: 0, totalVendido: 0 }
      fila.cantidad += linea.cantidad
      fila.totalVendido += linea.subtotal
      productos.set(linea.idProducto, fila)
    }

    const franja = `${aFecha(dia).getUTCDay()}-${hora}`
    pedidosPorFranja.set(franja, (pedidosPorFranja.get(franja) ?? 0) + 1)
  }

  // Cuántas veces aparece cada día de la semana en el rango, para promediar.
  const vecesPorDiaSemana = Array.from({ length: 7 }, () => 0)
  for (const dia of dias) vecesPorDiaSemana[aFecha(dia).getUTCDay()]++

  const demanda = [...pedidosPorFranja]
    .map(([franja, cantidad]) => {
      const [diaSemana, hora] = franja.split('-').map(Number)
      return { diaSemana, hora, promedioPedidos: Math.round((cantidad / vecesPorDiaSemana[diaSemana]) * 10) / 10 }
    })
    .sort((a, b) => a.diaSemana - b.diaSemana || a.hora - b.hora)

  const productosMasVendidos = PRODUCTOS
    .filter((producto) => productos.has(producto.idProducto))
    .map((producto) => ({ idProducto: producto.idProducto, nombre: producto.nombre, ...productos.get(producto.idProducto)! }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)

  return {
    resumen: {
      totalVendido,
      cantidadPedidos: pedidos.length,
      ticketPromedio: pedidos.length ? Math.round(totalVendido / pedidos.length) : 0,
    },
    ventasPorPeriodo: [...periodos.values()],
    ventasPorHora,
    productosMasVendidos,
    ventasPorSucursal: filtros.sucursal === 'todas' ? [...porSucursal.values()] : null,
    ventasPorMetodoPago,
    ventasPorOrigen,
    ventasPorEntrega,
    demanda,
    pedidos: pedidos
      .map((p): PedidoReporte => ({
        idPedido: p.idPedido, fecha: p.fecha, sucursal: p.sucursal, cliente: p.cliente, origen: p.origen,
        tipoEntrega: p.tipoEntrega, metodoPago: p.metodoPago, cantidadProductos: p.cantidadProductos,
        subtotal: p.subtotal, total: p.total,
      }))
      .reverse(),
  }
}
