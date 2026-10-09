import { productosAdmin } from '@/lib/productos/productos-admin-api'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return productosAdmin.subirImagen(request, id)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return productosAdmin.quitarImagen(request, id)
}
