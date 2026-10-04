import { usuariosAdmin } from '../usuarios-admin-api'

export async function POST(request: Request) {
  return usuariosAdmin.importar(request)
}
