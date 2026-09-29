'use client'

// Modal de un producto de la carta: elegir tamaño (si tiene variaciones), extras y
// cantidad, y agregarlo al carrito. <dialog> nativo: showModal() encierra el foco
// adentro, deja el resto de la página inerte y cierra con Esc; tocar el fondo o la X
// también cierra. Cerrar sin agregar no agrega nada.
//
// Se monta al abrirse y se desmonta al cerrarse (el padre lo renderiza solo con un
// producto elegido): así cada apertura arranca sin nada elegido y con cantidad 1.
// En celular es una hoja que sube desde abajo; en pantallas anchas, una tarjeta centrada.
// El total es solo para mostrar: el precio lo decide el servidor al confirmar.

import { useEffect, useId, useRef, useState } from 'react'
import { X } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import type { EleccionProducto } from '@/lib/pedidos/carrito'
import { MAX_CANTIDAD_ITEM, MAX_EXTRAS_ITEM } from '@/lib/pedidos/pedidos-validacion'
import type { ProductoMenu } from '@/lib/sucursales/sucursales-publicas'
import { formatearPrecio } from '@/lib/utils/precio'
import { SelectorCantidad } from '@/components/carta/compartidos/SelectorCantidad'

const claseOpcion =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent'

export function ModalProducto({ producto, onAgregar, onCerrar }: {
  producto: ProductoMenu
  onAgregar: (eleccion: EleccionProducto) => void
  onCerrar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idPista = useId()
  const [idVariacion, setIdVariacion] = useState<number | null>(null)
  const [extras, setExtras] = useState<number[]>([])
  const [cantidad, setCantidad] = useState(1)

  useEffect(() => {
    const elemento = dialogo.current
    if (elemento && !elemento.open) elemento.showModal()
  }, [])

  const { variaciones } = producto
  const variacion = variaciones.find((opcion) => opcion.idVariacion === idVariacion) ?? null
  const faltaVariacion = variaciones.length > 0 && variacion === null
  const precioUnitario =
    producto.precio +
    (variacion?.precioAdicional ?? 0) +
    producto.extras.reduce((suma, extra) => (extras.includes(extra.idExtra) ? suma + extra.precioAdicional : suma), 0)
  const topeExtras = extras.length >= MAX_EXTRAS_ITEM

  // close() dispara 'close', que avisa al padre (igual que Esc): un solo camino de cierre.
  function cerrar() {
    dialogo.current?.close()
  }

  function alternarExtra(idExtra: number) {
    setExtras((actuales) =>
      actuales.includes(idExtra) ? actuales.filter((id) => id !== idExtra) : [...actuales, idExtra],
    )
  }

  function agregar() {
    if (faltaVariacion) return
    onAgregar({ idVariacion: variacion?.idVariacion ?? null, extras, cantidad })
    cerrar()
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      // El <dialog> no tiene padding: un clic directo sobre él es un clic en el fondo.
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) cerrar()
      }}
      className="mx-0 mt-auto mb-0 w-full max-w-full overflow-hidden rounded-t-3xl bg-surface p-0 text-text shadow-xl transition-transform duration-200 ease-out backdrop:bg-text/50 starting:translate-y-full motion-reduce:transition-none sm:m-auto sm:max-w-md sm:rounded-3xl sm:transition-[opacity,translate] sm:starting:translate-y-4 sm:starting:opacity-0"
    >
      <div className="flex max-h-[90dvh] flex-col sm:max-h-[85dvh]">
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={idTitulo} className="text-xl leading-snug font-semibold">{producto.nombre}</h2>
            <p className="font-semibold text-accent tabular-nums">{formatearPrecio(producto.precio)}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Lo único que se desplaza: nombre y botones quedan siempre a la vista. */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-5">
          {producto.descripcion && <p className="text-sm font-normal text-muted">{producto.descripcion}</p>}

          {variaciones.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold">Tamaño (elegí uno)</legend>
              {variaciones.map((opcion) => {
                const elegida = opcion.idVariacion === idVariacion
                return (
                  <label
                    key={opcion.idVariacion}
                    className={`${claseOpcion} ${elegida ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-accent/50'}`}
                  >
                    <input
                      type="radio"
                      name={`variacion-${producto.idProducto}`}
                      value={opcion.idVariacion}
                      checked={elegida}
                      onChange={() => setIdVariacion(opcion.idVariacion)}
                      required
                      className="size-5 shrink-0 accent-accent"
                    />
                    <span className="flex-1">{opcion.nombre}</span>
                    {opcion.precioAdicional > 0 && (
                      <span className="text-sm text-muted tabular-nums">+{formatearPrecio(opcion.precioAdicional)}</span>
                    )}
                  </label>
                )
              })}
            </fieldset>
          )}

          {producto.extras.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold">Extras (opcional)</legend>
              {producto.extras.map((extra) => {
                const elegido = extras.includes(extra.idExtra)
                // La API acepta hasta MAX_EXTRAS_ITEM extras por línea.
                const bloqueado = !elegido && topeExtras
                return (
                  <label
                    key={extra.idExtra}
                    className={`${claseOpcion} ${elegido ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-accent/50'} ${bloqueado ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={elegido}
                      disabled={bloqueado}
                      onChange={() => alternarExtra(extra.idExtra)}
                      className="size-5 shrink-0 accent-accent"
                    />
                    <span className="flex-1">{extra.nombre}</span>
                    <span className="text-sm text-muted tabular-nums">+{formatearPrecio(extra.precioAdicional)}</span>
                  </label>
                )
              })}
              {topeExtras && producto.extras.length > MAX_EXTRAS_ITEM && (
                <p className="text-xs font-normal text-muted">Podés elegir hasta {MAX_EXTRAS_ITEM} extras.</p>
              )}
            </fieldset>
          )}
        </div>

        {/* Pie fijo: cantidad y "Agregar" con el total en vivo. */}
        <div className="flex flex-col gap-2 border-t border-border/60 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {faltaVariacion && (
            <p id={idPista} className="text-center text-xs font-normal text-muted">
              Elegí un tamaño para agregarlo.
            </p>
          )}
          <div className="flex items-center gap-3">
            <SelectorCantidad
              nombre={producto.nombre}
              cantidad={cantidad}
              onSumar={() => setCantidad((actual) => Math.min(MAX_CANTIDAD_ITEM, actual + 1))}
              onRestar={() => setCantidad((actual) => Math.max(1, actual - 1))}
            />
            <Button
              type="button"
              variant="acento"
              tamano="grande"
              onClick={agregar}
              disabled={faltaVariacion}
              aria-describedby={faltaVariacion ? idPista : undefined}
              className="flex-1"
            >
              Agregar · <span className="tabular-nums">{formatearPrecio(precioUnitario * cantidad)}</span>
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
