import { asistencia } from '../asistencia-api'

export async function GET(request: Request) { return asistencia.exportar(request) }
