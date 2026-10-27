import type { ReactNode } from 'react'

export function EnlacePantalla({ href, habilitado, motivo, className, children }: {
  href: string; habilitado: boolean; motivo: string | null; className: string; children: ReactNode
}) {
  if (!habilitado) return <span role="link" aria-disabled="true" title={motivo ?? 'Iniciá tu turno dentro del horario asignado.'} className={`${className} cursor-not-allowed opacity-50`}>{children}</span>
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
}
