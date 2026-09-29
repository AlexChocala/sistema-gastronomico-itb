'use client'

// Gráfico de una pestaña de Reportes con chart.js. Registra solo las piezas que usa.
// Los colores salen de los tokens de styles/globals.css.

import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
  type TooltipItem,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { formatear, type Formato, type TipoGrafico } from '@/lib/reportes/pestanas'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip)

// En el servidor no hay CSS: el gráfico se dibuja recién en el navegador.
function token(nombre: string) {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
}

interface GraficoReporteProps {
  tipo: Exclude<TipoGrafico, 'mapa'>
  etiquetas: string[]
  valores: number[]
  nombreSerie: string
  formato: Formato
}

export function GraficoReporte({ tipo, etiquetas, valores, nombreSerie, formato }: GraficoReporteProps) {
  const acento = token('--accent')
  const textoSuave = token('--text-muted')
  const borde = token('--border')
  const aTexto = (valor: number) => formatear(valor, formato)

  if (tipo === 'torta') {
    const colores = ['--accent', '--info', '--success', '--warning', '--order-delivered'].map(token)
    return (
      <div className="relative mx-auto h-72 w-full max-w-sm">
        <Doughnut
          data={{ labels: etiquetas, datasets: [{ label: nombreSerie, data: valores, backgroundColor: colores, borderColor: token('--surface') }] }}
          options={{
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: textoSuave } },
              tooltip: { callbacks: { label: (item: TooltipItem<'doughnut'>) => `${item.label}: ${aTexto(item.raw as number)}` } },
            },
          }}
        />
      </div>
    )
  }

  const horizontal = tipo === 'barrasHorizontales'
  const ejeValores = { beginAtZero: true, ticks: { color: textoSuave, callback: (valor: string | number) => aTexto(Number(valor)) }, grid: { color: borde } }
  const ejeEtiquetas = { ticks: { color: textoSuave }, grid: { display: false } }
  const leyenda = { display: false }
  const tooltip = { callbacks: { label: (item: { raw: unknown }) => `${nombreSerie}: ${aTexto(item.raw as number)}` } }

  return (
    <div className="relative h-72 w-full">
      {/* Una línea con un solo punto no se ve: en ese caso va una barra. */}
      {tipo === 'linea' && valores.length > 1 ? (
        <Line
          data={{ labels: etiquetas, datasets: [{ label: nombreSerie, data: valores, borderColor: acento, backgroundColor: acento, tension: 0.3 }] }}
          options={{ maintainAspectRatio: false, plugins: { legend: leyenda, tooltip }, scales: { x: ejeEtiquetas, y: ejeValores } }}
        />
      ) : (
        <Bar
          data={{ labels: etiquetas, datasets: [{ label: nombreSerie, data: valores, backgroundColor: acento, borderRadius: 6, maxBarThickness: 48 }] }}
          options={{
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: { legend: leyenda, tooltip },
            scales: horizontal ? { x: ejeValores, y: ejeEtiquetas } : { x: ejeEtiquetas, y: ejeValores },
          }}
        />
      )}
    </div>
  )
}
