// Genera un enlace de recuperación y lo envía por email al usuario.
// Vence a los 30 minutos y deja de ser válido cuando cambia la contraseña.

import { NextResponse, after } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { sendPasswordResetEmail } from '@/lib/email/mailer'

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

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  // Para generar el enlace solo necesitamos el identificador, el email y el hash.
  // select evita consultar otros campos del usuario, como debeCambiarContrasena,
  // que pertenece al flujo de ingreso y no interviene en este recupero.
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { idUsuario: true, email: true, passwordHash: true },
  })

  // Si el usuario no existe, no se genera token ni se envía nada, pero respondemos
  // igual que si existiera. Así evitamos que alguien use este endpoint para averiguar
  // qué emails están registrados (enumeración de usuarios).
  if (usuario) {
    const urlBase = process.env.APP_URL?.replace(/\/+$/, '')

    if (!urlBase) {
      console.error('Falta APP_URL en las variables de entorno: no se envió el email de recupero.')
    } else {
      const token = generarTokenReset(usuario.idUsuario, usuario.passwordHash)
      const link = `${urlBase}/acceso/restablecer-contrasena?token=${token}`
      const destinatario = usuario.email

      // after() envía el mail después de responder. Con await, la respuesta tardaría
      // más solo cuando el email existe, y midiendo ese tiempo se podría saber qué
      // emails están registrados.
      after(async () => {
        try {
          await sendPasswordResetEmail(destinatario, link)
        } catch (error) {
          // Solo el código del error (ej. EAUTH). Nunca el email, el link ni el token.
          const codigo =
            typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'DESCONOCIDO'
          console.error('No se pudo enviar el email de recupero. Código:', codigo)
        }
      })
    }
  }

  return NextResponse.json({
    mensaje: 'Si el email existe, vas a recibir un link de recupero',
  })
}