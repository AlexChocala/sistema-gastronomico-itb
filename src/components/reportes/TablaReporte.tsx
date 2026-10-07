// Tabla de una pestaña de Reportes, armada con las columnas de lib/reportes/pestanas.ts.
// Los números van alineados a la derecha; el encabezado queda fijo al hacer scroll.

import { formatear, type Columna, type Valor } from '@/lib/reportes/pestanas'

export function TablaReporte({ columnas, filas }: { columnas: Columna[]; filas: Valor[][] }) {
  const alineacion = (columna: Columna) => (columna.formato === 'texto' ? 'text-left' : 'text-right tabular-nums')

  return (
    <div className="max-h-[32rem] overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-muted text-muted">
          <tr>
            {columnas.map((columna) => (
              <th key={columna.titulo} scope="col" className={`whitespace-nowrap px-4 py-2 font-medium ${alineacion(columna)}`}>
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t border-border">
              {fila.map((valor, j) => (
                <td key={j} className={`whitespace-nowrap px-4 py-2 text-text ${alineacion(columnas[j])}`}>
                  {formatear(valor, columnas[j].formato)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
