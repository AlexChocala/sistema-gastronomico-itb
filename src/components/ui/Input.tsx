// Input genérico con label y mensaje de error opcional, para no repetir ese markup
// en cada formulario de components/forms.
//
// El <input> no traía color de texto propio, así que heredaba el `color:
// var(--foreground)` de body — en modo oscuro del sistema eso es gris claro, y sobre
// el fondo blanco fijo del input (heredado del Card que lo envuelve) el texto que se
// escribe casi no se veía. text-neutral-900 lo deja fijo, sin depender de esa variable.

import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900 ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
