// Cambio de estado, "Deshacer" o cambio de tipo de entrega de un pedido (con sesión).
import { pedidosInternos } from '../pedidos-internos-api'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return pedidosInternos.actualizar(request, id)
}
