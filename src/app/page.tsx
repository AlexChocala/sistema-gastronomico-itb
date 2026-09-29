// Home pública (a donde llega el QR): identidad del negocio y selector de sucursal.
//   Sin negocio configurado → aviso neutro.
//   Sin sucursales activas  → aviso amable.
//   Una sola sucursal       → directo a su menú (/{slug}).
//   Varias                  → tarjetas para elegir.
// No requiere sesión: "/" no está en el matcher de src/proxy.ts.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ChevronRight, Clock, IconoWhatsapp, MapPin, UtensilsCrossed } from '@/components/icons'
import { Card } from '@/components/ui/Card'
import { AvatarNegocio, ChipsEntrega, RedesNegocio } from '@/components/carta/compartidos/IdentidadNegocio'
import { obtenerNegocioPublico } from '@/lib/negocio/negocio'
import { listarSucursalesPublicas, type SucursalPublica } from '@/lib/sucursales/sucursales-publicas'
import { linkWhatsapp } from '@/lib/sucursales/sucursales-validacion'

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  const negocio = await obtenerNegocioPublico()
  return {
    title: negocio ? `${negocio.nombre} · Pedí online` : 'Menú online',
    description: negocio?.descripcion ?? undefined,
  }
}

export default async function Home() {
  // Los datos cambian desde el panel: la página se arma en cada visita, no en el build.
  await connection()
  const negocio = await obtenerNegocioPublico()

  if (!negocio) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg px-4 py-12 text-text">
        <Card className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface-muted text-muted">
            <UtensilsCrossed className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Estamos preparando nuestro menú</h1>
          <p className="text-sm text-muted">Volvé a pasar en un ratito.</p>
        </Card>
      </div>
    )
  }

  const sucursales = await listarSucursalesPublicas()
  // Con una sola sucursal no hay nada que elegir.
  if (sucursales.length === 1) redirect(`/${sucursales[0].slug}`)

  return (
    <div className="flex flex-1 justify-center bg-bg px-4 py-12 text-text">
      <main className="flex w-full max-w-md flex-col items-center gap-6">
        <AvatarNegocio nombre={negocio.nombre} logoUrl={negocio.logoUrl} />

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="page-title">{negocio.nombre}</h1>
          {negocio.descripcion && <p className="text-sm text-muted">{negocio.descripcion}</p>}
        </div>

        <RedesNegocio negocio={negocio} />

        <section aria-labelledby="titulo-sucursales" className="mt-4 flex w-full flex-col gap-3">
          {sucursales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface p-6 text-center shadow-sm">
              <h2 id="titulo-sucursales" className="font-semibold">Por ahora no estamos tomando pedidos online</h2>
              <p className="text-sm text-muted">Seguinos en nuestras redes para enterarte cuándo volvemos.</p>
            </div>
          ) : (
            <>
              <h2 id="titulo-sucursales" className="section-label text-center">
                Elegí tu local más cercano
              </h2>
              <ul className="flex flex-col gap-3">
                {sucursales.map((sucursal) => (
                  <li key={sucursal.idSucursal}>
                    <TarjetaSucursal sucursal={sucursal} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

// El link a la sucursal y el botón de WhatsApp son hermanos (no uno dentro del otro): un
// elemento interactivo no puede ir dentro de otro.
function TarjetaSucursal({ sucursal }: { sucursal: SucursalPublica }) {
  return (
    <div className="flex items-stretch gap-2 rounded-3xl bg-surface p-2 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/${sucursal.slug}`}
        className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MapPin className="size-5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="leading-tight font-semibold">{sucursal.nombre}</span>
          <span className="flex flex-col gap-0.5 text-xs text-muted">
            <span className="truncate">{sucursal.direccion}</span>
            {sucursal.horario && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                {sucursal.horario}
              </span>
            )}
          </span>
          <ChipsEntrega ofreceRetiro={sucursal.ofreceRetiro} ofreceDelivery={sucursal.ofreceDelivery} />
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transition-none"
          aria-hidden="true"
        />
      </Link>
      {sucursal.whatsapp && (
        <a
          href={linkWhatsapp(sucursal.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribirle por WhatsApp a ${sucursal.nombre}`}
          className="flex w-12 shrink-0 items-center justify-center self-center rounded-2xl bg-bg py-3 text-success transition-colors hover:bg-success hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
        >
          <IconoWhatsapp className="size-6" />
        </a>
      )}
    </div>
  )
}
