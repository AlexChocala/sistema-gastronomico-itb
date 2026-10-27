import type { HorarioDia, resultadoTurno } from './reglas'

export type PersonaAsistencia = {
  idUsuario: number; nombre: string; apellido: string; activo: boolean; rol: string; sucursal: string | null
}
export type RegistroAsistencia = ReturnType<typeof resultadoTurno> & {
  idAsistencia: number; fechaJornada: string; entradaPrevista: string; salidaPrevista: string; toleranciaMinutos: number
  entrada: string; salida: string | null; sucursal: string | null
}
export type DatosAsistencia = {
  usuario: PersonaAsistencia; esPropia: boolean; puedeEditarHorario: boolean
  horario: HorarioDia[]; versionHorario: string; ahora: string
  programado: { fechaJornada: string; entradaPrevista: string; salidaPrevista: string; toleranciaMinutos: number } | null
  abierto: RegistroAsistencia | null; registroDelDia: RegistroAsistencia | null; puedeReanudarTurno: boolean
  registros: RegistroAsistencia[]; desde: string | null; hasta: string
  pagina: number; porPagina: number; totalRegistros: number; totalPaginas: number; todo: boolean
}
