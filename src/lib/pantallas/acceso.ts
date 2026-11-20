// Acceso propio de las pantallas (Cocina, Entregas, Mostrador): un equipo de la sucursal queda
// "enlazado" una vez, con un link con código al azar, y no depende de la sesión de ninguna
// persona. En la base solo se guarda el hash del código; el link completo se ve una sola vez,
// al generarlo. El administrador puede revocarlo. Solo servidor.

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { PrismaClient } from '@prisma/client'

// Solo las pantallas sin dinero: Cocina y la pantalla del cliente. Caja y Entregas piden sesión
// (ahí se cobra efectivo). Un acceso viejo de otro tipo ya no es válido.
export type TipoPantalla = 'cocina' | 'mostrador'
export const TIPOS_PANTALLA: readonly TipoPantalla[] = ['cocina', 'mostrador']
export const COOKIE_ACCESO_PANTALLA = 'acceso-pantalla'
export const RUTA_PANTALLA: Record<TipoPantalla, string> = {
  cocina: '/pantallas/cocina',
  mostrador: '/pantallas/pedidos-mostrador',
}

export type AccesoPantalla = { idAcceso: number; idSucursal: number; tipo: TipoPantalla }

const hashDe = (codigo: string) => createHash('sha256').update(codigo).digest('hex')

export function esTipoPantalla(valor: unknown): valor is TipoPantalla {
  return typeof valor === 'string' && (TIPOS_PANTALLA as readonly string[]).includes(valor)
}

// Devuelve el código en claro: es la única vez que existe.
export async function generarAcceso(db: PrismaClient, idSucursal: number, tipo: TipoPantalla) {
  const codigo = randomBytes(24).toString('base64url')
  await db.accesoPantalla.create({ data: { idSucursal, tipo, tokenHash: hashDe(codigo) } })
  return codigo
}

export async function buscarAcceso(db: PrismaClient, codigo: string): Promise<AccesoPantalla | null> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(codigo)) return null
  const acceso = await db.accesoPantalla.findFirst({
    where: { tokenHash: hashDe(codigo), revocadoEn: null, sucursal: { activa: true } },
    select: { idAcceso: true, idSucursal: true, tipo: true },
  })
  return acceso && esTipoPantalla(acceso.tipo) ? { ...acceso, tipo: acceso.tipo } : null
}

// El equipo enlazado: se lee de la cookie que dejó /p/{código}. Se vuelve a comprobar contra
// la base cada vez, así revocar un acceso lo corta enseguida.
export async function accesoDeEsteEquipo(db: PrismaClient, tiposPermitidos?: readonly TipoPantalla[]): Promise<AccesoPantalla | null> {
  const codigo = (await cookies()).get(COOKIE_ACCESO_PANTALLA)?.value
  if (!codigo) return null
  const acceso = await buscarAcceso(db, codigo)
  if (!acceso || (tiposPermitidos && !tiposPermitidos.includes(acceso.tipo))) return null
  return acceso
}

export async function listarAccesos(db: PrismaClient, idSucursal: number) {
  return db.accesoPantalla.findMany({
    where: { idSucursal, revocadoEn: null },
    orderBy: { idAcceso: 'asc' },
    select: { idAcceso: true, tipo: true, creadoEn: true },
  })
}

export async function revocarAcceso(db: PrismaClient, idSucursal: number, idAcceso: number) {
  const { count } = await db.accesoPantalla.updateMany({ where: { idAcceso, idSucursal, revocadoEn: null }, data: { revocadoEn: new Date() } })
  return count > 0
}
