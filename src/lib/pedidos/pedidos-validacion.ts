// Validación de los pedidos: el que hace un cliente desde el menú digital (POST
// /api/pedidos), el que carga Caja (POST /api/pedidos/caja) y las acciones del personal
// sobre un pedido (PATCH /api/pedidos/{id}).
// Sin imports de servidor: los formularios pueden usarla para avisar antes, pero la que
// decide es la API. Nunca se reciben precios ni el origen del pedido: los pone el servidor.
//
// Datos de contacto según el pedido (acordado con el negocio):
//   Pedido             Celular      Dirección    Indicaciones
//   online + retiro    obligatorio  no se pide   no se pide
//   online + delivery  obligatorio  obligatoria  opcional
//   caja + retiro      no se pide   no se pide   no se pide
//   caja + delivery    obligatorio  obligatoria  opcional
// La localidad de delivery sigue la regla de la sucursal (ver pedidos-online): si tiene
// zonas cargadas es obligatoria y tiene que ser una de ellas.

import { ACCIONES_ESTADO, ESTADOS_PEDIDO, type AccionEstado, type EstadoPedido } from './pedidos-estados'
import { idValido, whatsappValido } from '@/lib/sucursales/sucursales-validacion'

export class ErrorPedido extends Error {
  constructor(public estado: number, mensaje: string, public extra: Record<string, unknown> = {}) {
    super(mensaje)
  }
}

export const MAX_NOMBRE_CLIENTE = 60
export const MIN_DIRECCION = 5
export const MAX_DIRECCION = 200
export const MAX_CANTIDAD_ITEM = 20
export const MAX_ITEMS_PEDIDO = 50
export const MAX_EXTRAS_ITEM = 10
export const MAX_REFERENCIAS = 200
export const MAX_ACLARACION = 200

export const MENSAJE_SUCURSAL_NO_DISPONIBLE = 'Esta sucursal no existe o no está disponible.'
export const MENSAJE_TELEFONO = 'Ingresá tu celular con código de área, sin 0 ni 15 (10 dígitos). Ej: 1123493023.'
// Las mismas reglas, redactadas para el personal (Caja y Pedidos).
export const MENSAJE_TELEFONO_CLIENTE =
  'Ingresá el celular del cliente con código de área, sin 0 ni 15 (10 dígitos). Ej: 1123493023.'
export const MENSAJE_NOMBRE_CLIENTE = `El nombre del cliente debe tener entre 1 y ${MAX_NOMBRE_CLIENTE} caracteres.`
export const MENSAJE_DIRECCION = `Indicá la dirección de entrega (entre ${MIN_DIRECCION} y ${MAX_DIRECCION} caracteres).`
export const MENSAJE_LOCALIDAD = 'Elegí la localidad de entrega.'
export const MENSAJE_REFERENCIAS = `Las indicaciones para el repartidor pueden tener hasta ${MAX_REFERENCIAS} caracteres.`
export const MENSAJE_ACLARACION = `La aclaración para la cocina puede tener hasta ${MAX_ACLARACION} caracteres.`

export type TipoEntregaOnline = 'retiro' | 'delivery'
export type MetodoPagoOnline = 'efectivo' | 'transferencia'

// Una línea es una combinación: producto + variación (si tiene) + extras. El mismo
// producto puede venir en varias líneas si la combinación cambia. Los extras llegan
// ordenados de menor a mayor (así la combinación se compara sin importar el orden).
export type ItemPedidoOnline = { idProducto: number; cantidad: number; idVariacion: number | null; extras: number[] }

// Identifica la combinación de una línea: "idProducto|idVariacion o -|extras ordenados".
// Es la misma clave que usa el carrito del menú digital (lib/pedidos/carrito.ts).
export function claveCombinacion(idProducto: number, idVariacion: number | null, extras: number[]) {
  return `${idProducto}|${idVariacion ?? '-'}|${[...extras].sort((a, b) => a - b).join(',')}`
}

export type PedidoOnlineValidado = {
  slugSucursal: string
  cliente: { nombre: string; telefono: string }
  tipoEntrega: TipoEntregaOnline
  // Solo en delivery; en retiro siempre null (lo que venga se ignora).
  direccion: string | null
  idLocalidad: number | null
  referencias: string | null
  metodoPago: MetodoPagoOnline
  // Para la cocina, de todo el pedido ("2 sin cebolla, la otra completa"). Vacía = null.
  aclaracion: string | null
  items: ItemPedidoOnline[]
}

// Se aceptan espacios, guiones o paréntesis al escribir; se guardan solo los dígitos.
export function digitosTelefono(texto: string) {
  return texto.trim().replace(/[\s\-()]/g, '')
}

// Indicaciones para el repartidor: opcionales; vacías = null. Devuelve undefined si no
// son válidas (tipo o largo), para que cada llamador elija el error.
export function limpiarReferencias(valor: unknown): string | null | undefined {
  return limpiarTextoOpcional(valor, MAX_REFERENCIAS)
}

// Aclaración para la cocina: misma regla que las indicaciones (opcional, vacía = null).
export function limpiarAclaracion(valor: unknown): string | null | undefined {
  return limpiarTextoOpcional(valor, MAX_ACLARACION)
}

function limpiarTextoOpcional(valor: unknown, maximo: number): string | null | undefined {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string') return undefined
  const texto = valor.trim()
  if (texto.length > maximo) return undefined
  return texto || null
}

function validarAclaracion(valor: unknown): string | null {
  const aclaracion = limpiarAclaracion(valor)
  if (aclaracion === undefined) throw new ErrorPedido(400, MENSAJE_ACLARACION)
  return aclaracion
}

export type CampoDelivery = 'telefono' | 'direccion' | 'idLocalidad' | 'referencias'

// Revisión campo por campo de los datos de un delivery cargado por el personal, con los
// mismos mensajes que la API. La usan Caja y "Cambiar a delivery" para avisar antes y
// deshabilitar el botón; el servidor valida igual con validarDatosDelivery.
export function erroresDatosDelivery(
  datos: { telefono: string; direccion: string; idLocalidad: string; referencias: string },
  hayZonas: boolean,
): Partial<Record<CampoDelivery, string>> {
  const errores: Partial<Record<CampoDelivery, string>> = {}
  if (!whatsappValido(digitosTelefono(datos.telefono))) errores.telefono = MENSAJE_TELEFONO_CLIENTE
  const direccion = datos.direccion.trim()
  if (direccion.length < MIN_DIRECCION || direccion.length > MAX_DIRECCION) errores.direccion = MENSAJE_DIRECCION
  if (hayZonas && !datos.idLocalidad) errores.idLocalidad = MENSAJE_LOCALIDAD
  if (limpiarReferencias(datos.referencias) === undefined) errores.referencias = MENSAJE_REFERENCIAS
  return errores
}

export type DatosDeliveryValidados = {
  telefono: string
  direccion: string
  idLocalidad: number | null
  referencias: string | null
}

// Datos de entrega de un delivery cargado por el personal (alta en Caja o cambio de
// retiro a delivery). Si la localidad es obligatoria lo decide la sucursal en el servidor.
function validarDatosDelivery(datos: Record<string, unknown>): DatosDeliveryValidados {
  if (typeof datos.telefono !== 'string') throw new ErrorPedido(400, MENSAJE_TELEFONO_CLIENTE)
  const telefono = digitosTelefono(datos.telefono)
  if (!whatsappValido(telefono)) throw new ErrorPedido(400, MENSAJE_TELEFONO_CLIENTE)
  const direccion = typeof datos.direccion === 'string' ? datos.direccion.trim() : ''
  if (direccion.length < MIN_DIRECCION || direccion.length > MAX_DIRECCION) throw new ErrorPedido(400, MENSAJE_DIRECCION)
  let idLocalidad: number | null = null
  if (datos.idLocalidad !== undefined && datos.idLocalidad !== null) {
    if (!idValido(datos.idLocalidad)) throw new ErrorPedido(400, 'Elegí una localidad válida.')
    idLocalidad = datos.idLocalidad
  }
  const referencias = limpiarReferencias(datos.referencias)
  if (referencias === undefined) throw new ErrorPedido(400, MENSAJE_REFERENCIAS)
  return { telefono, direccion, idLocalidad, referencias }
}

function objeto(valor: unknown, mensaje: string) {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw new ErrorPedido(400, mensaje)
  return valor as Record<string, unknown>
}

// Campos desconocidos se rechazan en todos los niveles: así un cliente no puede colar
// precios, estados u origen aunque el servidor igual los ignoraría.
function soloCampos(datos: Record<string, unknown>, permitidos: string[], mensaje: string) {
  if (Object.keys(datos).some((campo) => !permitidos.includes(campo))) throw new ErrorPedido(400, mensaje)
}

function validarCliente(valor: unknown) {
  const cliente = objeto(valor, 'Completá tus datos de contacto.')
  soloCampos(cliente, ['nombre', 'telefono'], 'Los datos de contacto tienen campos que no se reconocen.')
  if (typeof cliente.nombre !== 'string' || !cliente.nombre.trim() || cliente.nombre.trim().length > MAX_NOMBRE_CLIENTE) {
    throw new ErrorPedido(400, `Tu nombre debe tener entre 1 y ${MAX_NOMBRE_CLIENTE} caracteres.`)
  }
  if (typeof cliente.telefono !== 'string') throw new ErrorPedido(400, MENSAJE_TELEFONO)
  // Misma regla que el WhatsApp de las sucursales: se guardan solo los dígitos.
  const telefono = digitosTelefono(cliente.telefono)
  if (!whatsappValido(telefono)) throw new ErrorPedido(400, MENSAJE_TELEFONO)
  return { nombre: cliente.nombre.trim(), telefono }
}

function validarItems(valor: unknown): ItemPedidoOnline[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new ErrorPedido(400, 'Agregá al menos un producto al pedido.')
  if (valor.length > MAX_ITEMS_PEDIDO) {
    throw new ErrorPedido(400, `El pedido puede tener hasta ${MAX_ITEMS_PEDIDO} productos distintos.`)
  }
  const vistos = new Set<string>()
  return valor.map((elemento) => {
    const item = objeto(elemento, 'Hay un producto del pedido con datos inválidos.')
    soloCampos(
      item,
      ['idProducto', 'cantidad', 'idVariacion', 'extras'],
      'Hay un producto del pedido con campos que no se reconocen.',
    )
    if (!idValido(item.idProducto)) throw new ErrorPedido(400, 'Hay un producto del pedido con datos inválidos.')
    const { cantidad } = item
    if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD_ITEM) {
      throw new ErrorPedido(400, `La cantidad de cada producto tiene que ser un número entero entre 1 y ${MAX_CANTIDAD_ITEM}.`)
    }
    // Sin variación = null. Si el producto la exige (o no la admite) lo decide el servidor.
    let idVariacion: number | null = null
    if (item.idVariacion !== undefined && item.idVariacion !== null) {
      if (!idValido(item.idVariacion)) throw new ErrorPedido(400, 'Hay un producto del pedido con datos inválidos.')
      idVariacion = item.idVariacion
    }
    const extras = validarExtras(item.extras)
    // Una combinación va en una sola línea con su cantidad.
    const clave = claveCombinacion(item.idProducto, idVariacion, extras)
    if (vistos.has(clave)) throw new ErrorPedido(400, 'Hay un producto repetido en el pedido.')
    vistos.add(clave)
    return { idProducto: item.idProducto, cantidad, idVariacion, extras }
  })
}

// Extras de una línea: opcionales (sin extras = lista vacía), ids sin repetir y hasta
// MAX_EXTRAS_ITEM. Se devuelven ordenados. Que existan y correspondan al producto lo
// revisa el servidor.
function validarExtras(valor: unknown): number[] {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor) || !valor.every(idValido)) {
    throw new ErrorPedido(400, 'Hay un producto del pedido con datos inválidos.')
  }
  if (valor.length > MAX_EXTRAS_ITEM) {
    throw new ErrorPedido(400, `Cada producto puede llevar hasta ${MAX_EXTRAS_ITEM} extras.`)
  }
  if (new Set(valor).size !== valor.length) throw new ErrorPedido(400, 'Hay un extra repetido en un producto del pedido.')
  return [...valor].sort((a, b) => a - b)
}

export function validarPedidoOnline(cuerpo: unknown): PedidoOnlineValidado {
  const datos = objeto(cuerpo, 'Enviá un objeto JSON con los datos del pedido.')
  soloCampos(
    datos,
    ['slugSucursal', 'cliente', 'tipoEntrega', 'direccion', 'idLocalidad', 'referencias', 'metodoPago', 'aclaracion', 'items'],
    'El pedido tiene campos que no se reconocen.',
  )

  if (typeof datos.slugSucursal !== 'string' || !datos.slugSucursal) throw new ErrorPedido(400, 'Indicá la sucursal.')
  // Un slug con otra forma no puede existir: se responde igual que una sucursal inexistente.
  if (!/^[a-z0-9-]{1,80}$/.test(datos.slugSucursal)) throw new ErrorPedido(404, MENSAJE_SUCURSAL_NO_DISPONIBLE)

  const cliente = validarCliente(datos.cliente)

  if (datos.tipoEntrega !== 'retiro' && datos.tipoEntrega !== 'delivery') {
    throw new ErrorPedido(400, 'Elegí si retirás en el local o pedís delivery.')
  }
  const tipoEntrega = datos.tipoEntrega

  // En retiro, dirección, localidad e indicaciones se ignoran (no se guardan).
  let direccion: string | null = null
  let idLocalidad: number | null = null
  let referencias: string | null = null
  if (tipoEntrega === 'delivery') {
    const texto = typeof datos.direccion === 'string' ? datos.direccion.trim() : ''
    if (texto.length < MIN_DIRECCION || texto.length > MAX_DIRECCION) throw new ErrorPedido(400, MENSAJE_DIRECCION)
    direccion = texto
    // Si la localidad es obligatoria o no lo decide la sucursal (ver pedidos-online).
    if (datos.idLocalidad !== undefined && datos.idLocalidad !== null) {
      if (!idValido(datos.idLocalidad)) throw new ErrorPedido(400, 'Elegí una localidad válida.')
      idLocalidad = datos.idLocalidad
    }
    const limpias = limpiarReferencias(datos.referencias)
    if (limpias === undefined) throw new ErrorPedido(400, MENSAJE_REFERENCIAS)
    referencias = limpias
  }

  if (datos.metodoPago !== 'efectivo' && datos.metodoPago !== 'transferencia') {
    throw new ErrorPedido(400, 'Elegí cómo vas a pagar: efectivo o transferencia.')
  }

  return {
    slugSucursal: datos.slugSucursal,
    cliente,
    tipoEntrega,
    direccion,
    idLocalidad,
    referencias,
    metodoPago: datos.metodoPago,
    aclaracion: validarAclaracion(datos.aclaracion),
    items: validarItems(datos.items),
  }
}

// ---- Caja (POST /api/pedidos/caja) ----

export type PedidoCajaValidado = {
  cliente: { nombre: string; telefono: string | null }
  tipoEntrega: TipoEntregaOnline
  metodoPago: MetodoPagoOnline
  // Solo en delivery; en retiro no se aceptan (un dato de más se rechaza, no se ignora).
  direccion: string | null
  idLocalidad: number | null
  referencias: string | null
  aclaracion: string | null
  items: ItemPedidoOnline[]
}

const CAMPOS_DELIVERY = ['direccion', 'idLocalidad', 'referencias']

// Retiro: solo el nombre. Delivery: celular, dirección, localidad (según la sucursal) e
// indicaciones opcionales. A diferencia del menú público, un dato que no corresponde al
// tipo de entrega se rechaza: en Caja es un error de la pantalla, no del cliente.
export function validarPedidoCaja(cuerpo: unknown): PedidoCajaValidado {
  const datos = objeto(cuerpo, 'Enviá un objeto JSON con los datos del pedido.')
  soloCampos(
    datos,
    ['cliente', 'tipoEntrega', 'metodoPago', 'aclaracion', 'items', ...CAMPOS_DELIVERY],
    'El pedido tiene campos que no se reconocen.',
  )

  const cliente = objeto(datos.cliente, 'Completá los datos del cliente.')
  soloCampos(cliente, ['nombre', 'telefono'], 'Los datos del cliente tienen campos que no se reconocen.')
  if (typeof cliente.nombre !== 'string' || !cliente.nombre.trim() || cliente.nombre.trim().length > MAX_NOMBRE_CLIENTE) {
    throw new ErrorPedido(400, MENSAJE_NOMBRE_CLIENTE)
  }
  const nombre = cliente.nombre.trim()

  if (datos.tipoEntrega !== 'retiro' && datos.tipoEntrega !== 'delivery') {
    throw new ErrorPedido(400, 'Elegí si el pedido es para retirar o delivery.')
  }
  const tipoEntrega = datos.tipoEntrega

  if (datos.metodoPago !== 'efectivo' && datos.metodoPago !== 'transferencia') {
    throw new ErrorPedido(400, 'Elegí el método de pago: efectivo o transferencia.')
  }
  const metodoPago = datos.metodoPago
  const aclaracion = validarAclaracion(datos.aclaracion)
  const items = validarItems(datos.items)

  if (tipoEntrega === 'retiro') {
    if ('telefono' in cliente || CAMPOS_DELIVERY.some((campo) => campo in datos)) {
      throw new ErrorPedido(400, 'Un pedido para retirar no lleva celular, dirección ni indicaciones.')
    }
    return {
      cliente: { nombre, telefono: null }, tipoEntrega, metodoPago,
      direccion: null, idLocalidad: null, referencias: null, aclaracion, items,
    }
  }

  const entrega = validarDatosDelivery({ ...datos, telefono: cliente.telefono })
  return {
    cliente: { nombre, telefono: entrega.telefono }, tipoEntrega, metodoPago,
    direccion: entrega.direccion, idLocalidad: entrega.idLocalidad, referencias: entrega.referencias, aclaracion, items,
  }
}

// ---- Acciones del personal (PATCH /api/pedidos/{id}) ----

export type AccionPedido =
  | { accion: AccionEstado }
  | { accion: 'deshacer'; estadoAnterior: EstadoPedido }
  | { accion: 'cambiarTipoEntrega'; tipoEntrega: 'retiro' }
  | ({ accion: 'cambiarTipoEntrega'; tipoEntrega: 'delivery' } & DatosDeliveryValidados)

export function validarAccionPedido(cuerpo: unknown): AccionPedido {
  const datos = objeto(cuerpo, 'Enviá un objeto JSON con la acción.')
  const { accion } = datos

  if (typeof accion === 'string' && (ACCIONES_ESTADO as readonly string[]).includes(accion)) {
    soloCampos(datos, ['accion'], 'La acción tiene campos que no se reconocen.')
    return { accion: accion as AccionEstado }
  }

  if (accion === 'deshacer') {
    soloCampos(datos, ['accion', 'estadoAnterior'], 'La acción tiene campos que no se reconocen.')
    if (typeof datos.estadoAnterior !== 'string' || !(ESTADOS_PEDIDO as readonly string[]).includes(datos.estadoAnterior)) {
      throw new ErrorPedido(400, 'Indicá el estado al que vuelve el pedido.')
    }
    return { accion, estadoAnterior: datos.estadoAnterior as EstadoPedido }
  }

  if (accion === 'cambiarTipoEntrega') {
    if (datos.tipoEntrega === 'retiro') {
      // Pasar a retiro borra dirección, localidad e indicaciones: no se manda nada más.
      soloCampos(datos, ['accion', 'tipoEntrega'], 'Un pedido para retirar no lleva dirección ni indicaciones.')
      return { accion, tipoEntrega: 'retiro' }
    }
    if (datos.tipoEntrega === 'delivery') {
      soloCampos(
        datos,
        ['accion', 'tipoEntrega', 'telefono', ...CAMPOS_DELIVERY],
        'La acción tiene campos que no se reconocen.',
      )
      return { accion, tipoEntrega: 'delivery', ...validarDatosDelivery(datos) }
    }
    throw new ErrorPedido(400, 'Elegí si el pedido es para retirar o delivery.')
  }

  throw new ErrorPedido(400, 'La acción no es válida.')
}
