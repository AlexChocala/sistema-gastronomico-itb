import { productosAdmin } from '@/lib/productos/productos-admin-api'

export async function GET(request: Request) {
  return productosAdmin.listarExtras(request)
}

export async function POST(request: Request) {
  return productosAdmin.crearExtra(request)
}