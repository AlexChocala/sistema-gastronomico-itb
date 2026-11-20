// Ayudas compartidas por las rutas de Caja y turnos (solo servidor): respuestas JSON,
// errores, control de origen y lectura de la persona con sesión.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'
import { ErrorSucursal, idValido } from '@/lib/sucursales/sucursales-validacion'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'

export function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

export function responderError(error: unknown) {
  if (error instanceof ErrorPedido) return responder({ error: error.message, ...error.extra }, error.estado)
  if (error instanceof ErrorSucursal) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2034') return responder({ error: 'Otra operación se cruzó con esta. Intentá nuevamente.' }, 409)
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

export function mismoOrigen(request: Request) {
  const origen = request.headers.get('origin')
  return !((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
}

export type Personal = { idUsuario: number; idSucursal: number; rol: string }

// Persona con sesión que opera una sucursal: la sucursal sale de la sesión, nunca del cliente.
// `escritura` exige además el mismo origen. El administrador solo mira, no cobra ni cambia.
export async function conPersonal(
  request: Request,
  { escritura, permitirAdmin = false }: { escritura: boolean; permitirAdmin?: boolean },
  accion: (personal: Personal) => Promise<Response>,
) {
  try {
    const sesion = await getServerSession(authOptions)
    if (!sesion || !idValido(sesion.user?.idUsuario)) throw new ErrorPedido(401, 'Iniciá sesión para continuar.')
    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: sesion.user.idUsuario },
      select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
    })
    if (!usuario?.activo) throw new ErrorPedido(403, 'El usuario no está habilitado.')
    if (usuario.debeCambiarContrasena) throw new ErrorPedido(403, 'Primero tenés que cambiar tu contraseña.')
    if (escritura && !mismoOrigen(request)) throw new ErrorPedido(403, 'La solicitud debe realizarse desde esta aplicación.')
    if (usuario.rol.nombre === 'admin' && !permitirAdmin) {
      throw new ErrorPedido(403, 'El administrador puede ver, pero no operar la caja.')
    }
    const idSucursal = (await obtenerSucursalActiva(sesion)).sucursal?.idSucursal ?? null
    if (idSucursal === null) throw new ErrorPedido(400, 'Tu usuario no tiene una sucursal asignada.')
    return await accion({ idUsuario: sesion.user.idUsuario, idSucursal, rol: usuario.rol.nombre })
  } catch (error) {
    return responderError(error)
  }
}
