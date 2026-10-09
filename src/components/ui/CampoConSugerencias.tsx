'use client'

// Input de texto con una lista de sugerencias que llegan de un servicio externo (por ejemplo
// Georef). Busca mientras se escribe, con una pausa para no consultar en cada letra, y
// descarta la respuesta de una búsqueda vieja si ya se tipeó otra cosa. Sin `buscar` es un
// input común. Si la búsqueda falla avisa con `onFalla` y el campo sigue siendo escribible.

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { MapPin } from '@/components/icons'

const PAUSA_MS = 300
const MINIMO_CARACTERES = 3

export interface OpcionSugerida {
  clave: string
  texto: string
}

interface CampoConSugerenciasProps<T extends OpcionSugerida> {
  id: string
  name?: string
  valor: string
  onCambiar: (texto: string) => void
  // Sin esta función no hay sugerencias.
  buscar?: (texto: string, signal: AbortSignal) => Promise<T[]>
  onElegir: (opcion: T) => void
  onFalla?: () => void
  // Qué decir cuando la búsqueda no encuentra nada.
  textoSinResultados: string
  placeholder?: string
  deshabilitado?: boolean
  required?: boolean
  maxLength?: number
  className?: string
  ariaLabel?: string
}

export function CampoConSugerencias<T extends OpcionSugerida>({
  id, name, valor, onCambiar, buscar, onElegir, onFalla, textoSinResultados,
  placeholder, deshabilitado, required, maxLength, className, ariaLabel,
}: CampoConSugerenciasProps<T>) {
  const [abierto, setAbierto] = useState(false)
  const [opciones, setOpciones] = useState<T[]>([])
  const [estado, setEstado] = useState<'quieto' | 'buscando' | 'listo' | 'falla'>('quieto')
  const [resaltada, setResaltada] = useState(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlador = useRef<AbortController | null>(null)
  const idLista = useId()

  // Al desmontar se cancela lo que quede pendiente.
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    controlador.current?.abort()
  }, [])

  function cancelarPendiente() {
    if (temporizador.current) clearTimeout(temporizador.current)
    controlador.current?.abort()
  }

  function alEscribir(evento: ChangeEvent<HTMLInputElement>) {
    const texto = evento.target.value
    onCambiar(texto)
    cancelarPendiente()
    if (!buscar || texto.trim().length < MINIMO_CARACTERES) {
      setAbierto(false)
      setEstado('quieto')
      return
    }
    setAbierto(true)
    setEstado('buscando')
    temporizador.current = setTimeout(async () => {
      const actual = new AbortController()
      controlador.current = actual
      try {
        const resultado = await buscar(texto.trim(), actual.signal)
        if (actual.signal.aborted) return
        setOpciones(resultado)
        setResaltada(0)
        setEstado('listo')
      } catch {
        // Cortada por una búsqueda más nueva: no es una falla.
        if (actual.signal.aborted) return
        setEstado('falla')
        onFalla?.()
      }
    }, PAUSA_MS)
  }

  function elegir(opcion: T) {
    cancelarPendiente()
    setAbierto(false)
    setEstado('quieto')
    onElegir(opcion)
  }

  function alPresionarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (!abierto) return
    if (evento.key === 'Escape') {
      setAbierto(false)
    } else if (estado === 'listo' && opciones.length > 0) {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault()
        setResaltada((actual) => Math.min(actual + 1, opciones.length - 1))
      } else if (evento.key === 'ArrowUp') {
        evento.preventDefault()
        setResaltada((actual) => Math.max(actual - 1, 0))
      } else if (evento.key === 'Enter') {
        // Con la lista abierta, Enter elige la sugerencia en vez de enviar el formulario.
        evento.preventDefault()
        elegir(opciones[resaltada])
      }
    }
  }

  const hayLista = abierto && estado !== 'quieto'

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        value={valor}
        onChange={alEscribir}
        onKeyDown={alPresionarTecla}
        onBlur={() => setAbierto(false)}
        autoComplete="off"
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={deshabilitado}
        aria-label={ariaLabel}
        role={buscar ? 'combobox' : undefined}
        aria-expanded={buscar ? hayLista : undefined}
        aria-controls={buscar ? idLista : undefined}
        aria-autocomplete={buscar ? 'list' : undefined}
        aria-activedescendant={hayLista && estado === 'listo' && opciones.length > 0 ? `${idLista}-${resaltada}` : undefined}
        className={className}
      />

      {hayLista && (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Sugerencias"
          // mousedown en vez de click: el input pierde el foco (y cierra la lista) antes del click.
          onMouseDown={(evento) => evento.preventDefault()}
          className="absolute top-full left-0 z-40 mt-2 flex max-h-72 w-full flex-col gap-1 overflow-y-auto rounded-2xl bg-surface p-2 shadow-xl"
        >
          {estado === 'buscando' && <li className="px-3 py-2 text-sm text-muted">Buscando...</li>}
          {estado === 'falla' && (
            <li className="px-3 py-2 text-sm text-muted">No se pudo consultar el servicio.</li>
          )}
          {estado === 'listo' && opciones.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{textoSinResultados}</li>
          )}
          {estado === 'listo' && opciones.map((opcion, indice) => (
            <li
              key={opcion.clave}
              id={`${idLista}-${indice}`}
              role="option"
              aria-selected={indice === resaltada}
              onClick={() => elegir(opcion)}
              onPointerMove={() => setResaltada(indice)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                indice === resaltada ? 'bg-surface-muted' : ''
              }`}
            >
              <MapPin strokeWidth={1.75} className="size-4 shrink-0 text-accent" />
              <span className="flex-1 truncate">{opcion.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
