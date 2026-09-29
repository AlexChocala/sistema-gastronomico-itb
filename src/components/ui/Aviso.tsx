// Aviso fijo dentro de la pantalla: éxito, error, advertencia o información.
// Regla de uso: Aviso = algo sobre la pantalla o el formulario que estás viendo; queda fijo
// hasta que cambia la situación o se cierra. Para confirmar una acción rápida que se va
// sola, usá AvisoFlotante.
//
// Los colores salen de los tokens de styles/globals.css (--success/--success-surface, etc.).
// Sin estado propio: si se puede cerrar o tiene acción, lo decide quien lo usa.

import type { ReactNode } from 'react'
import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from '@/components/icons'

type TipoAviso = 'exito' | 'error' | 'advertencia' | 'info'

interface AvisoProps {
  tipo: TipoAviso
  titulo?: string
  children: ReactNode
  // Si está, se muestra la X para cerrar.
  onCerrar?: () => void
  // Botón chico secundario, ej. "Reintentar".
  accion?: { texto: string; onClick: () => void }
  className?: string
}

const estilosPorTipo: Record<TipoAviso, { fondo: string; icono: string; Icono: LucideIcon }> = {
  exito: { fondo: 'bg-success-surface', icono: 'text-success', Icono: CircleCheck },
  error: { fondo: 'bg-danger-surface', icono: 'text-danger', Icono: CircleX },
  advertencia: { fondo: 'bg-warning-surface', icono: 'text-warning', Icono: TriangleAlert },
  info: { fondo: 'bg-info-surface', icono: 'text-info', Icono: Info },
}

export function Aviso({ tipo, titulo, children, onCerrar, accion, className = '' }: AvisoProps) {
  const { fondo, icono, Icono } = estilosPorTipo[tipo]
  // Error y advertencia se anuncian de inmediato; éxito e info, sin interrumpir.
  const rol = tipo === 'error' || tipo === 'advertencia' ? 'alert' : 'status'

  return (
    <div role={rol} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-normal text-text ${fondo} ${className}`}>
      <Icono aria-hidden className={`mt-0.5 size-5 shrink-0 ${icono}`} />
      <div className="min-w-0 flex-1 break-words">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div>{children}</div>
        {accion && (
          <button
            type="button"
            onClick={accion.onClick}
            className="mt-2 cursor-pointer rounded-md bg-surface px-3 py-1.5 font-medium text-text shadow-sm transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {accion.texto}
          </button>
        )}
      </div>
      {onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="-my-1.5 -mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-text/5 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
