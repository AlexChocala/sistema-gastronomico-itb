// Fechas y horarios de trabajo en Argentina; las marcas siempre las fija el servidor.
export const ZONA_ASISTENCIA = 'America/Argentina/Buenos_Aires'
export const DIAS_ASISTENCIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MINUTO = 60000
const DIA = 86400000

export class ErrorAsistencia extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje) }
}

export type HorarioDia = { diaSemana: number; entrada: string; salida: string; toleranciaMinutos: number }
export type PlanTurno = { fechaJornada: string; entradaPrevista: Date; salidaPrevista: Date; toleranciaMinutos: number }
export type MarcaTurno = PlanTurno & { entrada: Date; salida: Date | null }

const formatoFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_ASISTENCIA })
const formatoPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_ASISTENCIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
export const fechaArgentina = (instante: Date) => formatoFecha.format(instante)
export const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(fecha + 'T00:00:00Z') + dias * DIA).toISOString().slice(0, 10)
export const fechaParaBase = (fecha: string) => new Date(fecha + 'T00:00:00Z')

export function minutosHora(hora: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ErrorAsistencia(400, 'Los horarios deben tener formato HH:mm.')
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}
export const horaDeMinutos = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// Calcula el instante UTC usando la zona IANA, sin depender de la zona de la PC/Vercel.
export function instanteArgentina(fecha: string, hora: string) {
  const nominal = Date.parse(`${fecha}T${hora}:00Z`)
  let valor = nominal
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(formatoPartes.formatToParts(new Date(valor)).map(p => [p.type, p.value]))
    const representado = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    valor = nominal - (representado - valor)
  }
  return new Date(valor)
}

export function validarHorario(cuerpo: unknown): HorarioDia[] {
  if (!Array.isArray(cuerpo) || cuerpo.length > 7) throw new ErrorAsistencia(400, 'Enviá como máximo un horario por día de la semana.')
  const vistos = new Set<number>()
  const dias = cuerpo.map((dato): HorarioDia => {
    if (!dato || typeof dato !== 'object' || Array.isArray(dato)) throw new ErrorAsistencia(400, 'Hay un horario inválido.')
    const d = dato as Record<string, unknown>
    if (Object.keys(d).some(k => !['diaSemana', 'entrada', 'salida', 'toleranciaMinutos'].includes(k))
      || typeof d.diaSemana !== 'number' || !Number.isInteger(d.diaSemana) || d.diaSemana < 0 || d.diaSemana > 6
      || typeof d.entrada !== 'string' || typeof d.salida !== 'string') throw new ErrorAsistencia(400, 'Hay un horario inválido.')
    if (vistos.has(d.diaSemana)) throw new ErrorAsistencia(400, 'No se puede repetir un día de trabajo.')
    vistos.add(d.diaSemana)
    if (minutosHora(d.entrada) === minutosHora(d.salida)) throw new ErrorAsistencia(400, 'La entrada y salida deben ser distintas. Cada turno debe durar menos de 24 horas.')
    if (typeof d.toleranciaMinutos !== 'number' || !Number.isInteger(d.toleranciaMinutos) || d.toleranciaMinutos < 0 || d.toleranciaMinutos > 120) {
      throw new ErrorAsistencia(400, 'La tolerancia debe estar entre 0 y 120 minutos enteros.')
    }
    return { diaSemana: d.diaSemana, entrada: d.entrada, salida: d.salida, toleranciaMinutos: d.toleranciaMinutos }
  }).sort((a, b) => a.diaSemana - b.diaSemana)
  const intervalos = dias.map(d => {
    const inicio = d.diaSemana * 1440 + minutosHora(d.entrada)
    let fin = d.diaSemana * 1440 + minutosHora(d.salida)
    if (fin < inicio) fin += 1440
    return { inicio, fin }
  })
  for (let i = 0; i < intervalos.length; i++) for (let j = i + 1; j < intervalos.length; j++) {
    for (const desplazamiento of [-10080, 0, 10080]) {
      if (Math.max(intervalos[i].inicio, intervalos[j].inicio + desplazamiento) < Math.min(intervalos[i].fin, intervalos[j].fin + desplazamiento)) {
        throw new ErrorAsistencia(400, 'Los horarios de trabajo no pueden superponerse, incluso después de medianoche.')
      }
    }
  }
  return dias
}

function planDelDia(horario: HorarioDia[], fecha: string): PlanTurno | null {
  const dia = horario.find(h => h.diaSemana === fechaParaBase(fecha).getUTCDay())
  if (!dia) return null
  const fechaSalida = minutosHora(dia.salida) < minutosHora(dia.entrada) ? sumarDias(fecha, 1) : fecha
  return { fechaJornada: fecha, entradaPrevista: instanteArgentina(fecha, dia.entrada), salidaPrevista: instanteArgentina(fechaSalida, dia.salida), toleranciaMinutos: dia.toleranciaMinutos }
}

export function turnoProgramado(horario: HorarioDia[], ahora: Date): PlanTurno | null {
  const hoy = fechaArgentina(ahora)
  const anterior = planDelDia(horario, sumarDias(hoy, -1))
  if (anterior && anterior.salidaPrevista > ahora && anterior.entradaPrevista <= ahora) return anterior
  return planDelDia(horario, hoy)
}

export function resultadoTurno(turno: MarcaTurno) {
  const minutosPrevistos = Math.round((turno.salidaPrevista.getTime() - turno.entradaPrevista.getTime()) / MINUTO)
  const minutosTrabajados = turno.salida ? Math.max(0, Math.round((turno.salida.getTime() - turno.entrada.getTime()) / MINUTO)) : null
  const minutosTarde = Math.max(0, Math.ceil((turno.entrada.getTime() - turno.entradaPrevista.getTime()) / MINUTO))
  const puntualidad = turno.entrada.getTime() <= turno.entradaPrevista.getTime() + turno.toleranciaMinutos * MINUTO ? 'puntual' as const : 'tarde' as const
  const salidaAnticipada = turno.salida !== null && turno.salida < turno.salidaPrevista
  const duracionCompleta = turno.salida !== null && turno.salida.getTime() - turno.entrada.getTime() >= turno.salidaPrevista.getTime() - turno.entradaPrevista.getTime()
  const cumplimiento = turno.salida === null ? 'en_curso' as const
    : !salidaAnticipada && duracionCompleta ? 'completo' as const : 'incompleto' as const
  return { puntualidad, cumplimiento, salidaAnticipada, minutosTarde, minutosPrevistos, minutosTrabajados }
}

export function rangoAsistencia(parametros: URLSearchParams, ahora: Date) {
  if ([...parametros.keys()].some(k => !['desde', 'hasta'].includes(k) || parametros.getAll(k).length !== 1)) throw new ErrorAsistencia(400, 'Los filtros de asistencia no son válidos.')
  const valida = (fecha: string) => /^\d{4}-\d{2}-\d{2}$/.test(fecha) && Number.isFinite(Date.parse(fecha + 'T00:00:00Z')) && fechaParaBase(fecha).toISOString().slice(0, 10) === fecha
  const hasta = parametros.get('hasta') ?? fechaArgentina(ahora)
  if (!valida(hasta)) throw new ErrorAsistencia(400, 'La fecha Hasta no es válida.')
  const desde = parametros.get('desde') ?? sumarDias(hasta, -29)
  if (!valida(desde) || !valida(hasta) || desde > hasta || (fechaParaBase(hasta).getTime() - fechaParaBase(desde).getTime()) / DIA > 365) {
    throw new ErrorAsistencia(400, 'Elegí un rango de fechas válido de hasta 366 días.')
  }
  return { desde, hasta }
}
