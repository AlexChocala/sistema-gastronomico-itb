'use client'

// Pantalla de Caja (pestaña aparte, sin sidebar). Flujo de mostrador:
//   1. Armar el pedido (productos, cliente, tipo de entrega; en delivery también celular,
//      dirección, localidad si la sucursal tiene zonas e indicaciones opcionales) → "Cobrar".
//   2. Elegir método de pago (efectivo calcula el vuelto) → "Confirmar pago".
//   3. POST /api/pedidos/caja: el pedido entra PAGADO a Cocina como "recibido", con el
//      número que le da la base, y se imprimen comanda + ticket.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Banknote, Bike, CircleCheck, Landmark, Minus, Plus, Printer, Search, ShoppingBag, Trash2, X,
} from '@/components/icons'
import { SelectorCantidad } from '@/components/carta/compartidos/SelectorCantidad'
import { IconoCategoria } from '@/components/icons/IconoCategoria'
import { Campanita } from '@/components/notificaciones/Campanita'
import { TicketsPedido } from '@/components/pantallas/TicketsPedido'
import { CamposDelivery, VALORES_DELIVERY_VACIOS, type ValoresDelivery } from '@/components/pedidos/CamposDelivery'
import { DatosEntrega } from '@/components/pedidos/DatosEntrega'
import { PastillaSucursal } from '@/components/sucursal/SucursalActiva'
import {
  crearPedidoMostrador,
  cuerpoPedidoCaja,
  type MetodoPagoPantalla,
  type PedidoPantalla,
  type TipoEntregaPantalla,
  type ZonaDelivery,
} from '@/lib/pedidos/pedidos-pantallas'
import {
  ErrorPedido, MAX_ACLARACION, MAX_CANTIDAD_ITEM, MAX_EXTRAS_ITEM, MAX_NOMBRE_CLIENTE,
  claveCombinacion, erroresDatosDelivery, validarPedidoCaja,
} from '@/lib/pedidos/pedidos-validacion'
import { textoOpciones } from '@/lib/pedidos/pedidos-estados'

const TODAS = 'Todos'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

type OpcionCaja = { nombre: string; precioAdicional: number }
type VariacionCaja = OpcionCaja & { idVariacion: number }
type ExtraCaja = OpcionCaja & { idExtra: number }

type ProductoCaja = {
  idProducto: number
  nombre: string
  categoria: string
  // URL pública de la foto (Supabase Storage); null si no tiene.
  imagenUrl: string | null
  // Precio de la variación más barata (o el único, si no tiene variaciones).
  precio: number
  // En el orden de su categoría: la primera es la principal.
  variaciones: VariacionCaja[]
  // Los extras activos que admite, por nombre.
  extras: ExtraCaja[]
  disponible: boolean
}

type RespuestaProductosCaja = {
  productos?: ProductoCaja[]
  localidadesDelivery?: ZonaDelivery[]
  error?: string
}

// Una línea por combinación (producto + variación + extras): "Pizza Entera" y
// "Pizza Media + Cheddar" son líneas distintas, igual que en la carta.
type LineaCarrito = {
  clave: string
  producto: ProductoCaja
  variacion: VariacionCaja | null
  extras: ExtraCaja[]
  cantidad: number
}

type Combinacion = Pick<LineaCarrito, 'producto' | 'variacion' | 'extras'>

function claveDe({ producto, variacion, extras }: Combinacion) {
  return claveCombinacion(producto.idProducto, variacion?.idVariacion ?? null, extras.map((extra) => extra.idExtra))
}

function precioUnitario({ producto, variacion, extras }: Combinacion) {
  return producto.precio + (variacion?.precioAdicional ?? 0) + extras.reduce((suma, extra) => suma + extra.precioAdicional, 0)
}

// Con variaciones o extras hay algo para elegir: se abre la ventana.
function abreVentana(producto: ProductoCaja) {
  return producto.variaciones.length > 0 || producto.extras.length > 0
}

// Sin nada para elegir, tocarla suma uno. Si no, abre la ventana; la tarjeta muestra el
// precio de la principal y qué se puede elegir.
function TarjetaProducto({
  producto,
  bloqueado,
  onElegir,
}: {
  producto: ProductoCaja
  bloqueado: boolean
  onElegir: () => void
}) {
  const principal = producto.variaciones[0] ?? null
  const pista = principal ? `${producto.variaciones.length} opciones` : producto.extras.length > 0 ? 'Con extras' : null
  return (
    <button
      type="button"
      onClick={onElegir}
      disabled={!producto.disponible || bloqueado}
      aria-haspopup={abreVentana(producto) ? 'dialog' : undefined}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl bg-surface p-4 text-center shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm"
    >
      <span className={`inline-flex items-center gap-1.5 text-xs ${producto.disponible ? 'text-success' : 'text-danger'}`}>
        <span className={`size-1.5 rounded-full ${producto.disponible ? 'bg-success' : 'bg-danger'}`} />
        {producto.disponible ? 'Disponible' : 'Sin stock'}
      </span>
      {producto.imagenUrl ? (
        // Entera (contain): con PNG/WebP de fondo transparente el plato queda "flotando".
        // eslint-disable-next-line @next/next/no-img-element
        <img src={producto.imagenUrl} alt="" loading="lazy" decoding="async" className="size-24 object-contain" />
      ) : (
        <span className="flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <IconoCategoria categoria={producto.categoria} className="size-9" strokeWidth={1.5} />
        </span>
      )}
      <span className="flex flex-col gap-0.5">
        <span className="leading-tight">{producto.nombre}</span>
        <span className="text-xs text-muted">{producto.categoria}</span>
      </span>
      <span className="mt-auto flex flex-col items-center">
        <span className="text-lg font-bold">{formatoPrecio.format(precioUnitario({ producto, variacion: principal, extras: [] }))}</span>
        {pista && <span className="text-xs text-muted">{pista}</span>}
      </span>
    </button>
  )
}

// Ventana para elegir en Caja (como el modal de la carta): un contador por variación (la
// principal arranca en 1) o uno solo si no tiene, y los extras, que se suman a cada
// opción elegida. <dialog> nativo: Esc, la X o tocar el fondo cierran sin agregar.
function ModalProductoCaja({
  producto,
  onAgregar,
  onCerrar,
}: {
  producto: ProductoCaja
  onAgregar: (combinaciones: (Combinacion & { cantidad: number })[]) => void
  onCerrar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const { variaciones } = producto
  const [cantidades, setCantidades] = useState<Record<number, number>>(() =>
    variaciones.length > 0 ? { [variaciones[0].idVariacion]: 1 } : {},
  )
  const [cantidadUnica, setCantidadUnica] = useState(1)
  const [idExtras, setIdExtras] = useState<number[]>([])

  useEffect(() => {
    const elemento = dialogo.current
    if (elemento && !elemento.open) elemento.showModal()
  }, [])

  const extras = producto.extras.filter((extra) => idExtras.includes(extra.idExtra))
  const combinaciones = variaciones.length > 0
    ? variaciones
      .filter((variacion) => (cantidades[variacion.idVariacion] ?? 0) > 0)
      .map((variacion) => ({ producto, variacion, extras, cantidad: cantidades[variacion.idVariacion] }))
    : [{ producto, variacion: null, extras, cantidad: cantidadUnica }]
  const total = combinaciones.reduce((suma, combinacion) => suma + precioUnitario(combinacion) * combinacion.cantidad, 0)
  const topeExtras = idExtras.length >= MAX_EXTRAS_ITEM

  function cambiar(idVariacion: number, cambio: number) {
    setCantidades((actuales) => ({
      ...actuales,
      [idVariacion]: Math.min(MAX_CANTIDAD_ITEM, Math.max(0, (actuales[idVariacion] ?? 0) + cambio)),
    }))
  }

  function alternarExtra(idExtra: number) {
    setIdExtras((actuales) => (actuales.includes(idExtra) ? actuales.filter((id) => id !== idExtra) : [...actuales, idExtra]))
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-producto-caja"
      onClose={onCerrar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) dialogo.current?.close()
      }}
      className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-text shadow-xl backdrop:bg-text/50"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-3">
            {producto.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={producto.imagenUrl} alt="" className="size-14 shrink-0 object-contain" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <IconoCategoria categoria={producto.categoria} className="size-6" strokeWidth={1.5} />
              </span>
            )}
            <div>
              <h2 id="titulo-producto-caja" className="text-lg leading-tight font-semibold">{producto.nombre}</h2>
              <p className="text-sm text-muted">
                {variaciones.length > 0 ? 'Elegí al menos 1 opción' : formatoPrecio.format(producto.precio)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-2">
          {variaciones.length > 0 && (
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {variaciones.map((variacion) => (
                <li key={variacion.idVariacion} className="flex items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{variacion.nombre}</span>
                    <span className="text-sm text-muted tabular-nums">
                      {formatoPrecio.format(precioUnitario({ producto, variacion, extras: [] }))}
                    </span>
                  </div>
                  <SelectorCantidad
                    nombre={`${producto.nombre} ${variacion.nombre}`}
                    cantidad={cantidades[variacion.idVariacion] ?? 0}
                    minimo={0}
                    onSumar={() => cambiar(variacion.idVariacion, 1)}
                    onRestar={() => cambiar(variacion.idVariacion, -1)}
                  />
                </li>
              ))}
            </ul>
          )}

          {producto.extras.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-muted">Extras (opcional)</legend>
              {producto.extras.map((extra) => {
                const elegido = idExtras.includes(extra.idExtra)
                const bloqueado = !elegido && topeExtras
                return (
                  <label
                    key={extra.idExtra}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2 transition-colors ${elegido ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-accent/50'} ${bloqueado ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={elegido}
                      disabled={bloqueado}
                      onChange={() => alternarExtra(extra.idExtra)}
                      className="size-5 shrink-0 accent-accent"
                    />
                    <span className="flex-1">{extra.nombre}</span>
                    <span className="text-sm text-muted tabular-nums">+{formatoPrecio.format(extra.precioAdicional)}</span>
                  </label>
                )
              })}
              {idExtras.length > 0 && combinaciones.length > 1 && (
                <p className="text-xs text-muted">Los extras se suman a cada opción elegida.</p>
              )}
            </fieldset>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 p-5 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold tabular-nums">{formatoPrecio.format(total)}</span>
          </div>
          <div className="flex items-center gap-3">
            {variaciones.length === 0 && (
              <SelectorCantidad
                nombre={producto.nombre}
                cantidad={cantidadUnica}
                onSumar={() => setCantidadUnica((actual) => Math.min(MAX_CANTIDAD_ITEM, actual + 1))}
                onRestar={() => setCantidadUnica((actual) => Math.max(1, actual - 1))}
              />
            )}
            <button
              type="button"
              disabled={combinaciones.length === 0}
              onClick={() => {
                onAgregar(combinaciones)
                dialogo.current?.close()
              }}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
            >
              <Plus className="size-5" />
              Agregar al pedido
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

// Línea del carrito. Antes de quitar un producto (tacho, o "−" con cantidad 1) muestra
// una confirmación en el lugar de los controles.
function LineaCarritoItem({
  linea,
  confirmando,
  onSumar,
  onRestar,
  onPedirQuitar,
  onCancelarQuitar,
  onConfirmarQuitar,
}: {
  linea: LineaCarrito
  confirmando: boolean
  onSumar: () => void
  onRestar: () => void
  onPedirQuitar: () => void
  onCancelarQuitar: () => void
  onConfirmarQuitar: () => void
}) {
  const { producto, variacion, extras, cantidad } = linea
  const opciones = textoOpciones(variacion?.nombre ?? null, extras.map((extra) => extra.nombre))

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="leading-tight">
          {producto.nombre}
          {opciones && <span className="block text-xs break-words text-muted">{opciones}</span>}
        </span>
        <span className="shrink-0 font-semibold">{formatoPrecio.format(precioUnitario(linea) * cantidad)}</span>
      </div>

      {confirmando ? (
        <div
          role="alertdialog"
          aria-label={`Confirmar quitar ${producto.nombre}`}
          className="flex flex-col gap-3 rounded-xl bg-surface p-3"
        >
          <p className="text-sm">¿Desea quitar este producto del carrito?</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <button
              type="button"
              onClick={onCancelarQuitar}
              className="cursor-pointer rounded-full border border-border py-2 hover:bg-bg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmarQuitar}
              className="cursor-pointer rounded-full bg-danger py-2 text-on-primary hover:opacity-90"
            >
              Confirmar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full bg-surface p-1">
            <button
              type="button"
              onClick={onRestar}
              aria-label={`Quitar una unidad de ${producto.nombre}`}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-bg"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center text-sm">{cantidad}</span>
            <button
              type="button"
              onClick={onSumar}
              aria-label={`Agregar una unidad de ${producto.nombre}`}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-bg"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onPedirQuitar}
            aria-label={`Eliminar ${producto.nombre}`}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-danger hover:bg-surface"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  )
}

const opcionesPago = [
  { valor: 'efectivo', texto: 'Efectivo', icono: Banknote },
  { valor: 'transferencia', texto: 'Transferencia', icono: Landmark },
] as const

// Paso de cobro: reemplaza al carrito en el panel derecho hasta confirmar o volver.
function PanelCobro({
  total,
  metodoPago,
  pagaCon,
  enviando,
  error,
  onCambiarMetodo,
  onCambiarPagaCon,
  onVolver,
  onConfirmar,
}: {
  total: number
  metodoPago: MetodoPagoPantalla
  pagaCon: string
  enviando: boolean
  error: string | null
  onCambiarMetodo: (metodo: MetodoPagoPantalla) => void
  onCambiarPagaCon: (valor: string) => void
  onVolver: () => void
  onConfirmar: () => void
}) {
  const montoRecibido = Number(pagaCon)
  const faltante = total - montoRecibido
  const pagoValido = metodoPago === 'transferencia' || (pagaCon !== '' && faltante <= 0)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="rounded-2xl bg-bg p-5 text-center">
        <p className="text-sm text-muted">Total a cobrar</p>
        <p className="mt-1 text-4xl font-bold">{formatoPrecio.format(total)}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm">Método de pago</p>
        <div className="grid grid-cols-2 gap-2">
          {opcionesPago.map(({ valor, texto, icono: Icono }) => (
            <button
              key={valor}
              type="button"
              onClick={() => onCambiarMetodo(valor)}
              aria-pressed={metodoPago === valor}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 py-4 text-sm transition-colors ${metodoPago === valor ? 'border-accent bg-accent-soft text-text' : 'border-border text-muted hover:text-text'}`}
            >
              <Icono className={`size-6 ${metodoPago === valor ? 'text-accent' : ''}`} strokeWidth={1.75} />
              {texto}
            </button>
          ))}
        </div>
      </div>

      {metodoPago === 'efectivo' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="paga-con" className="text-sm">
            Paga con
          </label>
          <input
            id="paga-con"
            type="number"
            inputMode="numeric"
            min={0}
            value={pagaCon}
            onChange={(e) => onCambiarPagaCon(e.target.value)}
            placeholder={String(total)}
            className="rounded-full border border-border bg-surface px-4 py-2.5 text-lg outline-none focus:border-accent"
          />
          {pagaCon !== '' && (
            <p className={`flex justify-between text-sm ${faltante > 0 ? 'text-danger' : ''}`}>
              <span>{faltante > 0 ? 'Falta' : 'Vuelto'}</span>
              <span className="text-lg font-bold">{formatoPrecio.format(Math.abs(faltante))}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl bg-warning-surface p-4 text-sm">
          Verificá que la transferencia esté acreditada antes de confirmar.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-auto rounded-2xl bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className={`${error ? '' : 'mt-auto '}grid grid-cols-[auto_1fr] gap-2`}>
        <button
          type="button"
          onClick={onVolver}
          disabled={enviando}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-5 py-3.5 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={!pagoValido || enviando}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        >
          <CircleCheck className="size-5" />
          {enviando ? 'Registrando…' : 'Confirmar pago'}
        </button>
      </div>
      <p className="-mt-3 text-center text-xs text-muted">Se envía a cocina y se imprimen los tickets.</p>
    </div>
  )
}

type Cobrado = { pedido: PedidoPantalla; pagaCon: number | null }

const MENSAJE_PRODUCTOS_NO_DISPONIBLES =
  'Algunos productos ya no están disponibles y los sacamos del pedido. Revisá el carrito antes de cobrar.'

export default function CajaPage() {
  const [productos, setProductos] = useState<ProductoCaja[]>([])
  // Zonas de delivery de la sucursal: si hay, en un delivery hay que elegir una.
  const [zonas, setZonas] = useState<ZonaDelivery[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [errorProductos, setErrorProductos] = useState('')

  const [categoria, setCategoria] = useState(TODAS)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [cliente, setCliente] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntregaPantalla>('retiro')
  // Solo se mandan en delivery; se conservan si se vuelve a retiro por error.
  const [entrega, setEntrega] = useState<ValoresDelivery>(VALORES_DELIVERY_VACIOS)
  // Línea (clave) que espera confirmación antes de salir del carrito.
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<string | null>(null)
  // Aclaración para la cocina, de todo el pedido.
  const [aclaracion, setAclaracion] = useState('')
  // Producto con variaciones cuya ventana está abierta (null = cerrada).
  const [eligiendo, setEligiendo] = useState<ProductoCaja | null>(null)

  const [cobrando, setCobrando] = useState(false)
  const [metodoPago, setMetodoPago] = useState<MetodoPagoPantalla>('efectivo')
  const [pagaCon, setPagaCon] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  // Aviso sobre el carrito (por ejemplo, productos que se quedaron sin stock al cobrar).
  const [avisoCarrito, setAvisoCarrito] = useState<string | null>(null)
  // Último pedido cobrado: sus tickets quedan listos para reimprimir.
  const [ultimoCobrado, setUltimoCobrado] = useState<Cobrado | null>(null)
  // Cada incremento dispara una impresión (después de que los tickets se renderizan).
  const [ordenImpresion, setOrdenImpresion] = useState(0)

  useEffect(() => {
    let paginaActiva = true

    async function cargarProductos() {
      try {
        const respuesta = await fetch('/api/productos/caja', { cache: 'no-store' })
        if (!respuesta.headers.get('content-type')?.includes('application/json')) {
          throw new Error('El servidor devolvió una respuesta inesperada.')
        }
        const datos = await respuesta.json() as RespuestaProductosCaja
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los productos.')
        if (paginaActiva) {
          setProductos(datos.productos ?? [])
          setZonas(datos.localidadesDelivery ?? [])
        }
      } catch (errorDesconocido) {
        if (paginaActiva) {
          setErrorProductos(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : 'No se pudieron cargar los productos.',
          )
        }
      } finally {
        if (paginaActiva) setCargandoProductos(false)
      }
    }

    void cargarProductos()
    return () => {
      paginaActiva = false
    }
  }, [])

  useEffect(() => {
    if (ordenImpresion > 0) window.print()
  }, [ordenImpresion])

  const categorias = useMemo(
    () => [TODAS, ...new Set(productos.map((producto) => producto.categoria))],
    [productos],
  )

  const productosVisibles = productos.filter(
    (producto) =>
      (categoria === TODAS || producto.categoria === categoria) &&
      producto.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
  )

  const cantidadItems = carrito.reduce((suma, linea) => suma + linea.cantidad, 0)
  // Estimado con los precios en pantalla: el total real lo calcula el servidor al crear el pedido.
  const total = carrito.reduce((suma, linea) => suma + precioUnitario(linea) * linea.cantidad, 0)
  const faltaCliente = cliente.trim() === ''
  const erroresEntrega = tipoEntrega === 'delivery' ? erroresDatosDelivery(entrega, zonas.length > 0) : {}
  const entregaValida = Object.keys(erroresEntrega).length === 0
  const puedeCobrar = carrito.length > 0 && !faltaCliente && entregaValida
  // Por qué no se puede cobrar todavía (se muestra debajo del botón).
  const pistaCobro = carrito.length === 0
    ? ''
    : faltaCliente
      ? 'Cargá el nombre del cliente para cobrar.'
      : !entregaValida
        ? 'Completá los datos del delivery para cobrar.'
        : ''

  function agregar(combinacion: Combinacion, cantidad = 1) {
    const clave = claveDe(combinacion)
    setUltimoCobrado(null)
    setAvisoCarrito(null)
    setCarrito((actual) =>
      actual.some((linea) => linea.clave === clave)
        ? actual.map((linea) =>
            linea.clave === clave
              ? { ...linea, cantidad: Math.min(MAX_CANTIDAD_ITEM, linea.cantidad + cantidad) }
              : linea,
          )
        : [...actual, { ...combinacion, clave, cantidad }],
    )
  }

  // Sin nada para elegir se suma directo; con variaciones o extras se abre la ventana.
  function elegir(producto: ProductoCaja) {
    if (abreVentana(producto)) setEligiendo(producto)
    else agregar({ producto, variacion: null, extras: [] })
  }

  // Si queda en 0 no se borra directo: se pide confirmación.
  function restar({ clave, cantidad }: LineaCarrito) {
    if (cantidad <= 1) {
      setConfirmandoQuitar(clave)
      return
    }
    setCarrito((actual) =>
      actual.map((linea) => (linea.clave === clave ? { ...linea, cantidad: linea.cantidad - 1 } : linea)),
    )
  }

  function confirmarQuitar(clave: string) {
    setCarrito((actual) => actual.filter((linea) => linea.clave !== clave))
    setConfirmandoQuitar(null)
  }

  function empezarCobro() {
    if (!puedeCobrar) return
    setConfirmandoQuitar(null)
    setMetodoPago('efectivo')
    setPagaCon('')
    setErrorCobro(null)
    setCobrando(true)
  }

  async function confirmarPago() {
    if (enviando) return
    const datos = {
      cliente,
      tipoEntrega,
      metodoPago,
      aclaracion,
      items: carrito.map((linea) => ({
        idProducto: linea.producto.idProducto,
        cantidad: linea.cantidad,
        ...(linea.variacion ? { idVariacion: linea.variacion.idVariacion } : {}),
        ...(linea.extras.length > 0 ? { extras: linea.extras.map((extra) => extra.idExtra) } : {}),
      })),
      ...(tipoEntrega === 'delivery'
        ? {
            telefono: entrega.telefono,
            direccion: entrega.direccion,
            idLocalidad: entrega.idLocalidad ? Number(entrega.idLocalidad) : null,
            referencias: entrega.referencias,
          }
        : {}),
    }
    // Última revisión con el mismo validador que la API (topes de ítems, etc.).
    try {
      validarPedidoCaja(cuerpoPedidoCaja(datos))
    } catch (error) {
      setErrorCobro(error instanceof ErrorPedido ? error.message : 'Revisá los datos del pedido.')
      return
    }

    setEnviando(true)
    setErrorCobro(null)
    const resultado = await crearPedidoMostrador(datos)
    setEnviando(false)

    if (!resultado.ok) {
      const noDisponibles = resultado.datos.productosNoDisponibles
      if (resultado.estado === 409 && Array.isArray(noDisponibles)) {
        // Se sacan del carrito y se vuelve a armar el pedido: el total cambió.
        setCarrito((actual) => actual.filter((linea) => !noDisponibles.includes(linea.producto.idProducto)))
        setProductos((actuales) => actuales.map((producto) => (
          noDisponibles.includes(producto.idProducto) ? { ...producto, disponible: false } : producto
        )))
        setCobrando(false)
        setAvisoCarrito(MENSAJE_PRODUCTOS_NO_DISPONIBLES)
        return
      }
      setErrorCobro(resultado.error)
      return
    }

    setUltimoCobrado({ pedido: resultado.pedido, pagaCon: metodoPago === 'efectivo' ? Number(pagaCon) : null })
    setOrdenImpresion((n) => n + 1)
    setCobrando(false)
    setCarrito([])
    setCliente('')
    setAclaracion('')
    setTipoEntrega('retiro')
    setEntrega(VALORES_DELIVERY_VACIOS)
  }

  return (
    <>
      <main className="grid min-h-screen gap-6 bg-bg p-6 print:hidden lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="flex flex-col gap-5">
          <header className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">Caja</h1>
              <PastillaSucursal />
            </div>
            <Campanita />
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {categorias.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setCategoria(nombre)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${categoria === nombre ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                >
                  {nombre}
                </button>
              ))}
            </div>
            <label className="flex w-full items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm sm:w-64">
              <Search className="size-4 text-muted" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto"
                aria-label="Buscar producto"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </label>
          </div>

          {errorProductos ? (
            <p role="alert" className="rounded-3xl bg-surface p-10 text-center text-danger">
              {errorProductos}
            </p>
          ) : cargandoProductos ? (
            <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando productos...</p>
          ) : productosVisibles.length === 0 ? (
            <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay productos para mostrar.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
              {productosVisibles.map((producto) => (
                <TarjetaProducto
                  key={producto.idProducto}
                  producto={producto}
                  bloqueado={cobrando}
                  onElegir={() => elegir(producto)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-5 rounded-3xl bg-surface p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          {/* El número lo asigna la base al registrar el pedido: se ve en la confirmación. */}
          <h2 className="text-lg">
            <strong className="font-bold">Nuevo pedido</strong>
            {cobrando && <span className="text-muted"> · {cliente.trim()}</span>}
          </h2>

          {cobrando ? (
            <PanelCobro
              total={total}
              metodoPago={metodoPago}
              pagaCon={pagaCon}
              enviando={enviando}
              error={errorCobro}
              onCambiarMetodo={setMetodoPago}
              onCambiarPagaCon={setPagaCon}
              onVolver={() => setCobrando(false)}
              onConfirmar={() => void confirmarPago()}
            />
          ) : (
            <>
              <div className="-mx-1 flex max-h-[45vh] shrink-0 flex-col gap-3 overflow-y-auto px-1 pb-1">
                <input
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                  aria-label="Nombre del cliente"
                  maxLength={MAX_NOMBRE_CLIENTE}
                  className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <div className="grid grid-cols-2 gap-1 rounded-full bg-bg p-1 text-sm">
                  {([
                    { valor: 'retiro', texto: 'Para retirar', icono: ShoppingBag },
                    { valor: 'delivery', texto: 'Delivery', icono: Bike },
                  ] as const).map(({ valor, texto, icono: Icono }) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTipoEntrega(valor)}
                      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full py-2 transition-colors ${tipoEntrega === valor ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                    >
                      <Icono className="size-4" />
                      {texto}
                    </button>
                  ))}
                </div>
                {tipoEntrega === 'delivery' && (
                  <CamposDelivery
                    id="caja-delivery"
                    valores={entrega}
                    errores={erroresEntrega}
                    zonas={zonas}
                    onCambiar={(campo, valor) => setEntrega((previos) => ({ ...previos, [campo]: valor }))}
                  />
                )}
              </div>

              {avisoCarrito && (
                <p role="alert" className="rounded-2xl bg-warning-surface p-3 text-sm">{avisoCarrito}</p>
              )}

              <ul className="-mx-1 flex flex-1 flex-col gap-3 overflow-y-auto px-1">
                {carrito.length === 0 &&
                  (ultimoCobrado ? (
                    <li className="flex flex-col items-center gap-3 rounded-2xl bg-bg p-6 text-center text-sm">
                      <CircleCheck className="size-8 text-success" />
                      <p>
                        Pedido <strong>#{ultimoCobrado.pedido.idPedido}</strong> cobrado y enviado a cocina.
                      </p>
                      {ultimoCobrado.pedido.tipoEntrega === 'delivery' && (
                        <DatosEntrega pedido={ultimoCobrado.pedido} />
                      )}
                      <button
                        type="button"
                        onClick={() => setOrdenImpresion((n) => n + 1)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 hover:bg-surface"
                      >
                        <Printer className="size-4" />
                        Reimprimir tickets
                      </button>
                    </li>
                  ) : (
                    <li className="rounded-2xl bg-bg p-6 text-center text-sm text-muted">
                      Tocá un producto para agregarlo.
                    </li>
                  ))}
                {carrito.map((linea) => (
                  <LineaCarritoItem
                    key={linea.clave}
                    linea={linea}
                    confirmando={confirmandoQuitar === linea.clave}
                    onSumar={() => agregar(linea)}
                    onRestar={() => restar(linea)}
                    onPedirQuitar={() => setConfirmandoQuitar(linea.clave)}
                    onCancelarQuitar={() => setConfirmandoQuitar(null)}
                    onConfirmarQuitar={() => confirmarQuitar(linea.clave)}
                  />
                ))}
              </ul>

              {carrito.length > 0 && (
                <textarea
                  value={aclaracion}
                  onChange={(e) => setAclaracion(e.target.value)}
                  maxLength={MAX_ACLARACION}
                  rows={2}
                  placeholder="Aclaración para la cocina (opcional). Ej: una sin cebolla"
                  aria-label="Aclaración para la cocina"
                  className="shrink-0 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
                />
              )}

              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm">Total</p>
                    <p className="text-xs text-muted">
                      {cantidadItems} {cantidadItems === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>
                  <p className="text-3xl font-bold">{formatoPrecio.format(total)}</p>
                </div>
                <button
                  type="button"
                  onClick={empezarCobro}
                  disabled={!puedeCobrar}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
                >
                  <Banknote className="size-5" />
                  Cobrar
                </button>
                {pistaCobro && <p className="-mt-2 text-center text-xs text-muted">{pistaCobro}</p>}
              </div>
            </>
          )}
        </aside>
      </main>

      {eligiendo && (
        <ModalProductoCaja
          key={eligiendo.idProducto}
          producto={eligiendo}
          onAgregar={(combinaciones) => combinaciones.forEach(({ cantidad, ...combinacion }) => agregar(combinacion, cantidad))}
          onCerrar={() => setEligiendo(null)}
        />
      )}

      {ultimoCobrado && <TicketsPedido pedido={ultimoCobrado.pedido} pagaCon={ultimoCobrado.pagaCon} />}
    </>
  )
}
