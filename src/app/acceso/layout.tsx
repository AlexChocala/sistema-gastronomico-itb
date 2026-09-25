// Layout de 2 columnas para toda la sección pública de acceso (bienvenida, login,
// recupero de contraseña, cambio forzado). Columna izquierda: contenido de cada
// página hija. Columna derecha: identidad del sistema (decorativa).

import type { ReactNode } from 'react'
import { LogoMise } from '@/components/acceso/ElementosAcceso'
import { Bike, ChartColumn, ChefHat, Wallet } from '@/components/icons'

// Panel decorativo con la identidad del sistema.
function PanelMarca() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full flex-col justify-center overflow-hidden rounded-3xl bg-accent p-10 text-on-accent"
    >
      <span className="absolute -top-24 -right-24 size-80 rounded-full bg-on-accent/10" />
      <span className="absolute -bottom-32 -left-20 size-96 rounded-full bg-on-accent/10" />

      <div className="relative flex flex-col gap-8">
        <div>
          <p className="text-4xl leading-tight font-semibold tracking-tight">
            Todo tu restaurante,
            <br />
            en un solo lugar.
          </p>
          <p className="mt-3 max-w-sm text-sm text-on-accent/80">
            Tomá pedidos, seguí la cocina en tiempo real y controlá las ventas de cada sucursal.
          </p>
        </div>

        <ul className="flex flex-wrap gap-2 text-sm">
          {[
            { texto: 'Caja', icono: Wallet },
            { texto: 'Cocina', icono: ChefHat },
            { texto: 'Delivery', icono: Bike },
            { texto: 'Reportes', icono: ChartColumn },
          ].map(({ texto, icono: Icono }) => (
            <li key={texto} className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-text shadow-sm">
              <Icono className="size-4" />
              {texto}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function AccesoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface md:grid-cols-2">
      <div className="flex flex-col p-6 md:p-10">
        <LogoMise />
        <main className="flex flex-1 items-center justify-center py-10">{children}</main>
        <p className="text-xs text-muted">Mise · Sistema de gestión gastronómica</p>
      </div>

      <div className="hidden p-3 md:block">
        <PanelMarca />
      </div>
    </div>
  )
}
