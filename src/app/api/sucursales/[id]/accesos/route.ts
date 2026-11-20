// Links de acceso de las pantallas de una sucursal (Cocina, Entregas, Mostrador). Solo el
// administrador. El link completo se devuelve una sola vez, al generarlo.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { mismoOrigen, responder, responderError } from '@/lib/caja/http'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'
import { idValido, leerCuerpo, leerId } from '@/lib/sucursales/sucursales-validacion'
import { esTipoPantalla, generarAcceso, listarAccesos, revocarAcceso } from '@/lib/pantallas/acceso'

async function exigirAdmin(request: Request, escritura: boolean) {
  const sesion = await getServerSession(authOptions)
  if (!sesion) throw new ErrorPedido(401, 'Iniciá sesión para continuar.')
  const usuario = await prisma.usuario.findUnique({ where: { idUsuario: sesion.user.idUsuario }, select: { activo: true, rol: { select: { nombre: true } } } })
  if (!usuario?.activo || usuario.rol.nombre !== 'admin') throw new ErrorPedido(403, 'Solo el administrador puede manejar los accesos.')
  if (escritura && !mismoOrigen(request)) throw new ErrorPedido(403, 'La solicitud debe realizarse desde esta aplicación.')
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirAdmin(request, false)
    return responder({ accesos: await listarAccesos(prisma, leerId((await params).id)) })
  } catch (error) {
    return responderError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirAdmin(request, true)
    const idSucursal = leerId((await params).id)
    const { tipo } = (await leerCuerpo(request)) as { tipo?: unknown }
    if (!esTipoPantalla(tipo)) throw new ErrorPedido(400, 'Elegí la pantalla.')
    const sucursal = await prisma.sucursal.findFirst({ where: { idSucursal, activa: true }, select: { idSucursal: true } })
    if (!sucursal) throw new ErrorPedido(404, 'No encontramos esa sucursal.')
    const codigo = await generarAcceso(prisma, idSucursal, tipo)
    return responder({ link: `${new URL(request.url).origin}/p/${codigo}` }, 201)
  } catch (error) {
    return responderError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirAdmin(request, true)
    const idSucursal = leerId((await params).id)
    const { idAcceso } = (await leerCuerpo(request)) as { idAcceso?: unknown }
    if (!idValido(idAcceso)) throw new ErrorPedido(400, 'Indicá el acceso.')
    if (!(await revocarAcceso(prisma, idSucursal, idAcceso))) throw new ErrorPedido(404, 'No encontramos ese acceso.')
    return responder({ mensaje: 'Acceso revocado.' })
  } catch (error) {
    return responderError(error)
  }
}
