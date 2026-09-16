// Valida el enlace de recuperación y guarda la nueva contraseña.

import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { verificarTokenReset } from '@/app/api/auth/recuperar-contrasena/route'

export async function POST(request: Request) {
  const { token, password } = await request.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña tiene que tener al menos 6 caracteres' },
      { status: 400 }
    )
  }

  const idUsuario = await verificarTokenReset(token)

  if (!idUsuario) {
    return NextResponse.json({ error: 'El link es inválido o expiró' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.usuario.update({
    where: { idUsuario },
    data: { passwordHash },
    // Después de guardar, pedimos solo el identificador: no necesitamos que Prisma
    // vuelva a leer todos los campos del usuario para confirmar esta operación.
    select: { idUsuario: true },
  })

  return NextResponse.json({ mensaje: 'Contraseña actualizada correctamente' })
}
