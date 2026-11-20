// Monitor de Pedidos Mostrador. Sin sesión de persona: lo ve el equipo enlazado con el link
// de acceso (código al azar) o el personal con sesión. La sucursal sale de ahí, no de la URL.
// Devuelve solo número, nombre de pila y estado (ver lib/pedidos/pedidos-internos.ts).

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorMostrador } from '@/lib/pedidos/pedidos-internos'
import { accesoDeEsteEquipo } from '@/lib/pantallas/acceso'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'

const mostrador = crearControladorMostrador(prisma)

export async function GET() {
  const acceso = await accesoDeEsteEquipo(prisma, ['mostrador'])
  if (acceso) return mostrador.listar(acceso.idSucursal)
  const sesion = await getServerSession(authOptions)
  return mostrador.listar(sesion ? (await obtenerSucursalActiva(sesion)).sucursal?.idSucursal ?? null : null)
}
