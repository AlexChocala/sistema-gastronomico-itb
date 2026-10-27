import { asistencia } from '../../../asistencia-api'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return asistencia.exportar(request, id)
}
