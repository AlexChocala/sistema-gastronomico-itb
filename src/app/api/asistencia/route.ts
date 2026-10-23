import { asistencia } from './asistencia-api'

export async function GET(request: Request) { return asistencia.consultar(request) }
export async function POST(request: Request) { return asistencia.marcar(request) }
