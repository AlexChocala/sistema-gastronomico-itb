'use client'

// Menú "Exportar" de Reportes: PDF de la pestaña visible y Excel con todos los reportes.
// En "Detalle de pedidos" suma los datos del listado (CSV, CSV sin encabezado y JSON).

import { MenuExportar } from '@/components/ui/MenuExportar'
import { exportarExcel } from '@/lib/reportes/exportar-excel'
import { exportarPdf, type NegocioReporte } from '@/lib/reportes/exportar-pdf'
import type { Pestana, Valor } from '@/lib/reportes/pestanas'
import type { Agrupacion, DatosReportes } from '@/lib/reportes/tipos'
import { gruposDatosDelListado, type GrupoExportar } from '@/lib/utils/exportar'

export type ContextoDescarga = {
  negocio: NegocioReporte
  // Textos del encabezado, ej. "Del 01/09/2026 al 28/09/2026" y "Todas las sucursales".
  periodo: string
  sucursal: string
  // Final de los nombres de archivo, ej. "2026-09-01_2026-09-28".
  sufijoArchivo: string
}

interface ExportarReporteProps {
  datos: DatosReportes
  pestana: Pestana
  filas: Valor[][]
  agrupacion: Agrupacion
  contexto: ContextoDescarga
  deshabilitado: boolean
  obtenerImagenGrafico: () => string | null
}

// "Ventas por período" → "ventas-por-periodo"
function aNombreDeArchivo(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-')
}

export function ExportarReporte({ datos, pestana, filas, agrupacion, contexto, deshabilitado, obtenerImagenGrafico }: ExportarReporteProps) {
  const { negocio, periodo, sucursal, sufijoArchivo } = contexto
  const sinDatos = deshabilitado || datos.resumen.cantidadPedidos === 0

  const grupos: GrupoExportar[] = [
    {
      titulo: 'Para leer o imprimir',
      opciones: [
        {
          texto: 'PDF de esta pestaña',
          generar: () =>
            exportarPdf({
              negocio, pestana, filas, resumen: datos.resumen, periodo, sucursal,
              imagenGrafico: obtenerImagenGrafico(),
              nombreArchivo: `reporte-${aNombreDeArchivo(pestana.titulo)}_${sufijoArchivo}.pdf`,
            }),
        },
        {
          texto: 'Excel con todos los reportes',
          generar: () => exportarExcel({ negocio, datos, agrupacion, periodo, sucursal, nombreArchivo: `reportes_${sufijoArchivo}.xlsx` }),
        },
      ],
    },
  ]

  if (pestana.id === 'pedidos') {
    grupos.push(...gruposDatosDelListado(
      `pedidos_${sufijoArchivo}`,
      pestana.columnas.map((columna) => columna.titulo),
      () => ({ filas, json: datos.pedidos }),
    ))
  }

  return (
    <div className="flex justify-end">
      <MenuExportar grupos={grupos} deshabilitado={sinDatos} />
    </div>
  )
}
