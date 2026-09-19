import { usuariosAdmin } from '../usuarios-admin-api'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return usuariosAdmin.editar(request, id)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return usuariosAdmin.desactivar(request, id)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return usuariosAdmin.activar(request, id)
}