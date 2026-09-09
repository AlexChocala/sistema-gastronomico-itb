// Genera un enlace de recuperación y lo muestra en la terminal.
// Vence a los 30 minutos y deja de ser válido cuando cambia la contraseña.

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { enviarEmailRecupero } from '@/lib/email'

const DURACION_TOKEN_MS = 30 * 60 * 1000 // 30 minutos

function firmar(payload: string, passwordHash: string) {
  const secreto = process.env.NEXTAUTH_SECRET ?? ''
  return crypto.createHmac('sha256', secreto).update(payload).update(passwordHash).digest('base64url')
}

// Se exportan porque app/api/auth/restablecer-contrasena/route.ts necesita generar/verificar
// el mismo token acá. No hay un archivo lib/ aparte para esto en la lista de archivos
// permitidos, así que un route.ts importa las funciones del otro.
export function generarTokenReset(idUsuario: number, passwordHash: string) {
  const expira = Date.now() + DURACION_TOKEN_MS
  const payload = Buffer.from(`${idUsuario}:${expira}`).toString('base64url')
  const firma = firmar(payload, passwordHash)
  return `${payload}.${firma}`
}

export async function verificarTokenReset(token: string): Promise<number | null> {
  const [payload, firma] = token.split('.')
  if (!payload || !firma) return null

  const [idUsuarioStr, expiraStr] = Buffer.from(payload, 'base64url').toString().split(':')
  const idUsuario = Number(idUsuarioStr)
  const expira = Number(expiraStr)

  if (!idUsuario || !expira || Date.now() > expira) {
    return null
  }

  // La firma se recalcula con el passwordHash ACTUAL del usuario, no con el que tenía
  // en el momento de generar el token. Si la contraseña cambió (por este mismo link o
  // por otro pedido de recupero posterior), esta firma esperada no va a coincidir.
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario },
    select: { passwordHash: true },
  })
  if (!usuario) return null

  const firmaEsperada = firmar(payload, usuario.passwordHash)

  // Comparación en tiempo constante para no filtrar información por timing attack.
  const bufferRecibido = Buffer.from(firma)
  const bufferEsperado = Buffer.from(firmaEsperada)
  if (
    bufferRecibido.length !== bufferEsperado.length ||
    !crypto.timingSafeEqual(bufferRecibido, bufferEsperado)
  ) {
    return null
  }

  return idUsuario
}

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  // Para generar el enlace solo necesitamos el identificador, el email y el hash.
  // select evita consultar otros campos del usuario, como debeCambiarContrasena,
  // que pertenece al flujo de ingreso y no interviene en este recupero.
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { idUsuario: true, email: true, passwordHash: true },
  })

  // Si el usuario no existe, respondemos igual que si existiera. Así evitamos que
  // alguien use este endpoint para averiguar qué emails están registrados
  // (enumeración de usuarios).
  if (usuario) {
    const token = generarTokenReset(usuario.idUsuario, usuario.passwordHash)
    const link = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/acceso/restablecer-contrasena?token=${token}`
    enviarEmailRecupero(usuario.email, link)
  }

  return NextResponse.json({
    mensaje: 'Si el email existe, vas a recibir un link de recupero',
  })
}
