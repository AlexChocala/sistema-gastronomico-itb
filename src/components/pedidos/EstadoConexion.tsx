// Avisos compartidos por las pantallas de pedidos (Cocina, Pedidos, Dashboard, Mostrador):
//   - la lista no se pudo actualizar (se sigue viendo la última que llegó) → "Reintentar";
//   - una acción no se pudo hacer (por ejemplo, otra pantalla ya había movido el pedido).
// Presentacional: los mensajes vienen de usePedidosPantalla / usePedidosMostrador.

import { RotateCcw, TriangleAlert, X } from '@/components/icons'

export function EstadoConexion({
  error,
  errorAccion = null,
  onReintentar,
  onCerrarAviso,
  className = '',
}: {
  error: string | null
  errorAccion?: string | null
  onReintentar: () => void
  onCerrarAviso?: () => void
  className?: string
}) {
  if (!error && !errorAccion) return null

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {error && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm text-danger shadow-sm">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={onReintentar}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-text transition-colors hover:bg-bg"
          >
            <RotateCcw className="size-3.5" />
            Reintentar
          </button>
        </p>
      )}
      {errorAccion && (
        <p role="alert" className="flex items-center gap-3 rounded-2xl bg-warning-surface px-4 py-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">{errorAccion}</span>
          {onCerrarAviso && (
            <button
              type="button"
              onClick={onCerrarAviso}
              aria-label="Cerrar aviso"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-surface"
            >
              <X className="size-4" />
            </button>
          )}
        </p>
      )}
    </div>
  )
}
