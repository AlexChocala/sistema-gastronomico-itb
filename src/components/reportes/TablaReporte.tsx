// Tabla de una pestaña de Reportes, armada con las columnas de lib/reportes/pestanas.ts.
// El texto va a la izquierda y los números (importes y cantidades) a la derecha, para
// compararlos de un vistazo. `soloColumnas` muestra un subconjunto en pantalla: la
// exportación sigue llevando todas. El encabezado queda fijo al hacer scroll.

import { formatear, type Columna, type Valor } from '@/lib/reportes/pestanas'

export function TablaReporte({
  columnas, filas, compacta = false, soloColumnas,
}: {
  columnas: Columna[]
  filas: Valor[][]
  compacta?: boolean
  soloColumnas?: string[]
}) {
  const espaciado = compacta ? 'px-2.5 py-2' : 'px-4 py-2'
  const ajuste = (columna: Columna) => columna.multilinea ? 'max-w-44 whitespace-normal break-words' : 'whitespace-nowrap'
  const alineacion = (columna: Columna) => columna.formato === 'texto' ? 'text-left' : 'text-right tabular-nums'
  const indices = columnas.map((_, i) => i).filter((i) => !soloColumnas || soloColumnas.includes(columnas[i].titulo))

  return (
    <div className="max-h-128 overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-muted text-muted">
          <tr>
            {indices.map((i) => (
              <th key={columnas[i].titulo} scope="col" className={`${ajuste(columnas[i])} ${espaciado} font-medium ${alineacion(columnas[i])}`}>
                {columnas[i].titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, f) => (
            <tr key={f} className="border-t border-border">
              {indices.map((i) => (
                <td key={i} className={`${ajuste(columnas[i])} ${espaciado} text-text ${alineacion(columnas[i])}`}>
                  {formatear(fila[i], columnas[i].formato)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
