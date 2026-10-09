import { negocioAdmin } from '../negocio-admin-api'

export async function POST(request: Request) {
  return negocioAdmin.subirLogo(request)
}

export async function DELETE(request: Request) {
  return negocioAdmin.quitarLogo(request)
}
