import { productosAdmin } from '@/lib/productos/productos-admin-api'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return productosAdmin.historialPrecios(request, (await params).id)
}
