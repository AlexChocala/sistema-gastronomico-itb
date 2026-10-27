import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { ListadoAsistencia } from '@/components/asistencia/ListadoAsistencia'

export default async function AsistenciaPersonalPage() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) redirect('/acceso/login')
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario }, select: { rol: { select: { nombre: true } } },
  })
  if (!usuario) redirect('/acceso/login')
  // El administrador ya consulta cada historial desde la tabla de Usuarios.
  if (usuario.rol.nombre === 'admin') redirect('/usuarios')
  if (usuario.rol.nombre !== 'supervisor') redirect('/dashboard')
  // Para el supervisor este es su listado de Usuarios, limitado por la API a su sucursal.
  return <ListadoAsistencia />
}
