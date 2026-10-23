import { sucursalesAdmin } from '../sucursales-admin-api'

export async function POST(request: Request) {
  return sucursalesAdmin.localidadesCercanas(request)
}
