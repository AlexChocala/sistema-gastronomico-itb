'use client'

// Input tipo pastilla con ícono a la izquierda. Si es de contraseña, suma un botón
// para mostrarla u ocultarla.

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, type LucideIcon } from '@/components/icons'

interface CampoAccesoProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  icono: LucideIcon
}

export function CampoAcceso({ id, label, icono: Icono, type = 'text', ...props }: CampoAccesoProps) {
  const [visible, setVisible] = useState(false)
  const esPassword = type === 'password'

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">{label}</label>
      <div className="relative">
        <Icono className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type={esPassword && visible ? 'text' : type}
          className={`w-full rounded-full border border-border bg-surface py-3 pl-11 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent disabled:opacity-60 ${esPassword ? 'pr-12' : 'pr-4'}`}
          {...props}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setVisible((actual) => !actual)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  )
}
