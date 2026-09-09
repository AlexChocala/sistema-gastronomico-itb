import { productosAdmin } from '@/lib/productos-admin-api'

// Administración privada; la carta pública sigue en /api/productos?idSucursal=...
export async function GET(request: Request) {
  return productosAdmin.listar(request)
}

export async function POST(request: Request) {
  return productosAdmin.crear(request)
}
