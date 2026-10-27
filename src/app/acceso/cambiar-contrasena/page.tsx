import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { CambiarContrasenaForm } from '@/components/forms/CambiarContrasenaForm'
import { cambiarContrasenaPropia, type DatosCambioContrasena } from '@/lib/auth/cambiar-contrasena'

export default async function CambiarContrasenaPage() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) redirect('/acceso/login')
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { activo: true, debeCambiarContrasena: true },
  })
  if (!usuario?.activo) redirect('/acceso/login')

  async function actualizarContrasena(datos: DatosCambioContrasena) {
    'use server'

    // También el cambio forzado verifica la contraseña temporal con la que ingresó.
    const sesionActual = await getServerSession(authOptions)
    return cambiarContrasenaPropia(prisma, sesionActual, datos)
  }

  return <CambiarContrasenaForm accion={actualizarContrasena} cambioObligatorio={usuario.debeCambiarContrasena} />
}
