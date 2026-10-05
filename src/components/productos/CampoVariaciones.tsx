'use client'

// Variaciones del formulario de producto (van dentro del bloque "Precio"): las de su
// categoría para tildar ("Usar todas") con su precio final, más las que se agregan solo
// para este producto. La primera elegida es la principal de la carta.

import { Plus, Trash2 } from '@/components/icons'
import { MAX_NOMBRE_VARIACION, MAX_VARIACIONES } from '@/lib/productos/productos-validacion'
import { filaPrincipal, nuevaClave, type FilaVariacion } from '@/lib/productos/variaciones-formulario'

const claseCampo =
  'w-full rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50'

export function CampoVariaciones({
  filas,
  onCambiar,
  nombreCategoria,
  deshabilitado,
}: {
  filas: FilaVariacion[]
  onCambiar: (filas: FilaVariacion[]) => void
  nombreCategoria: string
  deshabilitado: boolean
}) {
  const deCategoria = filas.filter((fila) => !fila.propia)
  const todasElegidas = deCategoria.length > 0 && deCategoria.every((fila) => fila.elegida)
  const principal = filaPrincipal(filas)

  function cambiar(clave: string, cambios: Partial<FilaVariacion>) {
    onCambiar(filas.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)))
  }

  function alternarTodas() {
    onCambiar(filas.map((fila) => (fila.propia ? fila : { ...fila, elegida: !todasElegidas })))
  }

  return (
    <div className="flex flex-col gap-3">
      {deCategoria.length > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Destildá las variaciones de {nombreCategoria} que no vende.</p>
          <button type="button" onClick={alternarTodas} disabled={deshabilitado}
            className="shrink-0 cursor-pointer text-xs text-accent hover:underline">
            {todasElegidas ? 'Quitar todas' : 'Usar todas'}
          </button>
        </div>
      ) : (
        filas.length > 0 && <p className="text-xs text-muted">Variaciones solo para este producto.</p>
      )}

      {filas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {filas.map((fila) => (
            <li key={fila.clave} className="grid grid-cols-[auto_minmax(0,1fr)_8.5rem_auto] items-center gap-2">
              <input
                type="checkbox"
                checked={fila.elegida}
                onChange={(evento) => cambiar(fila.clave, { elegida: evento.target.checked })}
                disabled={deshabilitado || fila.propia}
                aria-label={`Usar ${fila.nombre || 'esta variación'}`}
                className="size-5 cursor-pointer accent-accent disabled:cursor-default"
              />
              {fila.propia ? (
                <input
                  value={fila.nombre}
                  onChange={(evento) => cambiar(fila.clave, { nombre: evento.target.value })}
                  maxLength={MAX_NOMBRE_VARIACION}
                  placeholder="Nombre (ej: Familiar)"
                  aria-label="Nombre de la variación"
                  disabled={deshabilitado}
                  className={claseCampo}
                />
              ) : (
                <span className={`flex min-w-0 items-center gap-2 text-sm ${fila.elegida ? '' : 'text-muted line-through'}`}>
                  <span className="truncate">{fila.nombre}</span>
                  {fila === principal && (
                    <span
                      title={`Es el precio que muestra la carta. Se cambia ordenando las variaciones en Categorías → ${nombreCategoria}.`}
                      className="shrink-0 cursor-help rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent no-underline"
                    >
                      Principal
                    </span>
                  )}
                </span>
              )}
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={fila.precio}
                  onChange={(evento) => cambiar(fila.clave, { precio: evento.target.value })}
                  placeholder="Precio"
                  aria-label={`Precio de ${fila.nombre || 'la variación'}`}
                  disabled={deshabilitado || !fila.elegida}
                  className={`${claseCampo} pl-7`}
                />
              </div>
              {fila.propia ? (
                <button
                  type="button"
                  onClick={() => onCambiar(filas.filter((otra) => otra.clave !== fila.clave))}
                  disabled={deshabilitado}
                  aria-label={`Quitar ${fila.nombre || 'variación'}`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full text-danger hover:bg-danger/10"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : (
                <span className="size-9" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}

      {filas.length < MAX_VARIACIONES && (
        <button
          type="button"
          onClick={() => onCambiar([...filas, { clave: nuevaClave(), nombre: '', precio: '', elegida: true, propia: true }])}
          disabled={deshabilitado}
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <Plus className="size-4" />
          {filas.length === 0 ? '¿Se vende en varios tamaños? Agregá una variación' : 'Agregar variación'}
        </button>
      )}
    </div>
  )
}
