'use client'

import { useEffect, useLayoutEffect, useRef, type ComponentProps } from 'react'
import { Input } from '@/components/ui/Input'

type CampoHoraProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string
  onCambiar: (valor: string) => void
}

// Conserva el Input del sistema y su formato de 24 horas, sin el selector AM/PM.
export function CampoHora({ value, onCambiar, ...props }: CampoHoraProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const parteRueda = useRef<'horas' | 'minutos' | null>(null)
  useLayoutEffect(() => {
    const campo = contenedor.current?.querySelector('input')
    if (campo && document.activeElement === campo && parteRueda.current) {
      const horas = parteRueda.current === 'horas'
      campo.setSelectionRange(horas ? 0 : 3, horas ? 2 : 5)
    }
    parteRueda.current = null
  }, [value])
  useEffect(() => {
    const elemento = contenedor.current
    if (!elemento) return
    function ajustar(evento: WheelEvent) {
      const campo = evento.target
      if (!(campo instanceof HTMLInputElement) || campo.disabled || campo.readOnly
        || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.deltaY === 0
        || Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return
      const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(campo.value)
      if (!partes) return
      evento.preventDefault()
      // El texto está centrado: las horas quedan a la izquierda de los dos puntos
      // y los minutos a la derecha. La rueda cambia solo el segmento señalado.
      const rectangulo = campo.getBoundingClientRect()
      const horas = evento.clientX < rectangulo.left + rectangulo.width / 2
      const paso = evento.deltaY < 0 ? 1 : -1
      const hora = (Number(partes[1]) + (horas ? paso : 0) + 24) % 24
      const minuto = (Number(partes[2]) + (horas ? 0 : paso) + 60) % 60
      parteRueda.current = horas ? 'horas' : 'minutos'
      campo.focus({ preventScroll: true })
      onCambiar(`${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`)
    }
    // Listener nativo para poder frenar el desplazamiento de la página sobre el campo.
    elemento.addEventListener('wheel', ajustar, { passive: false })
    return () => elemento.removeEventListener('wheel', ajustar)
  }, [onCambiar])

  return <div ref={contenedor} className="relative mx-auto w-full max-w-48 [&_label]:sr-only">
    <Input {...props} title={props.title ?? 'Escribí el horario o usá la rueda sobre las horas y los minutos.'} type="text" value={value} onChange={e => onCambiar(e.target.value)} />
  </div>
}
