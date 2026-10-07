// Stepper −/+ de cantidad (modal del producto y carrito). Presentacional: no quita nada.
// En el mínimo (`minimo`, 1 por defecto) el "−" queda deshabilitado (gris); para sacar
// una línea del carrito hay un botón aparte (el tacho), no se hace desde acá.

import { Minus, Plus } from '@/components/icons'
import { MAX_CANTIDAD_ITEM } from '@/lib/pedidos/pedidos-validacion'

const claseBoton =
  'flex size-11 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer'

export function SelectorCantidad({ nombre, cantidad, minimo = 1, onSumar, onRestar }: {
  nombre: string
  cantidad: number
  minimo?: number
  onSumar: () => void
  onRestar: () => void
}) {
  const alMinimo = cantidad <= minimo
  const alMaximo = cantidad >= MAX_CANTIDAD_ITEM
  return (
    <div className="flex items-center rounded-full bg-accent-soft" role="group" aria-label={`Cantidad de ${nombre}`}>
      <button
        type="button"
        onClick={onRestar}
        disabled={alMinimo}
        aria-label={alMinimo ? `Mínimo ${minimo} de ${nombre}` : `Restar uno de ${nombre}`}
        className={claseBoton}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-7 text-center font-semibold tabular-nums" aria-live="polite">
        {cantidad}
      </span>
      <button
        type="button"
        onClick={onSumar}
        disabled={alMaximo}
        aria-label={alMaximo ? `Máximo ${MAX_CANTIDAD_ITEM} de ${nombre}` : `Sumar uno de ${nombre}`}
        className={claseBoton}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
