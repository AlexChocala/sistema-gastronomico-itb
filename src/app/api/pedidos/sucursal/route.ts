// Pedidos de la sucursal activa, para Cocina, Pedidos y el Dashboard (con sesión).
import { pedidosInternos } from '../pedidos-internos-api'

export async function GET(request: Request) {
  return pedidosInternos.listar(request)
}
