// Recibe un email. Si existe un usuario con ese email, genera un token de recupero
// y lo "envía" (por ahora, lib/email.ts solo lo imprime por consola).
//
// Cómo se guarda el token
// ------------------------
// No hay un modelo en prisma/schema.prisma para tokens de recupero, y no lo vamos a
// sumar nosotros (ese schema lo maneja otro equipo). En vez de agregar una tabla, el
// token es *stateless*: firmamos con HMAC-SHA256 el id del usuario + una fecha de
// expiración, usando el mismo secreto que NextAuth (NEXTAUTH_SECRET). Es la opción más
// simple posible — no hay nada que guardar ni limpiar en la base, el token se
// autoverifica, como un JWT hecho a mano con el módulo `crypto` de Node (sin sumar la
// librería jsonwebtoken).
//
// Cómo se invalida el token al usarse (sin tabla nueva)
// -------------------------------------------------------
// Un token firmado solo con (idUsuario + expiración) sigue siendo válido las veces que
// se quiera hasta que expira — si alguien reutiliza el link, la API lo vuelve a aceptar.
// Para que "usarlo" lo invalide, la firma también depende del passwordHash actual del
// usuario: HMAC(secreto, payload + passwordHash). Al cambiar la contraseña, bcrypt genera
// un salt nuevo, así que passwordHash cambia SIEMPRE (incluso si se vuelve a poner la
// misma contraseña en texto plano) — la firma calculada con el hash viejo ya no coincide
// con la que se recalcula al verificar, y el token queda inválido solo, sin persistir
// nada. Es la misma idea que usa Django en su PasswordResetTokenGenerator (mezcla
// user.password en el hash del token) — acá el equivalente casero con `crypto`.
//
// Ojo: por eso verificarTokenReset ahora es async y necesita ir a buscar el usuario a
// la base (para leer su passwordHash actual) — antes de este fix la verificación era
// pura función de los datos del propio token, sin tocar la base.
//
// No metemos el passwordHash (ni un fragmento) en el token en sí — solo se usa como
// material para calcular el HMAC del lado del servidor. El token que viaja en la URL
// nunca expone nada del hash de contraseña de nadie.

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { enviarEmailRecupero } from '@/lib/email'

const DURACION_TOKEN_MS = 30 * 60 * 1000 // 30 minutos

function firmar(payload: string, passwordHash: string) {
  const secreto = process.env.NEXTAUTH_SECRET ?? ''
  return crypto.createHmac('sha256', secreto).update(payload).update(passwordHash).digest('base64url')
}

// Se exportan porque app/api/auth/reset-password/route.ts necesita generar/verificar el
// mismo token acá. No hay un archivo lib/ aparte para esto en la lista de archivos
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

  const usuario = await prisma.usuario.findUnique({ where: { email } })

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
