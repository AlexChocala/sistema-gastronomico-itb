'use client'

// Botón con un rango de fechas que abre un calendario para elegirlo (react-day-picker).
// Primer clic: desde; segundo clic: hasta (dos clics en el mismo día = un solo día).
// Las fechas entran y salen como 'AAAA-MM-DD'. Los colores salen de los tokens.

import { useRef, useState, type CSSProperties } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { CalendarDays, ChevronDown } from '@/components/icons'
import { useCerrarAlSalir } from '@/lib/utils/useCerrarAlSalir'

interface SelectorRangoFechasProps {
  etiqueta: string
  desde: string
  hasta: string
  // Último día que se puede elegir (ej. hoy).
  maximo?: string
  onCambiar: (rango: { desde: string; hasta: string }) => void
}

function aFecha(texto: string) {
  const [anio, mes, dia] = texto.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function aTexto(fecha: Date) {
  return [fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
}

const mostrar = (texto: string) => texto.split('-').reverse().join('/')

const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })

const estiloCalendario = {
  '--rdp-accent-color': 'var(--accent)',
  '--rdp-accent-background-color': 'var(--accent-soft)',
  '--rdp-range_start-color': 'var(--on-accent)',
  '--rdp-range_end-color': 'var(--on-accent)',
  '--rdp-day-height': '40px',
  '--rdp-day-width': '40px',
  '--rdp-day_button-height': '38px',
  '--rdp-day_button-width': '38px',
} as CSSProperties

export function SelectorRangoFechas({ etiqueta, desde, hasta, maximo, onCambiar }: SelectorRangoFechasProps) {
  const [abierto, setAbierto] = useState(false)
  // Lo marcado en el calendario. Con solo "desde" es un rango a medio elegir: se aplica
  // recién cuando se marca el otro extremo.
  const [marcado, setMarcado] = useState<DateRange | undefined>()
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  useCerrarAlSalir(abierto, setAbierto, contenedor, boton)

  const texto = desde === hasta ? mostrar(desde) : `${mostrar(desde)} – ${mostrar(hasta)}`
  const eligiendoHasta = marcado?.from !== undefined && marcado.to === undefined

  function abrir() {
    setMarcado({ from: aFecha(desde), to: aFecha(hasta) })
    setAbierto(true)
  }

  function marcar(dia: Date) {
    if (!eligiendoHasta) {
      setMarcado({ from: dia, to: undefined })
      return
    }
    const inicio = marcado!.from!
    const [primero, ultimo] = dia < inicio ? [dia, inicio] : [inicio, dia]
    onCambiar({ desde: aTexto(primero), hasta: aTexto(ultimo) })
    setAbierto(false)
    boton.current?.focus()
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${texto}`}
        className="flex cursor-pointer items-center gap-3 rounded-full border border-border bg-surface py-2 pr-4 pl-4 text-sm text-text transition-colors hover:bg-bg focus-visible:border-accent focus-visible:outline-none"
      >
        <CalendarDays className="size-4 shrink-0 text-accent" />
        <span className="tabular-nums">{texto}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div role="dialog" aria-label={etiqueta} className="absolute top-full left-0 z-40 mt-2 rounded-2xl bg-surface p-3 text-sm text-text shadow-xl">
          <DayPicker
            mode="range"
            locale={es}
            selected={marcado}
            onSelect={(_, dia) => marcar(dia)}
            defaultMonth={aFecha(hasta)}
            disabled={maximo ? { after: aFecha(maximo) } : undefined}
            formatters={{ formatCaption: (mes) => formatoMes.format(mes).replace(/^./, (letra) => letra.toUpperCase()) }}
            style={estiloCalendario}
            footer={<p className="px-2 pt-2 text-xs text-muted">{eligiendoHasta ? 'Ahora elegí la fecha de fin.' : 'Elegí la fecha de inicio.'}</p>}
          />
        </div>
      )}
    </div>
  )
}
