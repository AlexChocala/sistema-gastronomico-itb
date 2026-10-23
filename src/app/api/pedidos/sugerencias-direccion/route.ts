import { prisma } from '@/lib/db/prisma'
import { crearControladorPedidosOnline } from '@/lib/pedidos/pedidos-online'

const controlador = crearControladorPedidosOnline(prisma)
export async function POST(request: Request) {
  return controlador.sugerirDirecciones(request)
}
