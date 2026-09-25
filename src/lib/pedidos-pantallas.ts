// Estado compartido de pedidos para las pantallas de Caja, Cocina y Pedidos Mostrador.
//
// Cada pedido tiene DOS estados independientes:
//   estado (la comida): recibido → en_preparacion → listo → enviado (solo delivery) → entregado
//   estadoPago (la plata): pendiente → pagado
//
// Quién mueve cada paso:
//   Caja     crea el pedido (recibido, ya pagado).
//   Cocina   "Pendiente" → en_preparacion (recién ahí aparece en Mostrador).
//            "Listo"     → listo (pasa a "Para retirar" en Mostrador).
//   Pedidos  verifica transferencias (pagado), enviado (solo delivery) y entregado.
//
// Todavía no existe la API de pedidos, así que por ahora el estado vive en localStorage
// (arranca vacío; los pedidos los crea Caja). El evento `storage` avisa a las otras pestañas del mismo navegador.
//
// Cuando el backend esté listo, se reemplaza SOLO este archivo (ver los TODO): las
// pantallas usan `usePedidosPantalla()` y no saben de dónde salen los datos.

import { useCallback, useMemo, useSyncExternalStore } from 'react'

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
  idSucursal: number
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

// La versión en la clave descarta datos guardados anteriormente (v3 incluía pedidos de
// prueba generados automáticamente).
const CLAVE_STORAGE = 'pedidos-pantallas-v4'
const EVENTO_LOCAL = 'pedidos-pantallas:cambio'

// useSyncExternalStore exige devolver la misma referencia mientras no cambien los datos.
// null = todavía no se guardó nada (no hay pedidos).
let ultimoCrudo: string | null = null
let ultimoValor: PedidoPantalla[] | null = null

function leer(): PedidoPantalla[] | null {
  let crudo: string | null = null
  try {
    crudo = localStorage.getItem(CLAVE_STORAGE)
  } catch {
    return null
  }
  if (crudo === ultimoCrudo) return ultimoValor
  ultimoCrudo = crudo
  try {
    ultimoValor = crudo ? (JSON.parse(crudo) as PedidoPantalla[]) : null
  } catch {
    ultimoValor = null
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

function siguienteId(pedidos: PedidoPantalla[], minimo = 0) {
  return Math.max(minimo, ...pedidos.map((pedido) => pedido.idPedido)) + 1
}

// Pedidos de UNA sucursal. `idSucursal` sale de la sesión (panel, Caja, Cocina) o de la
// URL (monitor público de Mostrador). Con null (usuario sin sucursal) no muestra nada.
export function usePedidosPantalla(idSucursal: number | null) {
  // TODO: con backend, reemplazar por un fetch a GET /api/pedidos (la sucursal la toma el
  // servidor de la sesión), con polling cada pocos segundos o SSE, en lugar de localStorage.
  const guardados = useSyncExternalStore(suscribir, leer, () => null)

  // Todos los pedidos (de todas las sucursales), para escribir y para numerar.
  const todos = useMemo(() => guardados ?? [], [guardados])
  const pedidos = useMemo(
    () => todos.filter((pedido) => pedido.idSucursal === idSucursal),
    [todos, idSucursal],
  )

  // Lo que hay guardado, o nada si todavía no se guardó ningún pedido.
  const base = useCallback(() => leer() ?? [], [])

  // Cambios de estado, entrega y cobro.
  const actualizar = useCallback(
    (idPedido: number, cambios: Partial<Pick<PedidoPantalla, 'estado' | 'estadoPago' | 'tipoEntrega'>>) => {
      // TODO: con backend, reemplazar por PATCH /api/pedidos/{idPedido} con `cambios`.
      guardar(base().map((pedido) => (pedido.idPedido === idPedido ? { ...pedido, ...cambios } : pedido)))
    },
    [base],
  )

  // Caja cobra ANTES de crear el pedido: entra pagado y en estado "recibido".
  const crearPedidoMostrador = useCallback(
    (datos: NuevoPedidoMostrador): PedidoPantalla => {
      // TODO: con backend, reemplazar por POST /api/pedidos; el id, la fecha y la sucursal
      // los asigna el servidor.
      if (idSucursal === null) throw new Error('No hay una sucursal asignada para cargar pedidos')
      const actuales = base()
      const pedido: PedidoPantalla = {
        ...datos,
        idPedido: siguienteId(actuales),
        idSucursal,
        fecha: new Date().toISOString(),
        origen: 'mostrador',
        estado: 'recibido',
        estadoPago: 'pagado',
        total: calcularTotal(datos.items),
      }
      guardar([...actuales, pedido])
      return pedido
    },
    [base, idSucursal],
  )

  // Vuelve un pedido a una copia anterior (para "Deshacer" una acción recién hecha).
  const restaurarPedido = useCallback(
    (anterior: PedidoPantalla) => {
      // TODO: con backend, reemplazar por PATCH /api/pedidos/{idPedido} con el estado anterior.
      guardar(base().map((pedido) => (pedido.idPedido === anterior.idPedido ? anterior : pedido)))
    },
    [base],
  )

  return {
    pedidos,
    // Número estimado del próximo pedido: los números son únicos entre sucursales.
    proximoIdPedido: siguienteId(todos),
    crearPedidoMostrador,
    marcarEnPreparacion: (idPedido: number) => actualizar(idPedido, { estado: 'en_preparacion' }),
    marcarListo: (idPedido: number) => actualizar(idPedido, { estado: 'listo' }),
    // Solo delivery: el cadete sale con el pedido.
    marcarEnviado: (idPedido: number) => actualizar(idPedido, { estado: 'enviado' }),
    // Si el pago estaba pendiente (efectivo al entregar), entregar también lo cobra.
    marcarEntregado: (idPedido: number) => actualizar(idPedido, { estado: 'entregado', estadoPago: 'pagado' }),
    // Transferencia verificada: recién ahí el pedido puede ir a Cocina.
    marcarPagado: (idPedido: number) => actualizar(idPedido, { estadoPago: 'pagado' }),
    cambiarTipoEntrega: (idPedido: number, tipoEntrega: TipoEntregaPantalla) =>
      actualizar(idPedido, { tipoEntrega }),
    restaurarPedido,
  }
}
