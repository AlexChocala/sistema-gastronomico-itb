'use server'

// Server Action del selector de sucursal del sidebar. Solo el admin puede cambiarla:
// el rol se vuelve a leer de la base, no se confía en lo que diga el cliente.

import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { COOKIE_SUCURSAL_ACTIVA } from '@/lib/sucursal-activa'

export async function elegirSucursal(idSucursal: number) {
  const sesion = await getServerSession(authOptions)
  if (!sesion) throw new Error('No hay sesión activa')

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { activo: true, rol: { select: { nombre: true } } },
  })
  if (!usuario?.activo || usuario.rol.nombre !== 'admin') {
    throw new Error('Solo un administrador puede cambiar de sucursal')
  }

  const sucursal = await prisma.sucursal.findFirst({
    where: { idSucursal, activa: true },
    select: { idSucursal: true },
  })
  if (!sucursal) throw new Error('La sucursal no existe o no está activa')

  ;(await cookies()).set(COOKIE_SUCURSAL_ACTIVA, String(sucursal.idSucursal), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
