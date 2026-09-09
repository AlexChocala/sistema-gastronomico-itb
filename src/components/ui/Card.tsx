// Contenedor genérico con borde y sombra suave, para envolver los formularios de
// components/forms sin repetir esas clases de Tailwind en cada página.
//
// El fondo es blanco fijo, pase lo que pase con el modo claro/oscuro del sistema.
// Por eso el texto también tiene que ser un color fijo (text-neutral-900) en vez de
// heredar el `color: var(--foreground)` que define body en globals.css: esa variable
// cambia a un gris claro en modo oscuro, y sobre este fondo blanco fijo quedaría con
// muy poco contraste (por ejemplo, un <h2> sin className de color propio, como el de
// LoginForm, terminaría heredando ese gris claro).

import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 text-neutral-900 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}
