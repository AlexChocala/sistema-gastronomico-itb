import { usuariosAdmin } from '../../usuarios-admin-api'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return usuariosAdmin.restablecerContrasena(request, id)
}
