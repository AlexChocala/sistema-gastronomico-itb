import { productosAdmin } from '@/lib/productos/productos-admin-api'

export async function POST(request: Request) {
  return productosAdmin.importar(request)
}
