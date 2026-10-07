// Alta de un pedido cobrado en Caja (con sesión).
import { pedidosInternos } from '../pedidos-internos-api'

export async function POST(request: Request) {
  return pedidosInternos.crearCaja(request)
}
