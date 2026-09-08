// Pantalla de cambio de contraseña forzado en el primer login (debeCambiarContrasena=true).
// No hay un endpoint API para esto en la lista de archivos a crear: usamos una Server
// Action definida acá mismo, el mecanismo nativo de Next.js para mutaciones sin tener
// que armar un route.ts aparte.

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcrypt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CambiarContrasenaForm } from '@/components/forms/CambiarContrasenaForm'

export default async function CambiarContrasenaPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  async function actualizarContrasena(password: string) {
    'use server'

    // Volvemos a leer la sesión adentro de la Server Action: no confiamos en ningún
    // dato que venga del cliente para decidir qué usuario se actualiza.
    const sesionActual = await getServerSession(authOptions)
    if (!sesionActual) {
      throw new Error('No hay sesión activa')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.usuario.update({
      where: { idUsuario: sesionActual.user.idUsuario },
      data: {
        passwordHash,
        debeCambiarContrasena: false,
      },
    })
  }

  return <CambiarContrasenaForm accion={actualizarContrasena} />
}
