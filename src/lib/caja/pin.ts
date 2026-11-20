// PIN de 4 números de cada empleado: identifica quién cobra en Caja y en "Entregado y
// cobrado". No se guarda el PIN sino su HMAC con una clave del servidor (Usuario.pinClave,
// único): dos personas no pueden tener el mismo PIN y, al escribirlo, se sabe de quién es.
// Solo servidor.

import { createHmac } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'
import { MENSAJE_PIN, pinValido } from './pin-formato'

export const MENSAJE_PIN_EN_USO = 'Ese PIN ya está en uso. Elegí otro.'
export const MAX_PIN_FALLIDOS = 5
export const MINUTOS_BLOQUEO_PIN = 5

export function clavePin(pin: string) {
  const secreto = process.env.NEXTAUTH_SECRET
  if (!secreto) throw new Error('Falta NEXTAUTH_SECRET.')
  return createHmac('sha256', secreto).update(`pin:${pin}`).digest('hex')
}

// La persona elige su propio PIN. Si ya lo tiene otra, la base lo rechaza (índice único).
export async function guardarPin(db: PrismaClient, idUsuario: number, pin: unknown) {
  if (!pinValido(pin)) throw new ErrorPedido(400, MENSAJE_PIN)
  try {
    await db.usuario.update({
      where: { idUsuario },
      data: { pinClave: clavePin(pin), pinIntentosFallidos: 0, pinBloqueadoHasta: null },
    })
  } catch (error) {
    const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
    if (codigo === 'P2002') throw new ErrorPedido(409, MENSAJE_PIN_EN_USO)
    throw error
  }
}

// Devuelve el idUsuario dueño del PIN. Se llama ANTES de abrir la transacción del cobro (con
// el cliente normal): un PIN equivocado tiene que quedar contado aunque el cobro no siga.
// Como no se sabe de quién era el PIN que se probó, los fallos se cuentan sobre la persona
// que tiene la sesión abierta en Caja y, pasado el límite, se bloquea unos minutos.
// Una pantalla enlazada (Entregas) no tiene sesión: ahí `idUsuario` es null y los PIN
// equivocados se cuentan por sucursal, en memoria (parcial en Vercel, como el login de emails
// inexistentes).
const fallosPorSucursal = new Map<number, { fallos: number; bloqueadoHasta: number }>()

async function identificarSinSesion(db: PrismaClient, idSucursal: number, pin: string): Promise<number> {
  const registro = fallosPorSucursal.get(idSucursal) ?? { fallos: 0, bloqueadoHasta: 0 }
  if (registro.bloqueadoHasta > Date.now()) throw new ErrorPedido(429, `Demasiados PIN incorrectos. Esperá ${MINUTOS_BLOQUEO_PIN} minutos.`)
  const dueno = await db.usuario.findFirst({
    where: { pinClave: clavePin(pin), activo: true, idSucursal, rol: { nombre: { in: ['empleado', 'supervisor'] } } },
    select: { idUsuario: true },
  })
  if (!dueno) {
    const fallos = registro.fallos + 1
    fallosPorSucursal.set(idSucursal, fallos >= MAX_PIN_FALLIDOS
      ? { fallos: 0, bloqueadoHasta: Date.now() + MINUTOS_BLOQUEO_PIN * 60 * 1000 }
      : { fallos, bloqueadoHasta: 0 })
    throw new ErrorPedido(401, 'PIN incorrecto.')
  }
  fallosPorSucursal.delete(idSucursal)
  return dueno.idUsuario
}

export async function identificarPorPin(
  db: PrismaClient,
  sesion: { idUsuario: number | null; idSucursal: number },
  pin: unknown,
): Promise<number> {
  if (!pinValido(pin)) throw new ErrorPedido(400, MENSAJE_PIN)
  if (sesion.idUsuario === null) return identificarSinSesion(db, sesion.idSucursal, pin)
  const idSesion = sesion.idUsuario

  const sesionActual = await db.usuario.findUnique({ where: { idUsuario: idSesion }, select: { pinBloqueadoHasta: true } })
  if (sesionActual?.pinBloqueadoHasta && sesionActual.pinBloqueadoHasta > new Date()) {
    throw new ErrorPedido(429, `Demasiados PIN incorrectos. Esperá ${MINUTOS_BLOQUEO_PIN} minutos.`)
  }

  const dueno = await db.usuario.findFirst({
    where: {
      pinClave: clavePin(pin), activo: true, idSucursal: sesion.idSucursal,
      rol: { nombre: { in: ['empleado', 'supervisor'] } },
    },
    select: { idUsuario: true },
  })

  if (!dueno) {
    const { pinIntentosFallidos } = await db.usuario.update({
      where: { idUsuario: idSesion },
      data: { pinIntentosFallidos: { increment: 1 } },
      select: { pinIntentosFallidos: true },
    })
    if (pinIntentosFallidos >= MAX_PIN_FALLIDOS) {
      await db.usuario.update({
        where: { idUsuario: idSesion },
        data: { pinIntentosFallidos: 0, pinBloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO_PIN * 60 * 1000) },
      })
    }
    throw new ErrorPedido(401, 'PIN incorrecto.')
  }

  if (sesionActual) await db.usuario.update({ where: { idUsuario: idSesion }, data: { pinIntentosFallidos: 0 } })
  return dueno.idUsuario
}
