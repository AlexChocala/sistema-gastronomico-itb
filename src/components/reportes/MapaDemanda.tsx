// "Demanda esperada" como mapa de calor: días (de lunes a domingo) por horas con pedidos.
// Cuanto más intenso el color, más pedidos suelen entrar en esa franja. Chart.js no trae
// este tipo de gráfico, así que es una tabla pintada con el token --accent.

import { DIAS_SEMANA, formatear } from '@/lib/reportes/pestanas'
import type { DemandaEsperada } from '@/lib/reportes/tipos'

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]

export function MapaDemanda({ demanda }: { demanda: DemandaEsperada[] }) {
  const dias = ORDEN_DIAS.filter((dia) => demanda.some((d) => d.diaSemana === dia))
  const horas = [...new Set(demanda.map((d) => d.hora))].sort((a, b) => a - b)
  const maximo = Math.max(...demanda.map((d) => d.promedioPedidos))
  const promedios = new Map(demanda.map((d) => [`${d.diaSemana}-${d.hora}`, d.promedioPedidos]))

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <caption className="sr-only">Promedio de pedidos por día de la semana y hora</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">Día</th>
            {horas.map((hora) => (
              <th key={hora} scope="col" className="px-0.5 pb-1 font-medium text-muted">{hora} h</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => (
            <tr key={dia}>
              <th scope="row" className="pr-3 text-left font-medium text-muted">{DIAS_SEMANA[dia]}</th>
              {horas.map((hora) => {
                const promedio = promedios.get(`${dia}-${hora}`) ?? 0
                const intensidad = Math.round((promedio / maximo) * 100)
                return (
                  <td key={hora} className="p-0.5">
                    <div
                      title={`${DIAS_SEMANA[dia]} ${hora} h: ${formatear(promedio, 'numero')} pedidos en promedio`}
                      className={`grid h-9 min-w-10 place-items-center rounded-md tabular-nums ${intensidad > 55 ? 'text-on-accent' : 'text-text'}`}
                      style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${intensidad}%, var(--surface-muted))` }}
                    >
                      {promedio > 0 && formatear(promedio, 'numero')}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
