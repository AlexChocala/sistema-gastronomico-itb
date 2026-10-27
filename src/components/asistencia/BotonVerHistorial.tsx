import Link from 'next/link'
import { Clock } from '@/components/icons'

export function BotonVerHistorial({ idUsuario, nombre }: { idUsuario: number; nombre: string }) {
  return (
    <Link
      href={`/usuarios/asistencia/${idUsuario}`}
      aria-label={`Ver historial de ${nombre}`}
      title="Ver horarios e historial de asistencia"
      className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-3 py-2 text-xs text-text transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Clock className="size-4" aria-hidden="true" />
      Ver historial
    </Link>
  )
}
