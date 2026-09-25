import { sucursalesAdmin } from './sucursales-admin-api'

export async function GET(request: Request) {
  return sucursalesAdmin.listar(request)
}

export async function POST(request: Request) {
  return sucursalesAdmin.crear(request)
}