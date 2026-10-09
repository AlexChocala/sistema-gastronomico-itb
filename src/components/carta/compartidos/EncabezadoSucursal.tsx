// Encabezados de las páginas públicas de una sucursal. Presentacionales.
//   EncabezadoSucursal: identidad del negocio + datos del local (arriba del menú).
//   EncabezadoPaso:     barra compacta con "volver" para carrito y checkout.

import Link from 'next/link'
import { ArrowLeft, ChevronLeft, Clock, IconoWhatsapp, MapPin } from '@/components/icons'
import type { NegocioPublico } from '@/lib/negocio/negocio'
import type { SucursalPublica } from '@/lib/sucursales/sucursales-publicas'
import { linkWhatsapp } from '@/lib/sucursales/sucursales-validacion'
import { AvatarNegocio, ChipsEntrega, RedesNegocio } from './IdentidadNegocio'

const claseFoco = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function EncabezadoSucursal({ negocio, sucursal, variasSucursales }: {
  negocio: NegocioPublico
  sucursal: SucursalPublica
  variasSucursales: boolean
}) {
  return (
    <header className="bg-surface shadow-sm">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-4 pb-6">
        {/* Siempre hay un "volver" a la portada del negocio, tenga una sucursal o varias. */}
        <Link
          href="/"
          className={`-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm text-muted hover:text-accent ${claseFoco}`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {variasSucursales ? 'Cambiar de local' : 'Inicio'}
        </Link>

        <div className="flex items-center gap-4">
          {/* El logo también lleva a la portada, como en la mayoría de los sitios. */}
          <Link href="/" aria-label={`Inicio de ${negocio.nombre}`} className={`shrink-0 rounded-full ${claseFoco}`}>
            <AvatarNegocio nombre={negocio.nombre} logoUrl={negocio.logoUrl} tamano="chico" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl leading-tight font-semibold">{negocio.nombre}</h1>
            <p className="font-medium text-accent">{sucursal.nombre}</p>
          </div>
        </div>

        {negocio.descripcion && <p className="text-sm font-normal text-muted">{negocio.descripcion}</p>}

        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="sr-only">Dirección: </span>
              {sucursal.direccion}, {sucursal.localidad}
            </span>
          </li>
          {sucursal.horario && (
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">Horario: </span>
                {sucursal.horario}
              </span>
            </li>
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChipsEntrega ofreceRetiro={sucursal.ofreceRetiro} ofreceDelivery={sucursal.ofreceDelivery} />
          <div className="flex items-center gap-2">
            {sucursal.whatsapp && (
              <a
                href={linkWhatsapp(sucursal.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Escribirle por WhatsApp a ${sucursal.nombre} (se abre en otra pestaña)`}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-bg px-4 text-sm text-success transition-colors hover:bg-success hover:text-on-accent ${claseFoco}`}
              >
                <IconoWhatsapp className="size-5" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <RedesNegocio negocio={negocio} />
      </div>
    </header>
  )
}

export function EncabezadoPaso({ titulo, volverA, textoVolver, sucursal }: {
  titulo: string
  volverA: string
  textoVolver: string
  sucursal: string
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 py-2">
        <Link
          href={volverA}
          aria-label={textoVolver}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-bg ${claseFoco}`}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-lg leading-tight font-semibold">{titulo}</h1>
          <p className="truncate text-xs text-muted">{sucursal}</p>
        </div>
      </div>
    </header>
  )
}
