// Pedido desde el menú digital. Pública a propósito (sin sesión): el proxy no la cubre.
// Toda la lógica y los controles están en lib/pedidos/pedidos-online.ts.

import { prisma } from '@/lib/db/prisma'
import { crearControladorPedidosOnline } from '@/lib/pedidos/pedidos-online'

const pedidosOnline = crearControladorPedidosOnline(prisma)

export async function POST(request: Request) {
  return pedidosOnline.crear(request)
}
