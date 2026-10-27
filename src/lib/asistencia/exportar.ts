import type { PersonaAsistencia, RegistroAsistencia } from './tipos'
import { ZONA_ASISTENCIA } from './reglas'

export type HistorialExportable = {
  usuario: PersonaAsistencia; registros: RegistroAsistencia[]
  desde: string | null; hasta: string; generado: string
}

export const COLUMNAS_ASISTENCIA = [
  'Fecha', 'Sucursal', 'Entrada prevista', 'Salida prevista', 'Tolerancia (min)',
  'Entrada registrada', 'Salida registrada', 'Minutos asignados', 'Minutos trabajados', 'Puntualidad', 'Jornada',
]

const instante = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_ASISTENCIA, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const fecha = (valor: string) => valor.split('-').reverse().join('/')

export function filasAsistencia(registros: RegistroAsistencia[]): (string | number)[][] {
  return registros.map(r => [
    fecha(r.fechaJornada), r.sucursal ?? 'Sin sucursal fija',
    instante.format(new Date(r.entradaPrevista)), instante.format(new Date(r.salidaPrevista)), r.toleranciaMinutos,
    instante.format(new Date(r.entrada)), r.salida ? instante.format(new Date(r.salida)) : 'Sin registrar',
    r.minutosPrevistos, r.minutosTrabajados ?? 'En curso',
    r.puntualidad === 'puntual' ? 'Puntual' : `Llegada tarde (${r.minutosTarde} min)`,
    r.cumplimiento === 'completo' ? 'Jornada completa' : r.cumplimiento === 'en_curso' ? 'Turno abierto'
      : r.salidaAnticipada ? 'Salida anticipada' : 'Horas incompletas',
  ])
}

function encabezado(datos: HistorialExportable, filtros: string) {
  return [
    `Usuario: ${datos.usuario.nombre} ${datos.usuario.apellido}`,
    datos.desde ? `Período: ${fecha(datos.desde)} al ${fecha(datos.hasta)}` : `Historial completo hasta el ${fecha(datos.hasta)}`,
    `Filtros: ${filtros}`,
    `Generado: ${instante.format(new Date(datos.generado))} · Hora de Argentina`,
    `${datos.registros.length} jornadas registradas`,
  ]
}

export async function exportarExcelAsistencia(datos: HistorialExportable, filtros: string, nombreArchivo: string) {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()
  const resumen = XLSX.utils.aoa_to_sheet(encabezado(datos, filtros).map(texto => [texto]))
  resumen['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(libro, resumen, 'Resumen')
  const hoja = XLSX.utils.aoa_to_sheet([COLUMNAS_ASISTENCIA, ...filasAsistencia(datos.registros)])
  hoja['!cols'] = COLUMNAS_ASISTENCIA.map(titulo => ({ wch: Math.max(20, titulo.length + 2) }))
  hoja['!autofilter'] = { ref: hoja['!ref']! }
  XLSX.utils.book_append_sheet(libro, hoja, 'Asistencia')
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`)
}

export async function exportarPdfAsistencia(datos: HistorialExportable, filtros: string, nombreArchivo: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const estilo = getComputedStyle(document.documentElement)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Historial de asistencia', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const lineas: string[] = encabezado(datos, filtros).flatMap(texto => doc.splitTextToSize(texto, 269))
  doc.text(lineas, 14, 26)
  autoTable(doc, {
    startY: 30 + lineas.length * 4, margin: { left: 14, right: 14, bottom: 15 },
    head: [COLUMNAS_ASISTENCIA], body: filasAsistencia(datos.registros),
    styles: { fontSize: 7.5, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: estilo.getPropertyValue('--accent').trim(), textColor: estilo.getPropertyValue('--on-accent').trim() },
    columnStyles: { 4: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } },
  })
  const paginas = doc.getNumberOfPages()
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina)
    doc.setFontSize(8)
    doc.text(`Página ${pagina} de ${paginas}`, 283, 203, { align: 'right' })
  }
  doc.save(`${nombreArchivo}.pdf`)
}
