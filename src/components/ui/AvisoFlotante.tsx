'use client'

// Aviso oscuro flotante, abajo al centro de la pantalla.
// Regla de uso: AvisoFlotante = confirma una acción rápida que acabás de hacer y se va solo;
// puede ofrecer Deshacer. Para algo sobre la pantalla que tiene que quedar fijo, usá Aviso.
//
// Se cierra solo a los `duracion` ms. Mientras el mouse está encima o el foco de teclado
// está adentro, el tiempo se frena (y sigue con lo que le quedaba al salir). Si cambia
// `mensaje` (texto), el tiempo vuelve a empezar; si el mensaje es JSX, montalo con una
// `key` nueva para reiniciarlo (el JSX es un objeto nuevo en cada render).
//
// Para subirlo por encima de una barra fija, pasá un margen en `className` (ej. `mb-20`).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from '@/components/icons'

interface AvisoFlotanteProps {
  mensaje: ReactNode
  // Ej. "Deshacer". Qué hace lo decide quien lo usa.
  accion?: { texto: string; onClick: () => void }
  onCerrar: () => void
  duracion?: number
  // El foco pasa a la acción al aparecer (ej. cuando el botón que lo disparó desaparece).
  enfocarAccion?: boolean
  mostrarCerrar?: boolean
  className?: string
}

export function AvisoFlotante({
  mensaje,
  accion,
  onCerrar,
  duracion = 5000,
  enfocarAccion = false,
  mostrarCerrar = true,
  className = '',
}: AvisoFlotanteProps) {
  const [conMouse, setConMouse] = useState(false)
  const [conFoco, setConFoco] = useState(false)
  const pausado = conMouse || conFoco

  // Solo un texto sirve para detectar que cambió el mensaje (ver comentario de arriba).
  const claveMensaje = typeof mensaje === 'string' || typeof mensaje === 'number' ? mensaje : null
  const restante = useRef(duracion)
  const claveAnterior = useRef<{ mensaje: typeof claveMensaje; duracion: number }>({ mensaje: claveMensaje, duracion })

  useEffect(() => {
    // Mensaje o duración nuevos: el tiempo arranca completo otra vez.
    if (claveAnterior.current.mensaje !== claveMensaje || claveAnterior.current.duracion !== duracion) {
      claveAnterior.current = { mensaje: claveMensaje, duracion }
      restante.current = duracion
    }
    if (pausado) return
    const inicio = Date.now()
    const temporizador = setTimeout(onCerrar, restante.current)
    return () => {
      clearTimeout(temporizador)
      restante.current = Math.max(0, restante.current - (Date.now() - inicio))
    }
  }, [pausado, onCerrar, claveMensaje, duracion])

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
      className={`fixed inset-x-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-toast py-2 pr-2 pl-4 text-sm text-on-toast shadow-lg transition duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none ${className}`}
    >
      <div className="min-w-0 flex-1 break-words">{mensaje}</div>
      {accion && (
        <button
          type="button"
          onClick={accion.onClick}
          autoFocus={enfocarAccion}
          className="min-h-11 shrink-0 cursor-pointer rounded-full px-4 font-semibold text-accent-soft transition-colors hover:bg-on-toast/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-toast"
        >
          {accion.texto}
        </button>
      )}
      {mostrarCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-on-toast/70 transition-colors hover:bg-on-toast/10 hover:text-on-toast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-toast"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
