// Sucursal con la que trabaja la pantalla actual (panel, Caja y Cocina).
//
// - Empleado y supervisor: SIEMPRE la sucursal asignada a su usuario. Se lee de la base
//   (no del token de sesión) para que un cambio de sucursal hecho por un admin se vea
//   en la próxima carga, sin tener que cerrar sesión.
// - Admin: la que eligió en el selector del sidebar (cookie). Si no eligió ninguna o la
//   elegida ya no está activa, la suya propia o, en su defecto, la primera activa.
//
// Solo corre en el servidor: la cookie la escribe la Server Action `elegirSucursal`.

import { cookies } from 'next/headers'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

export const COOKIE_SUCURSAL_ACTIVA = 'sucursal-activa'

export type OpcionSucursal = { idSucursal: number; nombre: string }

export type SucursalActiva = {
  // null: el usuario no tiene sucursal asignada (o no hay ninguna activa).
  sucursal: OpcionSucursal | null
  // Solo el admin puede cambiar de sucursal.
  puedeElegir: boolean
  // Opciones del selector (vacío si no puede elegir).
  opciones: OpcionSucursal[]
}

export async function obtenerSucursalActiva(sesion: Session): Promise<SucursalActiva> {
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: {
      rol: { select: { nombre: true } },
      sucursal: { select: { idSucursal: true, nombre: true } },
    },
  })

  if (usuario?.rol.nombre !== 'admin') {
    return { sucursal: usuario?.sucursal ?? null, puedeElegir: false, opciones: [] }
  }

  const opciones = await prisma.sucursal.findMany({
    where: { activa: true },
    select: { idSucursal: true, nombre: true },
    orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
  })
  const elegida = Number((await cookies()).get(COOKIE_SUCURSAL_ACTIVA)?.value)
  const sucursal =
    opciones.find((opcion) => opcion.idSucursal === elegida) ??
    opciones.find((opcion) => opcion.idSucursal === usuario.sucursal?.idSucursal) ??
    opciones[0] ??
    null

  return { sucursal, puedeElegir: true, opciones }
}
