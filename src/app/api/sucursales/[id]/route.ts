import { sucursalesAdmin } from '../sucursales-admin-api'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sucursalesAdmin.editar(request, id)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sucursalesAdmin.desactivar(request, id)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sucursalesAdmin.activar(request, id)
}