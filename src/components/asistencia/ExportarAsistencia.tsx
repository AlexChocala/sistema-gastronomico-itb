'use client'

import { MenuExportar } from '@/components/ui/MenuExportar'
import { COLUMNAS_ASISTENCIA, filasAsistencia, exportarExcelAsistencia, exportarPdfAsistencia, type HistorialExportable } from '@/lib/asistencia/exportar'
import { OPCIONES_JORNADA_ASISTENCIA, OPCIONES_PUNTUALIDAD_ASISTENCIA, ZONA_ASISTENCIA } from '@/lib/asistencia/reglas'
import { gruposDatosDelListado, type GrupoExportar } from '@/lib/utils/exportar'
import { pedirAsistencia } from './useAsistencia'

export function ExportarAsistencia({ endpoint, deshabilitado }: { endpoint: string; deshabilitado: boolean }) {
  const [ruta, consulta] = endpoint.split('?')
  const filtros = new URLSearchParams(consulta)
  filtros.delete('pagina')
  const textos = [
    OPCIONES_PUNTUALIDAD_ASISTENCIA.find(o => o.valor === filtros.get('puntualidad'))?.texto,
    OPCIONES_JORNADA_ASISTENCIA.find(o => o.valor === filtros.get('jornada'))?.texto,
  ].filter(Boolean).join(' · ') || 'Todas las llegadas y jornadas'
  const url = `${ruta}/exportar${filtros.size ? `?${filtros}` : ''}`
  const obtener = () => pedirAsistencia<HistorialExportable>(url, undefined, { accion: 'preparar la descarga del historial', tiempoMaximo: 60000 })
  const nombre = (datos: HistorialExportable) => `asistencia-${datos.usuario.idUsuario}_${datos.desde ?? 'historial'}_${datos.hasta}${filtros.has('puntualidad') || filtros.has('jornada') ? '_filtrado' : ''}`
  const destino = ruta.split('/').pop()
  const nombreListado = `asistencia-${destino === 'asistencia' ? 'propia' : destino}${filtros.size ? '_filtrado' : ''}`
  // El menú consulta al elegir un formato; no carga todo el historial al abrir la ficha.
  const grupos: GrupoExportar[] = [{
    titulo: 'Para leer o imprimir', opciones: [
      { texto: 'PDF del historial', generar: async () => { const datos = await obtener(); await exportarPdfAsistencia(datos, textos, nombre(datos)) } },
      { texto: 'Excel del historial', generar: async () => { const datos = await obtener(); await exportarExcelAsistencia(datos, textos, nombre(datos)) } },
    ],
  }, ...gruposDatosDelListado(nombreListado,
    COLUMNAS_ASISTENCIA, async () => {
      const datos = await obtener()
      return { filas: filasAsistencia(datos.registros), json: { ...datos, filtros: textos, zonaHoraria: ZONA_ASISTENCIA } }
    })]
  return <MenuExportar grupos={grupos} deshabilitado={deshabilitado} />
}
