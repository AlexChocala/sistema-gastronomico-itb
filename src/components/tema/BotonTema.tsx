'use client'

import { Moon, Sun } from '@/components/icons'
import { useTema } from './ProveedorTema'

export function BotonTema() {
  const { tema, elegirTema } = useTema()
  const oscuro = tema === 'oscuro'
  const Icono = oscuro ? Sun : Moon

  return (
    <button
      type="button"
      aria-label="Modo oscuro"
      aria-pressed={oscuro}
      title={oscuro ? 'Usar modo claro' : 'Usar modo oscuro'}
      onClick={() => elegirTema(oscuro ? 'claro' : 'oscuro')}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icono className="size-5" aria-hidden="true" />
    </button>
  )
}
