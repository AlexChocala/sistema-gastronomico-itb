import { notFound } from 'next/navigation'
import { FichaAsistencia } from '@/components/asistencia/FichaAsistencia'

export default async function AsistenciaUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound()
  return <FichaAsistencia idUsuario={Number(id)} />
}
