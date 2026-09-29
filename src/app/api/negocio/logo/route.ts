import { negocioAdmin } from '../negocio-admin-api'

// La subida (POST) se suma cuando se conecte Supabase Storage, junto con la de la foto de perfil.
export async function DELETE(request: Request) {
  return negocioAdmin.quitarLogo(request)
}
