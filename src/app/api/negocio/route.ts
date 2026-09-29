import { negocioAdmin } from './negocio-admin-api'

export async function GET(request: Request) {
  return negocioAdmin.obtener(request)
}

export async function PATCH(request: Request) {
  return negocioAdmin.editar(request)
}
