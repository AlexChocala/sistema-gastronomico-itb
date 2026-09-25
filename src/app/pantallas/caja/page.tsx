'use client'

// Pantalla de Caja (pestaña aparte, sin sidebar). Flujo de mostrador:
//   1. Armar el pedido (productos, cliente, tipo de entrega) → "Cobrar".
//   2. Elegir método de pago (efectivo calcula el vuelto) → "Confirmar pago".
//   3. El pedido entra PAGADO a Cocina como "recibido" y se imprimen comanda + ticket.

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Banknote, Bike, CircleCheck, Landmark, Minus, Plus, Printer, Search, ShoppingBag, Trash2,
} from '@/components/icons'
import { IconoCategoria } from '@/components/icons/IconoCategoria'
import { TicketsPedido } from '@/components/pantallas/TicketsPedido'
import {
  usePedidosPantalla,
  type MetodoPagoPantalla,
  type PedidoPantalla,
  type TipoEntregaPantalla,
} from '@/lib/pedidos-pantallas'
import { useProductosCaja, type ProductoCaja } from '@/lib/productos-caja'

const TODAS = 'Todos'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

type LineaCarrito = { producto: ProductoCaja; cantidad: number }

function TarjetaProducto({
  producto,
  bloqueado,
  onAgregar,
}: {
  producto: ProductoCaja
  bloqueado: boolean
  onAgregar: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAgregar}
      disabled={!producto.disponible || bloqueado}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl bg-surface p-4 text-center shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm"
    >
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${producto.disponible ? 'text-success' : 'text-danger'}`}
      >
        <span className={`size-1.5 rounded-full ${producto.disponible ? 'bg-success' : 'bg-danger'}`} />
        {producto.disponible ? 'Disponible' : 'Sin stock'}
      </span>
      <span className="flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
        <IconoCategoria categoria={producto.categoria} className="size-9" strokeWidth={1.5} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="leading-tight">{producto.nombre}</span>
        <span className="text-xs text-muted">{producto.categoria}</span>
      </span>
      <span className="mt-auto text-lg font-bold">{formatoPrecio.format(producto.precio)}</span>
    </button>
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
  const { producto, cantidad } = linea

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="leading-tight">{producto.nombre}</span>
        <span className="shrink-0 font-semibold">{formatoPrecio.format(producto.precio * cantidad)}</span>
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
  onCambiarMetodo,
  onCambiarPagaCon,
  onVolver,
  onConfirmar,
}: {
  total: number
  metodoPago: MetodoPagoPantalla
  pagaCon: string
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

      <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-5 py-3.5 hover:bg-bg"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={!pagoValido}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        >
          <CircleCheck className="size-5" />
          Confirmar pago
        </button>
      </div>
      <p className="-mt-3 text-center text-xs text-muted">Se envía a cocina y se imprimen los tickets.</p>
    </div>
  )
}

type Cobrado = { pedido: PedidoPantalla; pagaCon: number | null }

export default function CajaPage() {
  const { productos } = useProductosCaja()
  const { pedidos, crearPedidoMostrador } = usePedidosPantalla()

  const [categoria, setCategoria] = useState(TODAS)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [cliente, setCliente] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntregaPantalla>('retiro')
  // Producto que espera confirmación antes de salir del carrito.
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<number | null>(null)

  const [cobrando, setCobrando] = useState(false)
  const [metodoPago, setMetodoPago] = useState<MetodoPagoPantalla>('efectivo')
  const [pagaCon, setPagaCon] = useState('')
  // Último pedido cobrado: sus tickets quedan listos para reimprimir.
  const [ultimoCobrado, setUltimoCobrado] = useState<Cobrado | null>(null)
  // Cada incremento dispara una impresión (después de que los tickets se renderizan).
  const [ordenImpresion, setOrdenImpresion] = useState(0)

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

  // Número estimado del próximo pedido (con backend lo asigna la base).
  const proximoNumero = Math.max(0, ...pedidos.map((pedido) => pedido.idPedido)) + 1
  const cantidadItems = carrito.reduce((suma, linea) => suma + linea.cantidad, 0)
  const total = carrito.reduce((suma, linea) => suma + linea.producto.precio * linea.cantidad, 0)
  const faltaCliente = cliente.trim() === ''
  const puedeCobrar = carrito.length > 0 && !faltaCliente

  function agregar(producto: ProductoCaja) {
    setUltimoCobrado(null)
    setCarrito((actual) =>
      actual.some((linea) => linea.producto.idProducto === producto.idProducto)
        ? actual.map((linea) =>
            linea.producto.idProducto === producto.idProducto
              ? { ...linea, cantidad: linea.cantidad + 1 }
              : linea,
          )
        : [...actual, { producto, cantidad: 1 }],
    )
  }

  // Si queda en 0 no se borra directo: se pide confirmación.
  function restar({ producto, cantidad }: LineaCarrito) {
    if (cantidad <= 1) {
      setConfirmandoQuitar(producto.idProducto)
      return
    }
    setCarrito((actual) =>
      actual.map((linea) =>
        linea.producto.idProducto === producto.idProducto
          ? { ...linea, cantidad: linea.cantidad - 1 }
          : linea,
      ),
    )
  }

  function confirmarQuitar(idProducto: number) {
    setCarrito((actual) => actual.filter((linea) => linea.producto.idProducto !== idProducto))
    setConfirmandoQuitar(null)
  }

  function empezarCobro() {
    if (!puedeCobrar) return
    setConfirmandoQuitar(null)
    setMetodoPago('efectivo')
    setPagaCon('')
    setCobrando(true)
  }

  function confirmarPago() {
    const pedido = crearPedidoMostrador({
      cliente: cliente.trim(),
      tipoEntrega,
      metodoPago,
      items: carrito.map((linea) => ({
        cantidad: linea.cantidad,
        producto: linea.producto.nombre,
        precioUnitario: linea.producto.precio,
      })),
    })
    setUltimoCobrado({ pedido, pagaCon: metodoPago === 'efectivo' ? Number(pagaCon) : null })
    setOrdenImpresion((n) => n + 1)
    setCobrando(false)
    setCarrito([])
    setCliente('')
    setTipoEntrega('retiro')
  }

  return (
    <>
      <main className="grid min-h-screen gap-6 bg-bg p-6 print:hidden lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="flex flex-col gap-5">
          <header>
            <h1 className="page-title">Caja</h1>
            <p className="mt-1 text-sm text-muted">Armá el pedido, cobralo y se envía a cocina.</p>
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

          {productosVisibles.length === 0 ? (
            <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay productos para mostrar.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
              {productosVisibles.map((producto) => (
                <TarjetaProducto
                  key={producto.idProducto}
                  producto={producto}
                  bloqueado={cobrando}
                  onAgregar={() => agregar(producto)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-5 rounded-3xl bg-surface p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <h2 className="text-lg">
            Pedido <strong className="font-bold">#{proximoNumero}</strong>
            {cobrando && <span className="text-muted"> · {cliente.trim()}</span>}
          </h2>

          {cobrando ? (
            <PanelCobro
              total={total}
              metodoPago={metodoPago}
              pagaCon={pagaCon}
              onCambiarMetodo={setMetodoPago}
              onCambiarPagaCon={setPagaCon}
              onVolver={() => setCobrando(false)}
              onConfirmar={confirmarPago}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <input
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                  aria-label="Nombre del cliente"
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
              </div>

              <ul className="-mx-1 flex flex-1 flex-col gap-3 overflow-y-auto px-1">
                {carrito.length === 0 &&
                  (ultimoCobrado ? (
                    <li className="flex flex-col items-center gap-3 rounded-2xl bg-bg p-6 text-center text-sm">
                      <CircleCheck className="size-8 text-success" />
                      <p>
                        Pedido <strong>#{ultimoCobrado.pedido.idPedido}</strong> cobrado y enviado a cocina.
                      </p>
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
                    key={linea.producto.idProducto}
                    linea={linea}
                    confirmando={confirmandoQuitar === linea.producto.idProducto}
                    onSumar={() => agregar(linea.producto)}
                    onRestar={() => restar(linea)}
                    onPedirQuitar={() => setConfirmandoQuitar(linea.producto.idProducto)}
                    onCancelarQuitar={() => setConfirmandoQuitar(null)}
                    onConfirmarQuitar={() => confirmarQuitar(linea.producto.idProducto)}
                  />
                ))}
              </ul>

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
                {carrito.length > 0 && faltaCliente && (
                  <p className="-mt-2 text-center text-xs text-muted">Cargá el nombre del cliente para cobrar.</p>
                )}
              </div>
            </>
          )}
        </aside>
      </main>

      {ultimoCobrado && <TicketsPedido pedido={ultimoCobrado.pedido} pagaCon={ultimoCobrado.pagaCon} />}
    </>
  )
}
