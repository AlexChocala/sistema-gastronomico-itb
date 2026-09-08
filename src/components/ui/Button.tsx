// Botón genérico, sin lógica de negocio. Los formularios de components/forms lo usan
// para las acciones de enviar. `variant` solo cambia el color.

import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primario' | 'secundario'
}

export function Button({ variant = 'primario', className = '', ...props }: ButtonProps) {
  const estilosBase =
    'w-full rounded-md px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'

  const estilosPorVariante =
    variant === 'primario'
      ? 'bg-neutral-900 text-white hover:bg-neutral-700'
      : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'

  return <button className={`${estilosBase} ${estilosPorVariante} ${className}`} {...props} />
}
