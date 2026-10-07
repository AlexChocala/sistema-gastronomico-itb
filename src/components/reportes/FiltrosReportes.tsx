'use client'

// Filtros de Reportes: rango de fechas (atajos o fechas elegidas) y sucursal.
// El admin elige la sucursal (o todas); el supervisor ve la suya, fija.

import { Store } from '@/components/icons'
import { Desplegable } from '@/components/ui/Desplegable'
import { SelectorRangoFechas } from '@/components/ui/SelectorRangoFechas'
import { fechasDelAtajo, hoyEnArgentina, type Atajo } from '@/lib/reportes/fechas'
import type { OpcionSucursal } from '@/lib/sucursales/sucursal-activa'

export type Rango = Atajo | 'elegir'
export type Filtros = { rango: Rango; desde: string; hasta: string; sucursal: number | 'todas' }

const RANGOS: { valor: Rango; texto: string }[] = [
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'semana', texto: 'Esta semana' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'elegir', texto: 'Elegir fechas' },
]

interface SelectorSegmentadoProps<T extends string> {
  etiqueta: string
  opciones: { valor: T; texto: string }[]
  valor: T
  onCambiar: (valor: T) => void
}

// Grupo de botones donde uno solo queda marcado (atajos de fecha, agrupación).
export function SelectorSegmentado<T extends string>({ etiqueta, opciones, valor, onCambiar }: SelectorSegmentadoProps<T>) {
  return (
    <div role="group" aria-label={etiqueta} className="flex w-fit flex-wrap gap-1 rounded-full bg-surface-muted p-1">
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(opcion.valor)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${activo ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
          >
            {opcion.texto}
          </button>
        )
      })}
    </div>
  )
}

interface FiltrosReportesProps {
  filtros: Filtros
  onCambiar: (filtros: Filtros) => void
  // Nombre de la sucursal si no se puede elegir (supervisor); null si se elige (admin).
  sucursalFija: string | null
  opciones: OpcionSucursal[]
}

export function FiltrosReportes({ filtros, onCambiar, sucursalFija, opciones }: FiltrosReportesProps) {
  function elegirRango(rango: Rango) {
    onCambiar({ ...filtros, rango, ...(rango === 'elegir' ? {} : fechasDelAtajo(rango)) })
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-5 shadow-sm">
      <SelectorSegmentado etiqueta="Período" opciones={RANGOS} valor={filtros.rango} onCambiar={elegirRango} />

      {filtros.rango === 'elegir' && (
        <SelectorRangoFechas
          etiqueta="Fechas"
          desde={filtros.desde}
          hasta={filtros.hasta}
          maximo={hoyEnArgentina()}
          onCambiar={(rango) => onCambiar({ ...filtros, ...rango })}
        />
      )}

      <div className="ml-auto">
        {sucursalFija !== null ? (
          <p className="text-sm text-muted">
            Sucursal: <span className="font-medium text-text">{sucursalFija}</span>
          </p>
        ) : (
          <div className="w-60">
            <Desplegable<number | 'todas'>
              etiqueta="Sucursal"
              icono={Store}
              opciones={[
                { valor: 'todas', texto: 'Todas las sucursales' },
                ...opciones.map((opcion) => ({ valor: opcion.idSucursal, texto: opcion.nombre })),
              ]}
              valor={filtros.sucursal}
              textoVacio="Elegí una sucursal"
              onElegir={(sucursal) => onCambiar({ ...filtros, sucursal })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
