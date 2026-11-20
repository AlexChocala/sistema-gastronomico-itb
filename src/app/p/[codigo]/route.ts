// Link de acceso de una pantalla: /p/{código}. Si el código es válido, deja una cookie en este
// equipo y lo lleva a la pantalla. Desde ahí la pantalla funciona sin iniciar sesión.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { COOKIE_ACCESO_PANTALLA, RUTA_PANTALLA, buscarAcceso } from '@/lib/pantallas/acceso'

export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const acceso = await buscarAcceso(prisma, codigo)
  if (!acceso) return new NextResponse('Este link no es válido o fue revocado.', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const respuesta = NextResponse.redirect(new URL(RUTA_PANTALLA[acceso.tipo], request.url))
  respuesta.cookies.set(COOKIE_ACCESO_PANTALLA, codigo, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  respuesta.headers.set('Cache-Control', 'no-store')
  return respuesta
}
