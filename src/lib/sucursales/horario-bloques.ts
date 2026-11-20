// El horario de una sucursal, como lo ve quien lo carga: BLOQUES ("Lun a Vie · 18:00 a 23:30") en
// vez de una fila por día. Un local de corrido tiene un bloque; uno con turno partido, dos bloques
// con los mismos días. Aquí se pasa de bloques a las franjas por día que guarda la base (y
// viceversa) y se arma el texto que ve el cliente en la carta. Sin dependencias de servidor.

import { DIAS_NOMBRE, cierreAMinutos, franjaValida, franjasSinSolapar, horaAMinutos, minutosAHora, type Franja } from './horario-online'

export type Bloque = { dias: number[]; abre: string; cierra: string }

// Lunes primero (el valor guardado sigue siendo 0 = domingo).
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]
export const DIAS_CORTOS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
const DIAS_ABREVIADOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const bloqueVacio = (): Bloque => ({ dias: [1, 2, 3, 4, 5, 6], abre: '', cierra: '' })

const incompleto = (bloque: Bloque) => bloque.abre === '' && bloque.cierra === ''

// De bloques a franjas por día. Devuelve el mensaje de error si algo no cierra.
export function bloquesAFranjas(bloques: Bloque[]): { franjas: Franja[] } | { error: string } {
  const franjas: Franja[] = []
  for (const bloque of bloques) {
    if (incompleto(bloque)) continue
    const abre = horaAMinutos(bloque.abre)
    const cierra = abre === null ? null : cierreAMinutos(abre, bloque.cierra)
    if (abre === null || cierra === null) return { error: 'Completá la hora de apertura y de cierre de cada horario.' }
    if (bloque.dias.length === 0) return { error: 'Elegí al menos un día en cada horario.' }
    for (const diaSemana of bloque.dias) franjas.push({ diaSemana, abreMin: abre, cierraMin: cierra })
  }
  if (!franjas.every(franjaValida)) return { error: 'Revisá las horas: hay un horario inválido.' }
  if (!franjasSinSolapar(franjas)) return { error: 'Hay horarios del mismo día que se pisan.' }
  return { franjas }
}

// De franjas por día a bloques: los días con el mismo tramo se juntan en un bloque.
export function franjasABloques(franjas: Franja[]): Bloque[] {
  const porTramo = new Map<string, Bloque>()
  for (const franja of [...franjas].sort((a, b) => a.abreMin - b.abreMin || a.diaSemana - b.diaSemana)) {
    const clave = `${franja.abreMin}-${franja.cierraMin}`
    const bloque = porTramo.get(clave) ?? { dias: [], abre: minutosAHora(franja.abreMin), cierra: minutosAHora(franja.cierraMin) }
    bloque.dias.push(franja.diaSemana)
    porTramo.set(clave, bloque)
  }
  return [...porTramo.values()]
}

// "8", "8:30": sin ceros de más, como se dice en voz alta.
function horaCorta(minutos: number) {
  const dentro = minutos % 1440
  const h = Math.floor(dentro / 60)
  const m = dentro % 60
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, '0')}`
}

// Días consecutivos (lunes a domingo) como "Lun a Vie"; si no son seguidos, "Lun, Mié y Vie".
function nombreDias(dias: number[]) {
  const posiciones = dias.map((d) => ORDEN_DIAS.indexOf(d)).sort((a, b) => a - b)
  const nombres = posiciones.map((p) => DIAS_ABREVIADOS[ORDEN_DIAS[p]])
  if (nombres.length === 1) return nombres[0]
  const seguidos = posiciones.every((p, i) => i === 0 || p === posiciones[i - 1] + 1)
  if (seguidos && nombres.length > 2) return `${nombres[0]} a ${nombres[nombres.length - 1]}`
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

// El texto de la carta: "Lun a Sáb 8 a 13 y 18 a 23:30hs · Dom 10 a 14hs". Null si no hay franjas.
export function textoHorario(franjas: Franja[]): string | null {
  if (franjas.length === 0) return null
  // Por día, los tramos en orden: "8 a 13 y 18 a 23:30".
  const tramosPorDia = ORDEN_DIAS.map((dia) => ({
    dia,
    tramos: franjas
      .filter((f) => f.diaSemana === dia)
      .sort((a, b) => a.abreMin - b.abreMin)
      .map((f) => `${horaCorta(f.abreMin)} a ${horaCorta(f.cierraMin)}`)
      .join(' y '),
  })).filter((d) => d.tramos !== '')
  const grupos = new Map<string, number[]>()
  for (const { dia, tramos } of tramosPorDia) grupos.set(tramos, [...(grupos.get(tramos) ?? []), dia])
  const todosLosDias = tramosPorDia.length === 7 && grupos.size === 1
  return [...grupos.entries()]
    .map(([tramos, dias]) => `${todosLosDias ? 'Todos los días' : nombreDias(dias)} ${tramos}hs`)
    .join(' · ')
}

export { DIAS_NOMBRE }
