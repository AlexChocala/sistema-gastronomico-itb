// Estado compartido de pedidos para las pantallas de Caja, Cocina y Pedidos Mostrador.
//
// Cada pedido tiene DOS estados independientes:
//   estado (la comida): recibido → en_preparacion → listo → enviado (solo delivery) → entregado
//   estadoPago (la plata): pendiente → pagado
//
// Quién mueve cada paso:
//   Caja     crea el pedido (recibido) y marca pagado / enviado / entregado.
//   Cocina   "Pendiente" → en_preparacion (recién ahí aparece en Mostrador).
//            "Listo"     → listo (pasa a "Para retirar" en Mostrador).
//
// Todavía no existe la API de pedidos, así que por ahora el estado vive en localStorage
// con datos de prueba. El evento `storage` avisa a las otras pestañas del mismo navegador.
//
// Cuando el backend esté listo, se reemplaza SOLO este archivo (ver los TODO): las
// pantallas usan `usePedidosPantalla()` y no saben de dónde salen los datos.

import { useCallback, useSyncExternalStore } from 'react'

export type EstadoPedidoPantalla = 'recibido' | 'en_preparacion' | 'listo' | 'enviado' | 'entregado'
export type EstadoPagoPantalla = 'pendiente' | 'pagado'
export type MetodoPagoPantalla = 'efectivo' | 'transferencia'
export type TipoEntregaPantalla = 'retiro' | 'delivery'
export type OrigenPedidoPantalla = 'mostrador' | 'online'

export interface ItemPedidoPantalla {
  cantidad: number
  producto: string
  precioUnitario: number
}

export interface PedidoPantalla {
  idPedido: number
  fecha: string // ISO
  origen: OrigenPedidoPantalla
  cliente: string
  tipoEntrega: TipoEntregaPantalla
  estado: EstadoPedidoPantalla
  metodoPago: MetodoPagoPantalla
  estadoPago: EstadoPagoPantalla
  items: ItemPedidoPantalla[]
  total: number
}

// Regla única de negocio: qué pedidos puede ver Cocina.
// - Pagados: siempre (mostrador cobra antes; online por transferencia, una vez verificado).
// - Online en efectivo: entra sin pagar, lo cobra el cadete al entregar.
// Un pedido online por transferencia sin verificar NO llega a Cocina.
export function puedeIrACocina(pedido: PedidoPantalla) {
  return (
    pedido.estadoPago === 'pagado' ||
    (pedido.origen === 'online' && pedido.metodoPago === 'efectivo')
  )
}

export function calcularTotal(items: ItemPedidoPantalla[]) {
  return items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)
}

function pedidoDePrueba(
  datos: Omit<PedidoPantalla, 'total' | 'fecha' | 'origen' | 'metodoPago' | 'estadoPago'> &
    Partial<Pick<PedidoPantalla, 'origen' | 'metodoPago' | 'estadoPago'>>,
): PedidoPantalla {
  return {
    fecha: '2026-09-24T12:30:00-03:00',
    origen: 'mostrador',
    metodoPago: 'efectivo',
    estadoPago: 'pagado',
    ...datos,
    total: calcularTotal(datos.items),
  }
}

// TODO: borrar cuando exista la API de pedidos.
const pedidosDePrueba: PedidoPantalla[] = [
  pedidoDePrueba({
    idPedido: 123,
    cliente: 'Damián',
    tipoEntrega: 'retiro',
    estado: 'recibido',
    items: [
      { cantidad: 1, producto: 'Hamburguesa doble completa', precioUnitario: 11200 },
      { cantidad: 1, producto: 'Hamburguesa triple simple', precioUnitario: 12900 },
      { cantidad: 1, producto: 'Pizza muzzarella', precioUnitario: 9800 },
    ],
  }),
  pedidoDePrueba({
    idPedido: 124,
    cliente: 'Nicolás',
    tipoEntrega: 'delivery',
    estado: 'recibido',
    origen: 'online',
    estadoPago: 'pendiente', // paga en efectivo al cadete
    items: [
      { cantidad: 1, producto: 'Pizza jamón y morrón', precioUnitario: 11500 },
      { cantidad: 1, producto: 'Hamburguesa simple', precioUnitario: 7500 },
    ],
  }),
  pedidoDePrueba({
    idPedido: 125,
    cliente: 'Erika',
    tipoEntrega: 'retiro',
    estado: 'en_preparacion',
    metodoPago: 'transferencia',
    items: [
      { cantidad: 2, producto: 'Empanada de carne', precioUnitario: 1600 },
      { cantidad: 1, producto: 'Coca-Cola 500 ml', precioUnitario: 2500 },
    ],
  }),
  pedidoDePrueba({
    idPedido: 126,
    cliente: 'Lucía',
    tipoEntrega: 'delivery',
    estado: 'recibido',
    origen: 'online',
    metodoPago: 'transferencia',
    estadoPago: 'pendiente', // comprobante sin verificar: todavía NO aparece en Cocina
    items: [
      { cantidad: 1, producto: 'Milanesa napolitana con papas', precioUnitario: 13500 },
      { cantidad: 1, producto: 'Flan con dulce de leche', precioUnitario: 4200 },
    ],
  }),
  pedidoDePrueba({
    idPedido: 122,
    cliente: 'Martín',
    tipoEntrega: 'retiro',
    estado: 'listo',
    items: [{ cantidad: 1, producto: 'Pizza fugazzeta', precioUnitario: 10900 }],
  }),
]

// La versión en la clave descarta datos guardados con el formato anterior.
const CLAVE_STORAGE = 'pedidos-pantallas-v2'
const EVENTO_LOCAL = 'pedidos-pantallas:cambio'

// useSyncExternalStore exige devolver la misma referencia mientras no cambien los datos.
let ultimoCrudo: string | null = null
let ultimoValor: PedidoPantalla[] = pedidosDePrueba

function leer(): PedidoPantalla[] {
  let crudo: string | null = null
  try {
    crudo = localStorage.getItem(CLAVE_STORAGE)
  } catch {
    return pedidosDePrueba
  }
  if (crudo === ultimoCrudo) return ultimoValor
  ultimoCrudo = crudo
  try {
    ultimoValor = crudo ? (JSON.parse(crudo) as PedidoPantalla[]) : pedidosDePrueba
  } catch {
    ultimoValor = pedidosDePrueba
  }
  return ultimoValor
}

function guardar(pedidos: PedidoPantalla[]) {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(pedidos))
  } catch {
    // Sin storage disponible (modo privado estricto): el cambio no persiste.
  }
  // `storage` solo avisa a las OTRAS pestañas; esto avisa a la actual.
  window.dispatchEvent(new Event(EVENTO_LOCAL))
}

function suscribir(avisar: () => void) {
  window.addEventListener('storage', avisar)
  window.addEventListener(EVENTO_LOCAL, avisar)
  return () => {
    window.removeEventListener('storage', avisar)
    window.removeEventListener(EVENTO_LOCAL, avisar)
  }
}

export type NuevoPedidoMostrador = Pick<PedidoPantalla, 'cliente' | 'tipoEntrega' | 'metodoPago' | 'items'>

export function usePedidosPantalla() {
  // TODO: con backend, reemplazar por un fetch a la API de pedidos de la sucursal
  // (con polling cada pocos segundos o SSE) en lugar de localStorage.
  const pedidos = useSyncExternalStore(suscribir, leer, () => pedidosDePrueba)

  const cambiarEstado = useCallback((idPedido: number, estado: EstadoPedidoPantalla) => {
    // TODO: con backend, reemplazar por PATCH /api/pedidos/{idPedido} con { estado }.
    guardar(leer().map((pedido) => (pedido.idPedido === idPedido ? { ...pedido, estado } : pedido)))
  }, [])

  // Caja cobra ANTES de crear el pedido: entra pagado y en estado "recibido".
  const crearPedidoMostrador = useCallback((datos: NuevoPedidoMostrador): PedidoPantalla => {
    // TODO: con backend, reemplazar por POST /api/pedidos; el id y la fecha los asigna la base.
    const actuales = leer()
    const pedido: PedidoPantalla = {
      ...datos,
      idPedido: Math.max(0, ...actuales.map((p) => p.idPedido)) + 1,
      fecha: new Date().toISOString(),
      origen: 'mostrador',
      estado: 'recibido',
      estadoPago: 'pagado',
      total: calcularTotal(datos.items),
    }
    guardar([...actuales, pedido])
    return pedido
  }, [])

  const reiniciarDatosDePrueba = useCallback(() => guardar(pedidosDePrueba), [])

  return {
    pedidos,
    crearPedidoMostrador,
    marcarEnPreparacion: (idPedido: number) => cambiarEstado(idPedido, 'en_preparacion'),
    marcarListo: (idPedido: number) => cambiarEstado(idPedido, 'listo'),
    reiniciarDatosDePrueba,
  }
}
