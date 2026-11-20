// Estado de las cajas de la sucursal: cuáles están abiertas y desde cuándo.
import { prisma } from '@/lib/db/prisma'
import { cajasDeSucursal, pedidosPorCobrar } from '@/lib/caja/turnos'
import { conPersonal, responder } from '@/lib/caja/http'
import { accesoDeEsteEquipo } from '@/lib/pantallas/acceso'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

export async function GET(request: Request) {
  // Las pantallas enlazadas (sin sesión) solo necesitan saber si hay caja abierta.
  if (!(await getServerSession(authOptions))) {
    const acceso = await accesoDeEsteEquipo(prisma, ['cocina', 'mostrador'])
    if (acceso) return responder({ cajas: await cajasDeSucursal(prisma, acceso.idSucursal), porCobrar: 0 })
  }
  return conPersonal(request, { escritura: false, permitirAdmin: true }, async ({ idSucursal }) =>
    responder({ cajas: await cajasDeSucursal(prisma, idSucursal), porCobrar: await pedidosPorCobrar(prisma, idSucursal) }))
}
