// Contenedor genérico con borde y sombra suave, para envolver los formularios de
// components/forms sin repetir esas clases de Tailwind en cada página. Los colores
// salen de los tokens de styles/globals.css.

import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-text shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}
