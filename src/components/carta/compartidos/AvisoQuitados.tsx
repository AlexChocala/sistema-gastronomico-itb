// Aviso de productos que se sacaron del carrito porque ya no están disponibles (el menú
// cambió o el servidor los rechazó al confirmar). Presentacional.

import { TriangleAlert, X } from '@/components/icons'

export function AvisoQuitados({ nombres, onCerrar }: { nombres: string[]; onCerrar: () => void }) {
  if (nombres.length === 0) return null
  const varios = nombres.length > 1
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-warning-surface p-4 text-sm text-text">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
      <p className="flex-1">
        {varios ? 'Sacamos de tu carrito estos productos porque ya no están disponibles: ' : 'Sacamos de tu carrito '}
        <strong className="font-semibold">{nombres.join(', ')}</strong>
        {varios ? '.' : ' porque ya no está disponible.'}
      </p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso"
        className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
