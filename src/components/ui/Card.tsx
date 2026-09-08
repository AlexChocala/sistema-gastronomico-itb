// Contenedor genérico con borde y sombra suave, para envolver los formularios de
// components/forms sin repetir esas clases de Tailwind en cada página.

import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}
