// Carrito del menú digital, uno por sucursal (clave `carrito-v2:{slug}` en localStorage).
//
// useSyncExternalStore + localStorage + un evento propio para que la pestaña actual también se entere (el evento `storage` solo
// avisa a las OTRAS pestañas).
//
// Cada línea es una COMBINACIÓN: producto + variación (si tiene) + extras. El mismo
// producto puede estar en varias líneas ("Doble + Cheddar" y "Simple"); agregar una
// combinación que ya está suma cantidad. La clave de la línea es la misma que usa la API
// para detectar repetidos (claveCombinacion en pedidos-validacion).
//
// Los precios del carrito son solo para mostrar: al confirmar, POST /api/pedidos manda
// únicamente ids y cantidades, y el servidor recalcula todo con los precios de la base.
//
// Las reglas (agregar, limitar, quitar, restaurar, reconciliar con el menú, totales) son
// funciones puras exportadas aparte del hook, para poder probarlas sin navegador.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { MAX_CANTIDAD_ITEM, MAX_EXTRAS_ITEM, MAX_ITEMS_PEDIDO, claveCombinacion } from './pedidos-validacion'
import { textoOpciones } from './pedidos-estados'

export type ExtraCarrito = { idExtra: number; nombre: string }

export type ItemCarrito = {
  // idProducto|idVariacion o -|extras ordenados (ver claveCombinacion).
  clave: string
  idProducto: number
  nombre: string
  // Precio del producto solo, para poder actualizar el unitario cuando la página tiene
  // el precio vigente del producto pero no el de sus opciones.
  precioBase: number
  // Producto + variación + extras. Solo para mostrar.
  precioUnitario: number
  cantidad: number
  idVariacion: number | null
  variacion: string | null
  extras: ExtraCarrito[]
}

type OpcionCarrito = { nombre: string; precioAdicional: number }

// Lo que el menú sabe de un producto hoy. Las páginas que solo tienen id, nombre y precio
// (sin variaciones ni extras) igual pueden reconciliar: ver reconciliarConMenu.
export type ProductoCarrito = {
  idProducto: number
  nombre: string
  precio: number
  variaciones?: (OpcionCarrito & { idVariacion: number })[]
  extras?: (OpcionCarrito & { idExtra: number })[]
}

// Lo que el cliente eligió en el modal del producto.
export type EleccionProducto = { idVariacion: number | null; extras: number[]; cantidad: number }

// Resultado de agregar: 'limitado' = se agregó pero la línea quedó en el máximo.
export type ResultadoAgregar = 'agregado' | 'limitado' | 'tope-cantidad' | 'tope-lineas' | 'invalido'

// ---------------------------------------------------------------------------
// Reglas puras
// ---------------------------------------------------------------------------

// Precios con centavos: se redondea para no arrastrar errores de coma flotante.
function redondear(valor: number) {
  return Math.round(valor * 100) / 100
}

// Cantidad entera entre 1 y el máximo que acepta la API por línea.
export function limitarCantidad(cantidad: number) {
  if (!Number.isFinite(cantidad)) return 1
  return Math.min(MAX_CANTIDAD_ITEM, Math.max(1, Math.trunc(cantidad)))
}

export function claveLinea(idProducto: number, idVariacion: number | null, extras: number[]) {
  return claveCombinacion(idProducto, idVariacion, extras)
}

// "Doble · + Cheddar, + Panceta" (vacío si la línea no tiene opciones).
export function detalleLinea(item: Pick<ItemCarrito, 'variacion' | 'extras'>) {
  return textoOpciones(item.variacion, item.extras.map((extra) => extra.nombre))
}

// Nombre para avisos: "Hamburguesa (Doble · + Cheddar)".
export function nombreLinea(item: Pick<ItemCarrito, 'nombre' | 'variacion' | 'extras'>) {
  const detalle = detalleLinea(item)
  return detalle ? `${item.nombre} (${detalle})` : item.nombre
}

// Arma la línea con los datos del menú. null si la elección no es válida para ese
// producto: falta la variación (o sobra), o hay extras repetidos, de más o ajenos.
export function armarLinea(producto: ProductoCarrito, eleccion: EleccionProducto): ItemCarrito | null {
  const variaciones = producto.variaciones ?? []
  const disponibles = producto.extras ?? []
  const variacion = eleccion.idVariacion === null
    ? null
    : variaciones.find((opcion) => opcion.idVariacion === eleccion.idVariacion)
  if (variacion === undefined || (variacion === null && variaciones.length > 0)) return null
  if (eleccion.extras.length > MAX_EXTRAS_ITEM || new Set(eleccion.extras).size !== eleccion.extras.length) return null
  const extras = disponibles.filter((extra) => eleccion.extras.includes(extra.idExtra))
  if (extras.length !== eleccion.extras.length) return null

  return {
    clave: claveLinea(producto.idProducto, variacion?.idVariacion ?? null, eleccion.extras),
    idProducto: producto.idProducto,
    nombre: producto.nombre,
    precioBase: producto.precio,
    precioUnitario: redondear(
      producto.precio + (variacion?.precioAdicional ?? 0) + extras.reduce((suma, extra) => suma + extra.precioAdicional, 0),
    ),
    cantidad: limitarCantidad(eleccion.cantidad),
    idVariacion: variacion?.idVariacion ?? null,
    variacion: variacion?.nombre ?? null,
    extras: extras.map(({ idExtra, nombre }) => ({ idExtra, nombre })),
  }
}

// Suma la línea: si la combinación ya está, se suma la cantidad (hasta el máximo); si no,
// se agrega al final. Devuelve la misma lista si no entra.
export function agregarLinea(items: ItemCarrito[], linea: ItemCarrito): { items: ItemCarrito[]; resultado: ResultadoAgregar } {
  const existente = items.find((item) => item.clave === linea.clave)
  if (existente) {
    if (existente.cantidad >= MAX_CANTIDAD_ITEM) return { items, resultado: 'tope-cantidad' }
    const suma = existente.cantidad + linea.cantidad
    return {
      items: items.map((item) => (item.clave === linea.clave ? { ...item, cantidad: limitarCantidad(suma) } : item)),
      resultado: suma > MAX_CANTIDAD_ITEM ? 'limitado' : 'agregado',
    }
  }
  if (items.length >= MAX_ITEMS_PEDIDO) return { items, resultado: 'tope-lineas' }
  return { items: [...items, { ...linea, cantidad: limitarCantidad(linea.cantidad) }], resultado: 'agregado' }
}

// Nunca baja de 1: quitar una línea es una acción aparte (el tacho, con "Deshacer").
export function cambiarCantidadItem(items: ItemCarrito[], clave: string, cantidad: number): ItemCarrito[] {
  const nueva = limitarCantidad(cantidad)
  const actual = items.find((item) => item.clave === clave)
  if (!actual || actual.cantidad === nueva) return items
  return items.map((item) => (item.clave === clave ? { ...item, cantidad: nueva } : item))
}

// Saca una línea y devuelve lo necesario para deshacerlo (la línea y dónde estaba).
export function quitarLinea(items: ItemCarrito[], clave: string) {
  const indice = items.findIndex((item) => item.clave === clave)
  if (indice === -1) return { items, quitada: null }
  return { items: items.filter((_, posicion) => posicion !== indice), quitada: { linea: items[indice], indice } }
}

// Deshacer: vuelve la línea tal cual estaba, en su posición (o al final si la lista se
// achicó). Si mientras tanto se volvió a agregar la misma combinación, se suman las
// cantidades (hasta el máximo). Si ya no entra, la lista queda igual.
export function restaurarLinea(items: ItemCarrito[], linea: ItemCarrito, indice: number): ItemCarrito[] {
  if (items.some((item) => item.clave === linea.clave)) return agregarLinea(items, linea).items
  if (items.length >= MAX_ITEMS_PEDIDO) return items
  const posicion = Math.min(Math.max(0, indice), items.length)
  return [...items.slice(0, posicion), linea, ...items.slice(posicion)]
}

// Saca todas las líneas de esos productos (lo que el servidor rechazó con 409).
export function quitarItems(items: ItemCarrito[], ids: number[]): ItemCarrito[] {
  const quitar = new Set(ids)
  const restantes = items.filter((item) => !quitar.has(item.idProducto))
  return restantes.length === items.length ? items : restantes
}

export function calcularTotales(items: ItemCarrito[]) {
  return items.reduce(
    (acumulado, item) => ({
      cantidadTotal: acumulado.cantidadTotal + item.cantidad,
      total: acumulado.total + item.precioUnitario * item.cantidad,
    }),
    { cantidadTotal: 0, total: 0 },
  )
}

// Unidades de un producto en el carrito, sumando todas sus combinaciones.
export function cantidadDeProducto(items: ItemCarrito[], idProducto: number) {
  return items.reduce((suma, item) => (item.idProducto === idProducto ? suma + item.cantidad : suma), 0)
}

// Compara el carrito con el menú vigente: saca las líneas cuyo producto ya no se ofrece y
// actualiza nombre y precio del resto. `cambio` indica si hay que guardar.
// Si el menú trae variaciones y extras (la carta), además saca las líneas cuya variación
// o alguno de sus extras ya no está (o que ahora exigen elegir una variación) y
// actualiza sus nombres y precios. Si no los trae (carrito y checkout reciben solo id,
// nombre y precio), las opciones se mantienen y el unitario se corrige solo por la
// diferencia del precio del producto; el servidor igual revisa todo al confirmar.
export function reconciliarConMenu(items: ItemCarrito[], menu: ProductoCarrito[]) {
  const vigentes = new Map(menu.map((producto) => [producto.idProducto, producto]))
  const quitados: ItemCarrito[] = []
  const actualizados: ItemCarrito[] = []
  let cambio = false
  for (const item of items) {
    const producto = vigentes.get(item.idProducto)
    const nuevo = producto ? actualizarLinea(item, producto) : null
    if (!nuevo) {
      quitados.push(item)
      cambio = true
      continue
    }
    if (
      nuevo.nombre !== item.nombre || nuevo.precioBase !== item.precioBase ||
      nuevo.precioUnitario !== item.precioUnitario || nuevo.variacion !== item.variacion ||
      nuevo.extras.some((extra, indice) => extra.nombre !== item.extras[indice].nombre)
    ) {
      cambio = true
    }
    actualizados.push(nuevo)
  }
  return { items: cambio ? actualizados : items, quitados, cambio }
}

function actualizarLinea(item: ItemCarrito, producto: ProductoCarrito): ItemCarrito | null {
  if (producto.variaciones === undefined || producto.extras === undefined) {
    return {
      ...item,
      nombre: producto.nombre,
      precioBase: producto.precio,
      precioUnitario: redondear(item.precioUnitario - item.precioBase + producto.precio),
    }
  }
  const linea = armarLinea(producto, {
    idVariacion: item.idVariacion,
    extras: item.extras.map((extra) => extra.idExtra),
    cantidad: item.cantidad,
  })
  // armarLinea devuelve los extras en el orden del menú; la clave no cambia.
  return linea && { ...linea, clave: item.clave }
}

// Lo guardado puede venir de otra versión o haber sido editado a mano: se acepta solo lo
// que tiene forma de línea, sin combinaciones repetidas y dentro de los topes de la API.
// La clave se recalcula siempre con los ids (no se confía en la guardada).
export function normalizarGuardado(valor: unknown): ItemCarrito[] {
  if (!Array.isArray(valor)) return []
  const vistas = new Set<string>()
  const items: ItemCarrito[] = []
  for (const elemento of valor) {
    if (items.length >= MAX_ITEMS_PEDIDO) break
    if (typeof elemento !== 'object' || elemento === null) continue
    const { idProducto, nombre, precioBase, precioUnitario, cantidad, idVariacion, variacion, extras } =
      elemento as Record<string, unknown>
    if (!idPositivo(idProducto) || typeof nombre !== 'string' || typeof cantidad !== 'number') continue
    if (!precioValido(precioBase) || !precioValido(precioUnitario)) continue
    if (idVariacion !== null && !idPositivo(idVariacion)) continue
    if ((idVariacion === null) !== (variacion === null) || (variacion !== null && typeof variacion !== 'string')) continue
    const extrasValidos = normalizarExtras(extras)
    if (!extrasValidos) continue
    const clave = claveLinea(idProducto, idVariacion, extrasValidos.map((extra) => extra.idExtra))
    if (vistas.has(clave)) continue
    vistas.add(clave)
    items.push({
      clave, idProducto, nombre, precioBase, precioUnitario, cantidad: limitarCantidad(cantidad),
      idVariacion, variacion: variacion as string | null, extras: extrasValidos,
    })
  }
  return items
}

function idPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0
}

function precioValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function normalizarExtras(valor: unknown): ExtraCarrito[] | null {
  if (!Array.isArray(valor) || valor.length > MAX_EXTRAS_ITEM) return null
  const extras: ExtraCarrito[] = []
  for (const elemento of valor) {
    if (typeof elemento !== 'object' || elemento === null) return null
    const { idExtra, nombre } = elemento as Record<string, unknown>
    if (!idPositivo(idExtra) || typeof nombre !== 'string' || extras.some((extra) => extra.idExtra === idExtra)) return null
    extras.push({ idExtra, nombre })
  }
  return extras
}

// ---------------------------------------------------------------------------
// Persistencia (localStorage) y aviso de productos quitados (memoria)
// ---------------------------------------------------------------------------

const EVENTO_LOCAL = 'carrito:cambio'
const SIN_ITEMS: ItemCarrito[] = []
const SIN_NOMBRES: string[] = []

// v2: las líneas pasaron a ser combinaciones (clave, variación, extras). Los carritos
// v1 (una línea por producto, sin opciones) no se migran: un producto que hoy exige
// elegir variación no se puede completar solo, así que se descartan (la clave vieja
// simplemente deja de leerse).
function clave(slug: string) {
  return `carrito-v2:${slug}`
}

// useSyncExternalStore exige devolver la misma referencia mientras no cambien los datos:
// se guarda lo último leído por sucursal y solo se vuelve a parsear si cambió el texto.
const cache = new Map<string, { crudo: string | null; items: ItemCarrito[] }>()

function leer(slug: string): ItemCarrito[] {
  let crudo: string | null = null
  try {
    crudo = localStorage.getItem(clave(slug))
  } catch {
    return SIN_ITEMS
  }
  const previo = cache.get(slug)
  if (previo && previo.crudo === crudo) return previo.items
  let items = SIN_ITEMS
  try {
    items = crudo ? normalizarGuardado(JSON.parse(crudo)) : SIN_ITEMS
  } catch {
    items = SIN_ITEMS
  }
  cache.set(slug, { crudo, items })
  return items
}

function avisar() {
  window.dispatchEvent(new Event(EVENTO_LOCAL))
}

function guardar(slug: string, items: ItemCarrito[]) {
  try {
    if (items.length === 0) localStorage.removeItem(clave(slug))
    else localStorage.setItem(clave(slug), JSON.stringify(items))
  } catch {
    // Sin storage disponible (modo privado estricto): el carrito no persiste.
  }
  avisar()
}

// Nombres de los productos que se sacaron solos (ya no están en el menú) para avisarle al
// cliente. Vive en memoria: es un aviso de esta visita, no hace falta guardarlo.
const quitadosPorSucursal = new Map<string, string[]>()

function registrarQuitados(slug: string, nombres: string[]) {
  if (nombres.length === 0) return
  const previos = quitadosPorSucursal.get(slug) ?? []
  quitadosPorSucursal.set(slug, [...new Set([...previos, ...nombres])])
}

function suscribir(avisarCambio: () => void) {
  window.addEventListener('storage', avisarCambio)
  window.addEventListener(EVENTO_LOCAL, avisarCambio)
  return () => {
    window.removeEventListener('storage', avisarCambio)
    window.removeEventListener(EVENTO_LOCAL, avisarCambio)
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// En el servidor (y durante la hidratación) el carrito está vacío: el contenido real
// aparece recién en el navegador. Ver useHidratado para no confundir eso con "vacío".
export function useCarrito(slug: string) {
  const items = useSyncExternalStore(
    suscribir,
    useCallback(() => leer(slug), [slug]),
    () => SIN_ITEMS,
  )
  const productosQuitados = useSyncExternalStore(
    suscribir,
    useCallback(() => quitadosPorSucursal.get(slug) ?? SIN_NOMBRES, [slug]),
    () => SIN_NOMBRES,
  )

  const { cantidadTotal, total } = useMemo(() => calcularTotales(items), [items])

  // Cada acción lee lo guardado en ese momento (no lo del último render) y escribe solo
  // si algo cambió.
  const aplicar = useCallback(
    (cambio: (actuales: ItemCarrito[]) => ItemCarrito[]) => {
      const actuales = leer(slug)
      const nuevos = cambio(actuales)
      if (nuevos !== actuales) guardar(slug, nuevos)
      return nuevos !== actuales
    },
    [slug],
  )

  // Agrega la combinación elegida en el modal del producto.
  const agregar = useCallback(
    (producto: ProductoCarrito, eleccion: EleccionProducto): ResultadoAgregar => {
      const linea = armarLinea(producto, eleccion)
      if (!linea) return 'invalido'
      const actuales = leer(slug)
      const { items: nuevos, resultado } = agregarLinea(actuales, linea)
      if (nuevos !== actuales) guardar(slug, nuevos)
      return resultado
    },
    [slug],
  )
  const cambiarCantidad = useCallback(
    (claveItem: string, cantidad: number) =>
      void aplicar((actuales) => cambiarCantidadItem(actuales, claveItem, cantidad)),
    [aplicar],
  )
  // Devuelve la línea quitada y su posición, para "Deshacer".
  const quitar = useCallback(
    (claveItem: string) => {
      const { items: nuevos, quitada } = quitarLinea(leer(slug), claveItem)
      if (quitada) guardar(slug, nuevos)
      return quitada
    },
    [slug],
  )
  const restaurar = useCallback(
    (linea: ItemCarrito, indice: number) => void aplicar((actuales) => restaurarLinea(actuales, linea, indice)),
    [aplicar],
  )
  // Productos que el servidor rechazó (409): se sacan todas sus líneas y se avisa cuáles eran.
  const quitarProductos = useCallback(
    (ids: number[]) => {
      const actuales = leer(slug)
      const ausentes = new Set(ids)
      registrarQuitados(slug, actuales.filter((item) => ausentes.has(item.idProducto)).map(nombreLinea))
      if (!aplicar((lista) => quitarItems(lista, ids))) avisar()
    },
    [aplicar, slug],
  )
  const vaciar = useCallback(() => guardar(slug, []), [slug])

  // Se llama al cargar una página que trae el menú vigente (no en cada lectura).
  const reconciliar = useCallback(
    (menu: ProductoCarrito[]) => {
      const resultado = reconciliarConMenu(leer(slug), menu)
      if (!resultado.cambio) return
      registrarQuitados(slug, resultado.quitados.map(nombreLinea))
      guardar(slug, resultado.items)
    },
    [slug],
  )

  const descartarAviso = useCallback(() => {
    if (!quitadosPorSucursal.delete(slug)) return
    avisar()
  }, [slug])

  return {
    items, cantidadTotal, total, productosQuitados,
    agregar, cambiarCantidad, quitar, restaurar, vaciar, quitarProductos, reconciliar, descartarAviso,
  }
}

// false en el servidor y durante la hidratación, true después. Sirve para no mostrar
// "tu carrito está vacío" (ni redirigir) antes de haber leído localStorage.
const sinSuscripcion = () => () => {}

export function useHidratado() {
  return useSyncExternalStore(sinSuscripcion, () => true, () => false)
}
