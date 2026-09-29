'use client'

// Descargas de Reportes: PDF de la pestaña visible y Excel con todos los reportes.
// En "Detalle de pedidos" suma CSV y JSON con los pedidos.

import { BotonDescarga, BotonesExportar } from '@/components/ui/BotonesExportar'
import { exportarExcel } from '@/lib/reportes/exportar-excel'
import { exportarPdf } from '@/lib/reportes/exportar-pdf'
import type { Pestana, Valor } from '@/lib/reportes/pestanas'
import type { Agrupacion, DatosReportes } from '@/lib/reportes/tipos'

export type ContextoDescarga = {
  // Textos del encabezado, ej. "Del 01/09/2026 al 28/09/2026" y "Todas las sucursales".
  periodo: string
  sucursal: string
  // Final de los nombres de archivo, ej. "2026-09-01_2026-09-28".
  sufijoArchivo: string
}

interface BotonesDescargaProps {
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

export function BotonesDescarga({ datos, pestana, filas, agrupacion, contexto, deshabilitado, obtenerImagenGrafico }: BotonesDescargaProps) {
  const { periodo, sucursal, sufijoArchivo } = contexto
  const sinDatos = deshabilitado || datos.resumen.cantidadPedidos === 0

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <BotonDescarga
        texto="PDF"
        descripcion={`Descargar PDF de ${pestana.titulo}`}
        deshabilitado={sinDatos}
        generar={() =>
          exportarPdf({
            pestana, filas, resumen: datos.resumen, periodo, sucursal,
            imagenGrafico: obtenerImagenGrafico(),
            nombreArchivo: `reporte-${aNombreDeArchivo(pestana.titulo)}_${sufijoArchivo}.pdf`,
          })
        }
      />
      <BotonDescarga
        texto="Excel"
        descripcion="Descargar Excel con todos los reportes"
        deshabilitado={sinDatos}
        generar={() => exportarExcel({ datos, agrupacion, periodo, sucursal, nombreArchivo: `reportes_${sufijoArchivo}.xlsx` })}
      />
      {pestana.id === 'pedidos' && (
        <BotonesExportar
          nombreArchivo={`pedidos_${sufijoArchivo}`}
          columnas={pestana.columnas.map((columna) => columna.titulo)}
          obtenerDatos={() => ({ filas, json: datos.pedidos })}
          deshabilitado={sinDatos}
        />
      )}
    </div>
  )
}
