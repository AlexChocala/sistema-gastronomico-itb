// Monitor de Pedidos Mostrador. Pública a propósito (sin sesión): el proxy no la cubre.
// Devuelve solo número, nombre de pila y estado (ver lib/pedidos/pedidos-internos.ts).

import { prisma } from '@/lib/db/prisma'
import { crearControladorMostrador } from '@/lib/pedidos/pedidos-internos'

const mostrador = crearControladorMostrador(prisma)

export async function GET(request: Request) {
  return mostrador.listar(request)
}
