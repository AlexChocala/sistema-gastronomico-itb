import { fechaArgentina, sumarDias } from './reglas'

export const CODIGO_ASISTENCIA_REQUERIDA = 'ASISTENCIA_REQUERIDA'
export const MENSAJE_ASISTENCIA_REQUERIDA = 'Iniciá tu turno en Mi asistencia para usar Pantallas. Necesitás estar dentro del horario asignado y en tu sucursal.'

export type PermisoRegistroPedidos = { habilitado: boolean; requiereAsistencia: boolean; mensaje: string | null; ahora: string; habilitadoHasta: string | null }
export type TurnoParaPedidos = {
  idSucursal: number | null
  fechaJornada: Date
  entradaPrevista: Date
  salidaPrevista: Date
  entrada: Date
  salida: Date | null
}

// No depende de futuras ediciones del horario: utiliza la copia guardada al fichar.
// Un turno nocturno sigue perteneciendo a su fecha de inicio después de medianoche.
export function turnoHabilitaPedidos(turno: TurnoParaPedidos | null | undefined, idSucursal: number, ahora: Date) {
  if (!turno || turno.salida !== null || turno.idSucursal !== idSucursal || turno.entrada > ahora) return false
  if (ahora < turno.entradaPrevista || ahora >= turno.salidaPrevista) return false
  if (ahora.getTime() - turno.entrada.getTime() >= 24 * 60 * 60 * 1000) return false
  const jornada = turno.fechaJornada.toISOString().slice(0, 10)
  const hoy = fechaArgentina(ahora)
  if (jornada === hoy) return true
  return jornada === sumarDias(hoy, -1)
    && fechaArgentina(turno.entradaPrevista) === jornada
    && fechaArgentina(turno.salidaPrevista) === hoy
}
