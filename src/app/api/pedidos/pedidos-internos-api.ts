// Controlador compartido por las rutas internas de pedidos (sucursal, caja y [id]).
// La sucursal sale de la sesión: la elegida en el selector (admin) o la asignada (resto).

import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorPedidosInternos } from '@/lib/pedidos/pedidos-internos'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'

export const pedidosInternos = crearControladorPedidosInternos<Session>(
  prisma,
  () => getServerSession(authOptions),
  async (sesion) => (await obtenerSucursalActiva(sesion)).sucursal?.idSucursal ?? null,
)
