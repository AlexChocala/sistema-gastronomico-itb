// Botón genérico, sin lógica de negocio. Los formularios de components/forms lo usan
// para las acciones de enviar. `variant` solo cambia el color y `tamano` el alto.
//
// estilosBoton() expone las mismas clases para los <Link> que se ven como botón (ej:
// "Continuar" en el carrito del menú digital), así no se duplica el estilo.

import type { ButtonHTMLAttributes } from 'react'

type VarianteBoton = 'primario' | 'secundario' | 'acento'
// 'grande': botones principales del menú digital (mínimo 48px de alto, cómodo en celular).
type TamanoBoton = 'normal' | 'grande'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBoton
  tamano?: TamanoBoton
}

const estilosPorVariante: Record<VarianteBoton, string> = {
  primario: 'bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-primary',
  secundario: 'bg-surface-muted text-text hover:bg-border focus-visible:outline-primary',
  acento: 'bg-accent text-on-accent hover:bg-accent-hover focus-visible:outline-accent',
}

const estilosPorTamano: Record<TamanoBoton, string> = {
  normal: 'rounded-md px-4 py-2',
  grande: 'min-h-12 rounded-xl px-5 py-3 text-base',
}

export function estilosBoton({ variant = 'primario', tamano = 'normal' }: { variant?: VarianteBoton; tamano?: TamanoBoton } = {}) {
  const estilosBase =
    'inline-flex w-full items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2'
  return `${estilosBase} ${estilosPorVariante[variant]} ${estilosPorTamano[tamano]}`
}

export function Button({ variant = 'primario', tamano = 'normal', className = '', ...props }: ButtonProps) {
  return <button className={`${estilosBoton({ variant, tamano })} ${className}`} {...props} />
}
