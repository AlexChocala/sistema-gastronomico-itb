'use client'

// Aviso oscuro "Quitaste {nombre}." con "Deshacer", para después de sacar una línea del
// carrito. Presentacional: qué se restaura lo decide quien lo usa. El padre lo ubica en
// su pie fijo (arriba de la barra del carrito y del área segura) y lo monta con una `key`
// nueva por cada quitado, así el tiempo vuelve a empezar.
//
// Se cierra solo a los 5 segundos. Mientras el mouse está encima o el foco de teclado
// está adentro, el tiempo se frena (y sigue con lo que le quedaba al salir).

import { useEffect, useRef, useState } from 'react'

const DURACION_MS = 5000

export function AvisoDeshacer({ nombre, onDeshacer, onCerrar }: {
  nombre: string
  onDeshacer: () => void
  onCerrar: () => void
}) {
  const [conMouse, setConMouse] = useState(false)
  const [conFoco, setConFoco] = useState(false)
  const restante = useRef(DURACION_MS)
  const pausado = conMouse || conFoco

  useEffect(() => {
    if (pausado) return
    const inicio = Date.now()
    const temporizador = setTimeout(onCerrar, restante.current)
    return () => {
      clearTimeout(temporizador)
      restante.current = Math.max(0, restante.current - (Date.now() - inicio))
    }
  }, [pausado, onCerrar])

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setConMouse(true)}
      onMouseLeave={() => setConMouse(false)}
      // Solo frena el foco de teclado: el que queda después de un clic no cuenta.
      onFocus={(evento) => setConFoco(evento.target.matches(':focus-visible'))}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setConFoco(false)
      }}
      className="flex items-center gap-3 rounded-2xl bg-text py-2 pr-2 pl-4 text-sm text-surface shadow-lg transition duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none"
    >
      <p className="min-w-0 flex-1 break-words">Quitaste {nombre}.</p>
      <button
        type="button"
        onClick={onDeshacer}
        // Al quitar, el botón del tacho desaparece: el foco pasa acá para no perderse.
        autoFocus
        className="min-h-11 shrink-0 cursor-pointer rounded-full px-4 font-semibold text-accent-soft hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
      >
        Deshacer
      </button>
    </div>
  )
}
