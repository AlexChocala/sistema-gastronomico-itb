import { pedidosInternos } from '../../pedidos-internos-api'

export async function POST(request: Request) {
  return pedidosInternos.zonasDelivery(request)
}
