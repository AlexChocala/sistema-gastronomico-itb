// Piezas visuales compartidas por las pantallas de acceso (bienvenida, login y
// contraseñas). Sin lógica: los formularios de components/forms las componen.

import type { ReactNode } from 'react'
import { UtensilsCrossed, type LucideIcon } from '@/components/icons'

export const claseBotonAcento =
  'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

export const claseEnlaceSecundario =
  'inline-flex items-center justify-center gap-2 text-sm text-muted transition-colors hover:text-text'

// Marca de la cabecera (acceso y sidebar del panel). Con el nombre del negocio muestra
// "Kiddo / con Mise": el restaurante en texto y Mise como marca del software. Sin nombre
// (sistema todavía sin configurar) muestra solo "Mise". Nunca muestra el logo del negocio:
// el panel interno mantiene los colores de Mise.
// Con `logoUrl` se muestra el logo del restaurante; sin él, el ícono de Mise.
export function LogoMise({ nombreNegocio, logoUrl }: { nombreNegocio?: string | null; logoUrl?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        // URL del bucket: no pasa por next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
          <UtensilsCrossed size={18} strokeWidth={2} />
        </span>
      )}
      {nombreNegocio ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate leading-tight font-semibold tracking-tight" title={nombreNegocio}>
            {nombreNegocio}
          </span>
          <span className="text-xs text-muted">con Mise</span>
        </span>
      ) : (
        <span className="font-semibold tracking-tight">Mise</span>
      )}
    </div>
  )
}

const tonos = {
  acento: 'bg-accent-soft text-accent',
  exito: 'bg-success/10 text-success',
  peligro: 'bg-danger/10 text-danger',
}

// Encabezado (ícono + título + descripción) y contenido de cada pantalla de acceso.
export function TarjetaAcceso({
  icono: Icono,
  titulo,
  descripcion,
  tono = 'acento',
  children,
}: {
  icono: LucideIcon
  titulo: string
  descripcion?: ReactNode
  tono?: keyof typeof tonos
  children?: ReactNode
}) {
  return (
    <div className="w-full max-w-sm">
      <span className={`mx-auto flex size-12 items-center justify-center rounded-full ${tonos[tono]}`}>
        <Icono className="size-6" strokeWidth={1.75} />
      </span>
      <h1 className="page-title mt-5 text-center">{titulo}</h1>
      {descripcion && <p className="mt-2 text-center text-sm text-muted">{descripcion}</p>}
      {children && <div className="mt-8">{children}</div>}
    </div>
  )
}

export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  )
}
