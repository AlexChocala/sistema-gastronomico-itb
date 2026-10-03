'use client'

// Carrito de una sucursal: una fila por combinación (producto + tamaño + extras) con su
// cantidad y subtotal, y el total. El tacho saca la línea al instante y muestra
// "Deshacer" unos segundos (en lugar de pedir confirmación). Recibe del servidor los
// productos vigentes del menú para sacar los que ya no se ofrecen (y avisarlo) y
// actualizar precios.

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, ShoppingCart, Trash2 } from '@/components/icons'
import { estilosBoton } from '@/components/ui/Button'
import { detalleLinea, nombreLinea, useCarrito, useHidratado, type ItemCarrito, type ProductoCarrito } from '@/lib/pedidos/carrito'
import { MAX_ACLARACION } from '@/lib/pedidos/pedidos-validacion'
import { formatearPrecio } from '@/lib/utils/precio'
import { AvisoDeshacer } from '@/components/carta/compartidos/AvisoDeshacer'
import { AvisoQuitados } from '@/components/carta/compartidos/AvisoQuitados'
import { textoProductos } from '@/components/carta/compartidos/BarraCarrito'
import { SelectorCantidad } from '@/components/carta/compartidos/SelectorCantidad'

// La última línea quitada, para "Deshacer". `id` cambia con cada quitado para reiniciar
// el aviso (y su tiempo).
type Quitada = { id: number; linea: ItemCarrito; indice: number }

export function CarritoSucursal({ slug, productos }: { slug: string; productos: ProductoCarrito[] }) {
  const carrito = useCarrito(slug)
  const { reconciliar } = carrito
  const hidratado = useHidratado()
  const [quitada, setQuitada] = useState<Quitada | null>(null)

  useEffect(() => {
    reconciliar(productos)
  }, [reconciliar, productos])

  function quitar(item: ItemCarrito) {
    const resultado = carrito.quitar(item.clave)
    if (resultado) setQuitada((previa) => ({ id: (previa?.id ?? 0) + 1, ...resultado }))
  }

  function deshacer() {
    if (!quitada) return
    carrito.restaurar(quitada.linea, quitada.indice)
    setQuitada(null)
    // El aviso desaparece: el foco vuelve al tacho de la línea restaurada.
    const clave = CSS.escape(quitada.linea.clave)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-quitar="${clave}"]`)?.focus())
  }

  const cerrarAviso = useCallback(() => setQuitada(null), [])

  const aviso = <AvisoQuitados nombres={carrito.productosQuitados} onCerrar={carrito.descartarAviso} />
  const avisoDeshacer = quitada && (
    <AvisoDeshacer key={quitada.id} nombre={nombreLinea(quitada.linea)} onDeshacer={deshacer} onCerrar={cerrarAviso} />
  )

  // Antes de hidratar el carrito siempre parece vacío: se muestra un esqueleto.
  if (!hidratado) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Cargando tu carrito…</span>
        {[0, 1].map((indice) => (
          <div key={indice} className="h-24 animate-pulse rounded-3xl bg-surface motion-reduce:animate-none" />
        ))}
      </div>
    )
  }

  if (carrito.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {aviso}
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-10 text-center shadow-sm">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShoppingCart className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">Tu carrito está vacío</h2>
          <p className="max-w-xs text-sm font-normal text-muted">Mirá el menú y sumá lo que tengas ganas de comer.</p>
          <Link href={`/${slug}`} className={`${estilosBoton({ variant: 'acento', tamano: 'grande' })} mt-2 max-w-xs`}>
            Ver el menú
          </Link>
        </div>
        {/* Si se acaba de quitar la última línea, "Deshacer" sigue a mano. */}
        {avisoDeshacer && (
          <div className="fixed inset-x-0 bottom-0 z-30">
            <div className="mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{avisoDeshacer}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-36">
      {aviso}

      <ul className="divide-y divide-border/60 rounded-3xl bg-surface px-4 shadow-sm" aria-label="Productos en tu carrito">
        {carrito.items.map((item) => {
          const detalle = detalleLinea(item)
          return (
            <li key={item.clave} className="flex gap-3 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 className="leading-snug font-semibold">{item.nombre}</h2>
                {detalle && <p className="text-sm font-normal break-words text-muted">{detalle}</p>}
                <p className="text-sm font-normal text-muted tabular-nums">{formatearPrecio(item.precioUnitario)} c/u</p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                <p className="font-semibold tabular-nums">
                  <span className="sr-only">Subtotal: </span>
                  {formatearPrecio(item.precioUnitario * item.cantidad)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => quitar(item)}
                    data-quitar={item.clave}
                    aria-label={`Quitar ${nombreLinea(item)} del carrito`}
                    className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-danger focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                  </button>
                  <SelectorCantidad
                    nombre={nombreLinea(item)}
                    cantidad={item.cantidad}
                    onSumar={() => carrito.cambiarCantidad(item.clave, item.cantidad + 1)}
                    onRestar={() => carrito.cambiarCantidad(item.clave, item.cantidad - 1)}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Una sola aclaración para todo el pedido: se escribe viendo todo lo que se pidió. */}
      <div className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-sm">
        <label htmlFor="aclaracion-pedido" className="font-semibold">
          ¿Alguna aclaración para la cocina? <span className="text-sm font-normal text-muted">(opcional)</span>
        </label>
        <textarea
          id="aclaracion-pedido"
          rows={2}
          maxLength={MAX_ACLARACION}
          value={carrito.aclaracion}
          onChange={(evento) => carrito.cambiarAclaracion(evento.target.value)}
          placeholder="Ej: una sin cebolla, la pizza bien cocida"
          aria-describedby="aclaracion-pedido-largo"
          className="w-full resize-none rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-normal outline-none transition-colors placeholder:text-muted focus:border-accent"
        />
        <p id="aclaracion-pedido-largo" className="self-end text-xs font-normal text-muted tabular-nums">
          {carrito.aclaracion.length}/{MAX_ACLARACION}
        </p>
      </div>

      <Link
        href={`/${slug}`}
        className="self-center rounded-full px-4 py-3 text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Seguir agregando productos
      </Link>

      {/* Total y "Continuar" siempre a mano, fijos abajo (con "Deshacer" encima si hace falta). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-bg via-bg/95 to-transparent pt-6">
        <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {avisoDeshacer}
          <div className="flex items-baseline justify-between rounded-2xl bg-surface px-4 py-3 shadow-sm">
            <span className="text-sm text-muted">Total · {textoProductos(carrito.cantidadTotal)}</span>
            <span className="text-xl font-semibold tabular-nums">{formatearPrecio(carrito.total)}</span>
          </div>
          <Link href={`/${slug}/checkout`} className={`${estilosBoton({ variant: 'acento', tamano: 'grande' })} shadow-lg`}>
            Continuar
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
