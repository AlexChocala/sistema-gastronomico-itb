// Barra fija abajo con el resumen del carrito y el link para verlo. No se muestra con el
// carrito vacío. Presentacional.

import Link from 'next/link'
import { ChevronRight, ShoppingCart } from '@/components/icons'
import { formatearPrecio } from '@/lib/utils/precio'

export function textoProductos(cantidad: number) {
  return `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`
}

export function BarraCarrito({ slug, cantidadTotal, total, aviso, bloqueada = false }: {
  slug: string
  cantidadTotal: number
  total: number
  aviso?: string | null
  // El local no toma pedidos ahora: la barra se ve apagada y no lleva al carrito.
  bloqueada?: boolean
}) {
  if (cantidadTotal === 0) return null
  return (
    // El degradado deja ver el contenido que pasa por detrás; solo la barra recibe clics.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-bg via-bg/90 to-transparent pt-6">
      <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {aviso && (
          <p role="alert" className="rounded-xl bg-text px-4 py-2 text-center text-sm text-surface shadow-md">
            {aviso}
          </p>
        )}
        {bloqueada && (
          <div aria-disabled="true" className="flex min-h-14 cursor-not-allowed items-center gap-3 rounded-2xl bg-surface-muted px-4 text-muted shadow-lg">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-surface">
              <ShoppingCart className="size-5" aria-hidden="true" />
            </span>
            <span className="flex-1 font-semibold">Pedidos pausados por ahora</span>
            <span className="font-semibold tabular-nums">{formatearPrecio(total)}</span>
          </div>
        )}
        {!bloqueada && <Link
          href={`/${slug}/carrito`}
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-brand px-4 text-on-brand shadow-lg transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-on-brand/20">
            <ShoppingCart className="size-5" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-on-brand px-1 text-xs font-bold text-accent tabular-nums"
            >
              {cantidadTotal}
            </span>
          </span>
          <span className="flex-1 font-semibold">
            Ver carrito
            <span className="sr-only"> · {textoProductos(cantidadTotal)} ·</span>
          </span>
          <span className="font-semibold tabular-nums">{formatearPrecio(total)}</span>
          <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
        </Link>}
      </div>
    </div>
  )
}
