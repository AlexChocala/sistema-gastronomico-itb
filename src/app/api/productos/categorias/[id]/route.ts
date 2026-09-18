import { productosAdmin } from '@/lib/productos-admin-api'

type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, contexto: Contexto) {
  return productosAdmin.editarCategoria(request, (await contexto.params).id)
}

export async function DELETE(request: Request, contexto: Contexto) {
  return productosAdmin.desactivarCategoria(request, (await contexto.params).id)
}
