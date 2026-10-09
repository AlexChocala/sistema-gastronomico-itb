'use client'

// Modal de un producto de la carta: foto, descripción, cantidad de cada opción
// (variación), extras y "Agregar al pedido". <dialog> nativo: showModal() encierra el
// foco adentro, deja el resto de la página inerte y cierra con Esc; tocar el fondo o la X
// también cierra. Cerrar sin agregar no agrega nada.
//
// Con variaciones, cada una tiene su contador (se pueden pedir 2 enteras y 1 media de una
// vez) y la principal arranca en 1. Cada opción con cantidad es una línea del carrito, y
// los extras elegidos se suman a cada una. Sin variaciones, un solo contador.
//
// Se monta al abrirse y se desmonta al cerrarse (el padre lo renderiza solo con un
// producto elegido): así cada apertura arranca de cero.
// En celular es una hoja que sube desde abajo (foto arriba); en pantallas anchas, una
// tarjeta con la foto a la izquierda. El total es solo para mostrar: el precio lo decide
// el servidor al confirmar.

import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import type { EleccionProducto } from '@/lib/pedidos/carrito'
import { MAX_CANTIDAD_ITEM, MAX_EXTRAS_ITEM } from '@/lib/pedidos/pedidos-validacion'
import type { ProductoMenu } from '@/lib/sucursales/sucursales-publicas'
import { formatearPrecio } from '@/lib/utils/precio'
import { FotoProducto } from '@/components/carta/compartidos/FotoProducto'
import { SelectorCantidad } from '@/components/carta/compartidos/SelectorCantidad'

const claseOpcion =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent'

export function ModalProducto({ producto, categoria, onAgregar, onCerrar }: {
  producto: ProductoMenu
  categoria: string
  onAgregar: (elecciones: EleccionProducto[]) => void
  onCerrar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idPista = useId()
  const { variaciones } = producto
  // Cantidad por variación (la principal, la primera, arranca en 1) o la cantidad única.
  const [cantidades, setCantidades] = useState<Record<number, number>>(() =>
    variaciones.length > 0 ? { [variaciones[0].idVariacion]: 1 } : {},
  )
  const [cantidadUnica, setCantidadUnica] = useState(1)
  const [extras, setExtras] = useState<number[]>([])

  useEffect(() => {
    const elemento = dialogo.current
    if (elemento && !elemento.open) elemento.showModal()
  }, [])

  const precioExtras = producto.extras.reduce(
    (suma, extra) => (extras.includes(extra.idExtra) ? suma + extra.precioAdicional : suma),
    0,
  )
  const elecciones: EleccionProducto[] = variaciones.length > 0
    ? variaciones
      .filter((opcion) => (cantidades[opcion.idVariacion] ?? 0) > 0)
      .map((opcion) => ({ idVariacion: opcion.idVariacion, extras, cantidad: cantidades[opcion.idVariacion] }))
    : [{ idVariacion: null, extras, cantidad: cantidadUnica }]
  const total = elecciones.reduce((suma, eleccion) => {
    const variacion = variaciones.find((opcion) => opcion.idVariacion === eleccion.idVariacion)
    return suma + (producto.precio + (variacion?.precioAdicional ?? 0) + precioExtras) * eleccion.cantidad
  }, 0)
  const faltaOpcion = elecciones.length === 0
  const topeExtras = extras.length >= MAX_EXTRAS_ITEM

  // close() dispara 'close', que avisa al padre (igual que Esc): un solo camino de cierre.
  function cerrar() {
    dialogo.current?.close()
  }

  function cambiarCantidad(idVariacion: number, cambio: number) {
    setCantidades((actuales) => ({
      ...actuales,
      [idVariacion]: Math.min(MAX_CANTIDAD_ITEM, Math.max(0, (actuales[idVariacion] ?? 0) + cambio)),
    }))
  }

  function alternarExtra(idExtra: number) {
    setExtras((actuales) =>
      actuales.includes(idExtra) ? actuales.filter((id) => id !== idExtra) : [...actuales, idExtra],
    )
  }

  function agregar() {
    if (faltaOpcion) return
    onAgregar(elecciones)
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
      className="mx-0 mt-auto mb-0 w-full max-w-full overflow-hidden rounded-t-3xl bg-surface p-0 text-text shadow-xl transition-transform duration-200 ease-out backdrop:bg-text/50 starting:translate-y-full motion-reduce:transition-none sm:m-auto sm:max-w-3xl sm:rounded-3xl sm:transition-[opacity,translate] sm:starting:translate-y-4 sm:starting:opacity-0"
    >
      <div className="relative flex max-h-[90dvh] flex-col sm:max-h-[85dvh]">
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface/90 text-muted shadow-sm hover:bg-bg hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        {/* En celular se desplaza todo junto; en pantallas anchas, solo la columna de opciones. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:overflow-hidden">
          <div className="p-4 pb-0 sm:p-5 sm:pr-0">
            <FotoProducto nombre={producto.nombre} categoria={categoria} imagenUrl={producto.imagenUrl} className="aspect-16/10 w-full sm:aspect-square" />
          </div>

          <div className="flex min-h-0 flex-col gap-5 px-5 pt-4 pb-5 sm:overflow-y-auto sm:overscroll-contain sm:pt-5">
            <div className="flex flex-col gap-1 pr-10">
              <h2 id={idTitulo} className="text-xl leading-snug font-semibold">{producto.nombre}</h2>
              {producto.descripcion && <p className="text-sm font-normal text-muted">{producto.descripcion}</p>}
              {variaciones.length === 0 && (
                <p className="font-semibold text-accent tabular-nums">{formatearPrecio(producto.precio)}</p>
              )}
            </div>

            {variaciones.length > 0 && (
              <section aria-labelledby={`${idTitulo}-opciones`} className="flex flex-col">
                <div className="flex items-center justify-between gap-3 pb-2">
                  <h3 id={`${idTitulo}-opciones`} className="text-sm text-muted">Elegí al menos 1 opción</h3>
                  {faltaOpcion ? (
                    <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted">Obligatorio</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Check className="size-3.5" aria-hidden="true" />
                      Completado
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-border/60 border-y border-border/60">
                  {variaciones.map((opcion) => (
                    <li key={opcion.idVariacion} className="flex items-center gap-3 py-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{opcion.nombre}</span>
                        <span className="text-sm text-muted tabular-nums">
                          {formatearPrecio(producto.precio + opcion.precioAdicional)}
                        </span>
                      </div>
                      <SelectorCantidad
                        nombre={`${producto.nombre} ${opcion.nombre}`}
                        cantidad={cantidades[opcion.idVariacion] ?? 0}
                        minimo={0}
                        onSumar={() => cambiarCantidad(opcion.idVariacion, 1)}
                        onRestar={() => cambiarCantidad(opcion.idVariacion, -1)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {producto.extras.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm text-muted">Extras (opcional)</legend>
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
                {extras.length > 0 && elecciones.length > 1 && (
                  <p className="text-xs font-normal text-muted">Los extras se suman a cada opción elegida.</p>
                )}
              </fieldset>
            )}
          </div>
        </div>

        {/* Pie fijo: total y "Agregar al pedido". */}
        <div className="flex flex-col gap-3 border-t border-border/60 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold tabular-nums">{formatearPrecio(total)}</span>
          </div>
          {faltaOpcion && (
            <p id={idPista} className="text-center text-xs font-normal text-muted">
              Elegí al menos una opción para agregarlo.
            </p>
          )}
          <div className="flex items-center gap-3">
            {variaciones.length === 0 && (
              <SelectorCantidad
                nombre={producto.nombre}
                cantidad={cantidadUnica}
                onSumar={() => setCantidadUnica((actual) => Math.min(MAX_CANTIDAD_ITEM, actual + 1))}
                onRestar={() => setCantidadUnica((actual) => Math.max(1, actual - 1))}
              />
            )}
            <Button
              type="button"
              variant="acento"
              tamano="grande"
              onClick={agregar}
              disabled={faltaOpcion}
              aria-describedby={faltaOpcion ? idPista : undefined}
              className="flex-1"
            >
              Agregar al pedido
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
