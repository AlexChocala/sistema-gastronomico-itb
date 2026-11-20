// Horario en que una sucursal acepta pedidos online. Sin dependencias de servidor.
//
// Cada franja es un tramo de un día (0 = domingo ... 6 = sábado), en minutos desde las 00:00
// hora de Argentina. Un local con turno partido tiene dos franjas el mismo día. Si cierra
// pasada la medianoche, `cierraMin` supera 1440 (por ejemplo, abre 18:00 y cierra 01:00 →
// 1080 a 1500). Sin franjas = sin restricción de horario; la pausa manual siempre cierra.

export type Franja = { diaSemana: number; abreMin: number; cierraMin: number }

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'
export const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const MAX_FRANJAS_POR_DIA = 3
const MINUTOS_DIA = 1440

const DIAS_CORTOS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// Día de la semana y minutos desde las 00:00 en hora de Argentina.
export function ahoraEnArgentina(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha)
  const dato = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return { diaSemana: DIAS_CORTOS[dato('weekday')] ?? 0, minutos: Number(dato('hour')) * 60 + Number(dato('minute')) }
}

export function estaAbierta(
  sucursal: { pausaPedidosOnline: boolean; horarios: Franja[] },
  fecha = new Date(),
): boolean {
  if (sucursal.pausaPedidosOnline) return false
  if (sucursal.horarios.length === 0) return true
  const { diaSemana, minutos } = ahoraEnArgentina(fecha)
  const ayer = (diaSemana + 6) % 7
  return sucursal.horarios.some((franja) =>
    // Franja de hoy, o la parte de una franja de ayer que pasó la medianoche.
    (franja.diaSemana === diaSemana && minutos >= franja.abreMin && minutos < franja.cierraMin) ||
    (franja.diaSemana === ayer && minutos + MINUTOS_DIA >= franja.abreMin && minutos + MINUTOS_DIA < franja.cierraMin),
  )
}

export function franjaValida(franja: Franja) {
  return Number.isInteger(franja.diaSemana) && franja.diaSemana >= 0 && franja.diaSemana <= 6 &&
    Number.isInteger(franja.abreMin) && franja.abreMin >= 0 && franja.abreMin < MINUTOS_DIA &&
    Number.isInteger(franja.cierraMin) && franja.cierraMin > franja.abreMin && franja.cierraMin <= 2 * MINUTOS_DIA
}

// Dos franjas del mismo día no se pueden pisar.
export function franjasSinSolapar(franjas: Franja[]) {
  const porDia = new Map<number, Franja[]>()
  for (const franja of franjas) porDia.set(franja.diaSemana, [...(porDia.get(franja.diaSemana) ?? []), franja])
  return [...porDia.values()].every((delDia) => {
    const ordenadas = [...delDia].sort((a, b) => a.abreMin - b.abreMin)
    return ordenadas.every((franja, indice) => indice === 0 || franja.abreMin >= ordenadas[indice - 1].cierraMin)
  })
}

// "HH:MM" <-> minutos (para los campos de hora del formulario).
export function minutosAHora(minutos: number) {
  const dentroDelDia = minutos % MINUTOS_DIA
  return `${String(Math.floor(dentroDelDia / 60)).padStart(2, '0')}:${String(dentroDelDia % 60).padStart(2, '0')}`
}

export function horaAMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null
}

// Un cierre igual o anterior a la apertura es "después de medianoche".
export function cierreAMinutos(abre: number, cierraHora: string) {
  const cierre = horaAMinutos(cierraHora)
  if (cierre === null) return null
  return cierre <= abre ? cierre + MINUTOS_DIA : cierre
}
