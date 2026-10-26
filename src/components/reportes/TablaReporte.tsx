// Tabla de una pestaña de Reportes, armada con las columnas de lib/reportes/pestanas.ts.
// En el detalle compacto se centran importes y las columnas de identificación del pedido.
// El encabezado queda fijo al hacer scroll.

import { formatear, type Columna, type Valor } from '@/lib/reportes/pestanas'

const COLUMNAS_CENTRADAS_DETALLE = new Set([
  'N.º', 'Fecha', 'Sucursal', 'Registrado por', 'Canal', 'Entrega', 'Estado del pedido',
  'Pago', 'Estado de pago', 'Vendido', 'Productos',
])

export function TablaReporte({ columnas, filas, compacta = false, centrada = false }: { columnas: Columna[]; filas: Valor[][]; compacta?: boolean; centrada?: boolean }) {
  const espaciado = compacta ? 'px-2.5 py-2' : 'px-4 py-2'
  const ajuste = (columna: Columna) => columna.multilinea ? 'max-w-44 whitespace-normal break-words' : 'whitespace-nowrap'
  const alineacion = (columna: Columna) => {
    if (centrada || (compacta && (columna.formato !== 'texto' || COLUMNAS_CENTRADAS_DETALLE.has(columna.titulo)))) {
      return columna.formato === 'texto' ? 'text-center' : 'text-center tabular-nums'
    }
    return columna.formato === 'texto' ? 'text-left' : 'text-right tabular-nums'
  }

  return (
    <div className="max-h-[32rem] overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-muted text-muted">
          <tr>
            {columnas.map((columna) => (
              <th key={columna.titulo} scope="col" className={`${ajuste(columna)} ${espaciado} font-medium ${alineacion(columna)}`}>
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t border-border">
              {fila.map((valor, j) => (
                <td key={j} className={`${ajuste(columnas[j])} ${espaciado} text-text ${alineacion(columnas[j])}`}>
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
