// Input genérico con label y mensaje de error opcional, para no repetir ese markup
// en cada formulario de components/forms. Los colores salen de los tokens de
// styles/globals.css.

import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  )
}
