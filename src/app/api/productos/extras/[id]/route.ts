import { productosAdmin } from '@/lib/productos/productos-admin-api'

type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params
  return productosAdmin.editarExtra(request, id)
}

export async function DELETE(request: Request, { params }: Contexto) {
  const { id } = await params
  return productosAdmin.desactivarExtra(request, id)
}