// Alta de un pedido cobrado en Caja (con sesión).
import { pedidosInternos } from '../pedidos-internos-api'

// Estado para habilitar el cobro; POST vuelve a verificarlo dentro de la transacción.
export async function GET(request: Request) {
  return pedidosInternos.permisoCaja(request)
}

export async function POST(request: Request) {
  return pedidosInternos.crearCaja(request)
}
