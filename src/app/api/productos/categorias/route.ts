import { productosAdmin } from '@/lib/productos-admin-api'

export async function GET(request: Request) {
  return productosAdmin.listarCategorias(request)
}

export async function POST(request: Request) {
  return productosAdmin.crearCategoria(request)
}
