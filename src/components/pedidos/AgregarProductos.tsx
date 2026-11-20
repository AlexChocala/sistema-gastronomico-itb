'use client'

// Agregar productos a un pedido online que todavía no empezó a prepararse (lo pide el cliente
// por WhatsApp). Se eligen los productos como en Caja, se pone el PIN de quien lo registra y
// el servidor suma las líneas nuevas y recalcula el total. Si el pedido ya salió de ese
// estado, el servidor lo rechaza y se avisa.

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2, X } from '@/components/icons'
import { CampoPinCaja, claseBotonCaja } from '@/components/caja/CamposCaja'
import { MAX_CANTIDAD_ITEM, MAX_EXTRAS_ITEM, MAX_ITEMS_PEDIDO } from '@/lib/pedidos/pedidos-validacion'
import type { ItemAgregado, PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { formatearPrecio } from '@/lib/utils/precio'

type Opcion = { nombre: string; precioAdicional: number }
type Variacion = Opcion & { idVariacion: number }
type Extra = Opcion & { idExtra: number }
type Producto = {
  idProducto: number; nombre: string; categoria: string; precio: number
  variaciones: Variacion[]; extras: Extra[]; disponible: boolean
}
type Linea = { clave: string; producto: Producto; variacion: Variacion | null; extras: Extra[]; cantidad: number }

const claveDe = (producto: Producto, variacion: Variacion | null, extras: Extra[]) =>
  `${producto.idProducto}:${variacion?.idVariacion ?? 0}:${extras.map((e) => e.idExtra).sort((a, b) => a - b).join(',')}`
const precioDe = (l: Pick<Linea, 'producto' | 'variacion' | 'extras'>) =>
  l.producto.precio + (l.variacion?.precioAdicional ?? 0) + l.extras.reduce((suma, e) => suma + e.precioAdicional, 0)

export function AgregarProductos({
  pedido, onConfirmar, onCerrar,
}: {
  pedido: PedidoPantalla
  onConfirmar: (items: ItemAgregado[], pin: string) => Promise<string | null>
  onCerrar: () => void
}) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  // Producto con opciones que se está eligiendo.
  const [eligiendo, setEligiendo] = useState<Producto | null>(null)
  const [idVariacion, setIdVariacion] = useState<number | null>(null)
  const [idExtras, setIdExtras] = useState<number[]>([])
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    fetch('/api/productos/caja', { cache: 'no-store' })
      .then(async (respuesta) => {
        const datos = await respuesta.json()
        if (!respuesta.ok) throw new Error(datos?.error ?? 'No se pudieron cargar los productos.')
        if (activo) setProductos(datos.productos ?? [])
      })
      .catch((e) => activo && setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos.'))
      .finally(() => activo && setCargando(false))
    return () => { activo = false }
  }, [])

  const visibles = useMemo(
    () => productos.filter((p) => p.disponible && p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())),
    [productos, busqueda],
  )
  const totalNuevo = lineas.reduce((suma, l) => suma + precioDe(l) * l.cantidad, 0)

  function sumar(producto: Producto, variacion: Variacion | null, extras: Extra[]) {
    const clave = claveDe(producto, variacion, extras)
    setError('')
    setLineas((actuales) => actuales.some((l) => l.clave === clave)
      ? actuales.map((l) => (l.clave === clave ? { ...l, cantidad: Math.min(MAX_CANTIDAD_ITEM, l.cantidad + 1) } : l))
      : [...actuales, { clave, producto, variacion, extras, cantidad: 1 }])
  }

  function elegir(producto: Producto) {
    if (producto.variaciones.length === 0 && producto.extras.length === 0) return sumar(producto, null, [])
    setEligiendo(producto)
    setIdVariacion(producto.variaciones[0]?.idVariacion ?? null)
    setIdExtras([])
  }

  function confirmarEleccion() {
    if (!eligiendo) return
    const variacion = eligiendo.variaciones.find((v) => v.idVariacion === idVariacion) ?? null
    sumar(eligiendo, variacion, eligiendo.extras.filter((e) => idExtras.includes(e.idExtra)))
    setEligiendo(null)
  }

  function cambiarCantidad(clave: string, delta: number) {
    setLineas((actuales) => actuales
      .map((l) => (l.clave === clave ? { ...l, cantidad: Math.min(MAX_CANTIDAD_ITEM, l.cantidad + delta) } : l))
      .filter((l) => l.cantidad > 0))
  }

  async function confirmar() {
    if (lineas.length === 0) return setError('Elegí al menos un producto.')
    if (lineas.length + pedido.items.length > MAX_ITEMS_PEDIDO) return setError('El pedido tiene demasiados productos.')
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene que tener 4 números.')
    setEnviando(true)
    setError('')
    const resultado = await onConfirmar(
      lineas.map((l) => ({
        idProducto: l.producto.idProducto, cantidad: l.cantidad,
        ...(l.variacion ? { idVariacion: l.variacion.idVariacion } : {}),
        ...(l.extras.length > 0 ? { extras: l.extras.map((e) => e.idExtra) } : {}),
      })),
      pin,
    )
    setEnviando(false)
    if (resultado === null) return onCerrar()
    setError(resultado)
    setPin('')
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-overlay p-4 print:hidden">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-agregar" className="m-auto flex w-full max-w-lg flex-col gap-5 rounded-3xl bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-agregar" className="text-lg font-semibold">Agregar al pedido #{pedido.idPedido}</h2>
            <p className="text-sm text-muted">{pedido.cliente}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer rounded-full p-2 text-muted hover:bg-bg hover:text-text">
            <X className="size-4" />
          </button>
        </div>

        {eligiendo ? (
          <div className="flex flex-col gap-4 rounded-2xl bg-bg p-4">
            <p className="font-medium">{eligiendo.nombre}</p>
            {eligiendo.variaciones.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Variación</legend>
                {eligiendo.variaciones.map((v) => (
                  <label key={v.idVariacion} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <input type="radio" name="variacion" checked={idVariacion === v.idVariacion} onChange={() => setIdVariacion(v.idVariacion)} />
                      {v.nombre}
                    </span>
                    <span className="text-muted">{formatearPrecio(eligiendo.precio + v.precioAdicional)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {eligiendo.extras.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm text-muted">Extras</legend>
                {eligiendo.extras.map((e) => {
                  const marcado = idExtras.includes(e.idExtra)
                  return (
                    <label key={e.idExtra} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox" checked={marcado}
                          disabled={!marcado && idExtras.length >= MAX_EXTRAS_ITEM}
                          onChange={() => setIdExtras((actuales) => (marcado ? actuales.filter((id) => id !== e.idExtra) : [...actuales, e.idExtra]))}
                        />
                        {e.nombre}
                      </span>
                      <span className="text-muted">+ {formatearPrecio(e.precioAdicional)}</span>
                    </label>
                  )
                })}
              </fieldset>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button type="button" onClick={() => setEligiendo(null)} className="cursor-pointer rounded-full border border-border py-2 hover:bg-surface">Volver</button>
              <button type="button" onClick={confirmarEleccion} className="cursor-pointer rounded-full bg-brand py-2 text-on-brand hover:bg-brand-hover">Sumar</button>
            </div>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-full bg-bg px-4 py-2">
              <Search className="size-4 text-muted" />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
            </label>
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {cargando && <li className="p-3 text-center text-sm text-muted">Cargando…</li>}
              {visibles.map((p) => (
                <li key={p.idProducto}>
                  <button type="button" onClick={() => elegir(p)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm hover:bg-bg">
                    <span className="min-w-0 truncate">{p.nombre}</span>
                    <span className="flex shrink-0 items-center gap-2 text-muted">
                      {formatearPrecio(p.precio)}
                      <Plus className="size-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {lineas.length > 0 && (
          <ul className="flex flex-col gap-2 border-t border-border pt-4">
            {lineas.map((l) => (
              <li key={l.clave} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  {l.producto.nombre}
                  <span className="block text-xs text-muted">
                    {[l.variacion?.nombre, ...l.extras.map((e) => `+ ${e.nombre}`)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => cambiarCantidad(l.clave, -1)} aria-label="Restar" className="cursor-pointer rounded-full p-1.5 hover:bg-bg">
                    {l.cantidad === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                  </button>
                  <span className="w-5 text-center">{l.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(l.clave, 1)} aria-label="Sumar" className="cursor-pointer rounded-full p-1.5 hover:bg-bg">
                    <Plus className="size-4" />
                  </button>
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-sm text-muted">Se suman</span>
              <span className="text-lg font-bold">{formatearPrecio(totalNuevo)}</span>
            </li>
          </ul>
        )}

        <CampoPinCaja id="agregar-pin" valor={pin} onCambiar={setPin} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="button" onClick={() => void confirmar()} disabled={enviando || lineas.length === 0} className={claseBotonCaja}>
          {enviando ? 'Guardando…' : 'Agregar al pedido'}
        </button>
      </div>
    </div>
  )
}
