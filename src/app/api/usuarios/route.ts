import { usuariosAdmin } from './usuarios-admin-api'

export async function GET(request: Request) {
  return usuariosAdmin.listar(request)
}

export async function POST(request: Request) {
  return usuariosAdmin.crear(request)
}