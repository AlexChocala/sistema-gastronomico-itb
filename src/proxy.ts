// Reemplaza a middleware.ts: desde Next.js 16 el archivo se renombró a "proxy" (también
// cambia el nombre de la función exportada, de `middleware` a `proxy`), aunque el
// comportamiento es el mismo: código que corre en el servidor antes de resolver la ruta.
// Referencia: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// Acá lo usamos para bloquear el panel interno (app/(panel)/...) a quien no tenga sesión.
//
// Importante: (panel) es un "route group" de Next.js — las carpetas entre paréntesis no
// forman parte de la URL. Por eso el matcher no puede usar "/panel/*"; tiene que listar
// los segmentos reales que cuelgan de (panel) (dashboard, pedidos, productos, etc.), tal
// como aparecen en la estructura del proyecto. Tampoco se puede usar un matcher negativo
// tipo "todo menos /acceso y /api", porque la home ("/") y "/[sucursal]/*" (la carta
// pública) también viven fuera de (panel) y tienen que quedar accesibles sin login.
// Si el equipo agrega una carpeta nueva dentro de (panel), hay que sumar su segmento acá.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    const loginUrl = new URL('/acceso/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Administrar cuentas es solo para admin; la asistencia del personal también admite supervisores. Configuración permite a todos elegir su apariencia;
  // la página y las APIs reservan los datos del negocio al administrador.
  const pathname = request.nextUrl.pathname
  const esAsistencia = pathname === '/usuarios/asistencia' || pathname.startsWith('/usuarios/asistencia/')
  if (esAsistencia && !['admin', 'supervisor'].includes(token.rol)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  const soloAdmin = !esAsistencia && ['/usuarios'].some((ruta) => pathname === ruta || pathname.startsWith(ruta + '/'))
  if (soloAdmin && token.rol !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Caja y Cocina son para quien opera la sucursal: el admin solo ve los pedidos, para
  // que no cargue ni mueva uno por error (por ejemplo, con otra sucursal activa). La API
  // de pedidos también lo valida.
  const esPantallaOperativa = ['/pantallas/caja', '/pantallas/cocina', '/pantallas/entregas'].some((ruta) => pathname === ruta || pathname.startsWith(ruta + '/'))
  if (esPantallaOperativa && token.rol === 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/pedidos/:path*',
    '/productos/:path*',
    '/usuarios/:path*',
    '/sucursales/:path*',
    '/reportes/:path*',
    '/perfil/:path*',
    '/configuracion/:path*',
    // Pantallas de pestaña aparte. Pedidos Mostrador queda afuera a propósito: es pública.
    '/pantallas/caja/:path*',
    '/pantallas/cocina/:path*',
    '/pantallas/entregas/:path*',
    // Asistente de primera configuración (fuera de (panel), pero también requiere sesión).
    '/configuracion-inicial/:path*',
  ],
}
