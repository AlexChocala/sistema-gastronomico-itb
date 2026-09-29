import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { consultarReportes, ErrorReporte, leerFiltros, validarPermisos } from '@/lib/reportes/consultas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const sesion = await getServerSession(authOptions)
    if (!sesion) throw new ErrorReporte(401, 'Iniciá sesión para consultar reportes.')

    // Verifica los permisos actuales, aunque la sesión se haya creado antes de un cambio.
    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: sesion.user.idUsuario },
      select: { activo: true, debeCambiarContrasena: true, idSucursal: true, rol: { select: { nombre: true } } },
    })
    if (!usuario?.activo || usuario.debeCambiarContrasena) {
      throw new ErrorReporte(403, 'Tu cuenta no está habilitada para consultar reportes.')
    }
    if (usuario.rol.nombre !== 'admin' && usuario.rol.nombre !== 'supervisor') {
      throw new ErrorReporte(403, 'No tenés permiso para consultar reportes.')
    }
    const filtros = leerFiltros(new URL(request.url).searchParams)
    validarPermisos(usuario.rol.nombre, usuario.idSucursal, filtros)
    return Response.json(await consultarReportes(filtros), { headers })
  } catch (error) {
    if (error instanceof ErrorReporte) {
      return Response.json({ error: error.message }, { status: error.status, headers })
    }
    console.error('No se pudieron consultar los reportes:', error)
    return Response.json({ error: 'No se pudieron cargar los reportes. Intentá nuevamente.' }, { status: 500, headers })
  }
}

