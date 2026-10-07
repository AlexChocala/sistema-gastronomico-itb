import { usuariosAdmin } from '../../usuarios-admin-api'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return usuariosAdmin.quitarFotoPerfil(request, id)
}
