// Piezas de identidad del negocio para las páginas públicas (selector de sucursal y menú):
// avatar (logo o iniciales), links a redes y chips de formas de entrega. Presentacionales.

import Image from 'next/image'
import type { ComponentType, SVGProps } from 'react'
import { Bike, IconoFacebook, IconoInstagram, IconoTikTok, ShoppingBag } from '@/components/icons'
import type { NegocioPublico } from '@/lib/negocio/negocio'

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => palabra[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const tamanos = {
  grande: { clase: 'size-24 text-3xl ring-8', px: 96 },
  chico: { clase: 'size-14 text-xl ring-4', px: 56 },
}

export function AvatarNegocio({ nombre, logoUrl, tamano = 'grande' }: {
  nombre: string
  logoUrl: string | null
  tamano?: keyof typeof tamanos
}) {
  const { clase, px } = tamanos[tamano]
  if (logoUrl) {
    // unoptimized: el logo viene del bucket y no pasa por el optimizador de Next.
    return (
      <Image
        src={logoUrl}
        alt={`Logo de ${nombre}`}
        width={px}
        height={px}
        unoptimized
        className={`${clase} shrink-0 rounded-full bg-surface object-cover shadow-sm ring-accent-soft`}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`${clase} flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-on-accent shadow-sm ring-accent-soft`}
    >
      {iniciales(nombre)}
    </div>
  )
}

type Red = { nombre: string; href: string; Icono: ComponentType<SVGProps<SVGSVGElement>> }

// Solo las redes que el negocio cargó. Si no hay ninguna, no se muestra nada.
export function RedesNegocio({ negocio, fondo = 'bg-surface shadow-sm' }: {
  negocio: Pick<NegocioPublico, 'nombre' | 'instagram' | 'tiktok' | 'facebook'>
  // Fondo de cada botón: sobre una superficie blanca conviene un fondo gris, sin sombra.
  fondo?: string
}) {
  const redes: Red[] = [
    { nombre: 'Instagram', href: negocio.instagram, Icono: IconoInstagram },
    { nombre: 'TikTok', href: negocio.tiktok, Icono: IconoTikTok },
    { nombre: 'Facebook', href: negocio.facebook, Icono: IconoFacebook },
  ].flatMap((red) => (red.href ? [{ ...red, href: red.href }] : []))
  if (redes.length === 0) return null

  return (
    <ul className="flex items-center gap-2" aria-label="Redes sociales">
      {redes.map(({ nombre, href, Icono }) => (
        <li key={nombre}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${nombre} de ${negocio.nombre} (se abre en otra pestaña)`}
            className={`flex size-11 items-center justify-center rounded-full ${fondo} text-text transition-colors hover:bg-accent hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
          >
            <Icono className="size-5" />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function ChipsEntrega({ ofreceRetiro, ofreceDelivery, fondo = 'bg-bg' }: {
  ofreceRetiro: boolean
  ofreceDelivery: boolean
  fondo?: string
}) {
  const clase = `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs text-muted ${fondo}`
  return (
    <span className="flex flex-wrap gap-1.5">
      {ofreceDelivery && (
        <span className={clase}>
          <Bike className="size-3.5" aria-hidden="true" />
          Delivery
        </span>
      )}
      {ofreceRetiro && (
        <span className={clase}>
          <ShoppingBag className="size-3.5" aria-hidden="true" />
          Retiro
        </span>
      )}
    </span>
  )
}
