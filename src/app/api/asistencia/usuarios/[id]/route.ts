import { asistencia } from '../../asistencia-api'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return asistencia.consultar(request, id)
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return asistencia.guardarHorario(request, id)
}
