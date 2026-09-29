'use client'

// Desplegable propio (no un <select>) para que la lista tenga el estilo del sistema:
// botón en forma de pastilla con ícono y lista con la opción elegida tildada. Por eso
// maneja el teclado a mano: flechas, Enter/Espacio, Inicio/Fin, Escape y Tab.

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, type LucideIcon } from '@/components/icons'
import { useCerrarAlSalir } from '@/lib/utils/useCerrarAlSalir'

export type OpcionDesplegable<T> = { valor: T; texto: string }

interface DesplegableProps<T extends string | number> {
  // Qué se elige ("Sucursal"): arma los textos para lectores de pantalla.
  etiqueta: string
  icono: LucideIcon
  opciones: OpcionDesplegable<T>[]
  valor: T | null
  onElegir: (valor: T) => void
  // Texto del botón cuando no hay nada elegido.
  textoVacio: string
  deshabilitado?: boolean
  // Mientras se aplica la elección (ej. el servidor cambia la sucursal).
  ocupado?: boolean
}

export function Desplegable<T extends string | number>({
  etiqueta, icono: Icono, opciones, valor, onElegir, textoVacio, deshabilitado = false, ocupado = false,
}: DesplegableProps<T>) {
  const [abierto, setAbierto] = useState(false)
  const [resaltada, setResaltada] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const prefijoId = useId()
  useCerrarAlSalir(abierto, setAbierto, contenedor, boton)

  const textoElegido = opciones.find((opcion) => opcion.valor === valor)?.texto ?? textoVacio

  function abrir() {
    setResaltada(Math.max(0, opciones.findIndex((opcion) => opcion.valor === valor)))
    setAbierto(true)
    requestAnimationFrame(() => lista.current?.focus())
  }

  function elegir(elegido: T) {
    setAbierto(false)
    boton.current?.focus()
    if (elegido !== valor) onElegir(elegido)
  }

  function alPresionarTecla(evento: KeyboardEvent<HTMLUListElement>) {
    const ultima = opciones.length - 1
    const destinos: Record<string, number> = {
      ArrowDown: Math.min(resaltada + 1, ultima),
      ArrowUp: Math.max(resaltada - 1, 0),
      Home: 0,
      End: ultima,
    }
    if (evento.key in destinos) {
      evento.preventDefault()
      setResaltada(destinos[evento.key])
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      elegir(opciones[resaltada].valor)
    } else if (evento.key === 'Tab') {
      setAbierto(false)
    }
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowDown' && !abierto) {
            evento.preventDefault()
            abrir()
          }
        }}
        disabled={deshabilitado || ocupado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${textoElegido}`}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-full border border-border bg-surface py-2 pr-4 pl-4 text-sm transition-colors hover:bg-bg focus-visible:border-accent focus-visible:outline-none disabled:opacity-60 ${ocupado ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'}`}
      >
        <Icono className="size-4 shrink-0 text-accent" />
        <span className="flex-1 truncate text-left">{textoElegido}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <ul
          ref={lista}
          role="listbox"
          aria-label={etiqueta}
          tabIndex={-1}
          aria-activedescendant={`${prefijoId}-${resaltada}`}
          onKeyDown={alPresionarTecla}
          className="absolute top-full left-0 z-40 mt-2 flex max-h-80 w-full min-w-56 flex-col gap-1 overflow-y-auto rounded-2xl bg-surface p-2 shadow-xl outline-none"
        >
          {opciones.map((opcion, indice) => {
            const elegida = opcion.valor === valor
            return (
              <li
                key={opcion.valor}
                id={`${prefijoId}-${indice}`}
                role="option"
                aria-selected={elegida}
                onClick={() => elegir(opcion.valor)}
                onPointerMove={() => setResaltada(indice)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  indice === resaltada ? 'bg-surface-muted' : ''
                } ${elegida ? 'text-text' : 'text-muted'}`}
              >
                <Icono strokeWidth={1.75} className="size-4 shrink-0 text-accent" />
                <span className="flex-1 truncate">{opcion.texto}</span>
                {elegida && <Check className="size-4 shrink-0 text-accent" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
