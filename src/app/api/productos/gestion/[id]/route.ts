import { productosAdmin } from '@/lib/productos-admin-api'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: Request, contexto: Contexto) {
  return productosAdmin.obtener(request, (await contexto.params).id)
}

export async function PATCH(request: Request, contexto: Contexto) {
  return productosAdmin.editar(request, (await contexto.params).id)
}

export async function DELETE(request: Request, contexto: Contexto) {
  return productosAdmin.desactivar(request, (await contexto.params).id)
}
