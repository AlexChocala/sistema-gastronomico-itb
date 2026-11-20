// Horario y pausa de pedidos online de una sucursal. Solo el administrador.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { responder, responderError, mismoOrigen } from '@/lib/caja/http'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'
import { leerCuerpo, leerId } from '@/lib/sucursales/sucursales-validacion'
import { MAX_FRANJAS_POR_DIA, franjaValida, franjasSinSolapar, type Franja } from '@/lib/sucursales/horario-online'
import { textoHorario } from '@/lib/sucursales/horario-bloques'

async function exigirAdmin() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) throw new ErrorPedido(401, 'Iniciá sesión para continuar.')
  const usuario = await prisma.usuario.findUnique({ where: { idUsuario: sesion.user.idUsuario }, select: { activo: true, rol: { select: { nombre: true } } } })
  if (!usuario?.activo || usuario.rol.nombre !== 'admin') throw new ErrorPedido(403, 'Solo el administrador puede cambiar el horario.')
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirAdmin()
    const idSucursal = leerId((await params).id)
    const sucursal = await prisma.sucursal.findUnique({
      where: { idSucursal },
      select: { pausaPedidosOnline: true, horarios: { select: { diaSemana: true, abreMin: true, cierraMin: true }, orderBy: [{ diaSemana: 'asc' }, { abreMin: 'asc' }] } },
    })
    if (!sucursal) throw new ErrorPedido(404, 'No encontramos esa sucursal.')
    return responder(sucursal)
  } catch (error) {
    return responderError(error)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirAdmin()
    if (!mismoOrigen(request)) throw new ErrorPedido(403, 'La solicitud debe realizarse desde esta aplicación.')
    const idSucursal = leerId((await params).id)
    const cuerpo = (await leerCuerpo(request)) as { pausaPedidosOnline?: unknown; horarios?: unknown }
    if (typeof cuerpo.pausaPedidosOnline !== 'boolean') throw new ErrorPedido(400, 'Indicá si los pedidos online están pausados.')
    if (!Array.isArray(cuerpo.horarios) || cuerpo.horarios.length > 7 * MAX_FRANJAS_POR_DIA) throw new ErrorPedido(400, 'El horario no es válido.')
    const franjas: Franja[] = cuerpo.horarios.map((f: Franja) => ({ diaSemana: f?.diaSemana, abreMin: f?.abreMin, cierraMin: f?.cierraMin }))
    if (!franjas.every(franjaValida) || !franjasSinSolapar(franjas)) throw new ErrorPedido(400, 'Revisá el horario: hay horas inválidas o franjas que se pisan.')

    await prisma.$transaction(async (tx) => {
      // El texto que ve el cliente en la carta sale del horario: así no se pueden contradecir.
      await tx.sucursal.update({ where: { idSucursal }, data: { pausaPedidosOnline: cuerpo.pausaPedidosOnline as boolean, horario: textoHorario(franjas) } })
      await tx.horarioSucursal.deleteMany({ where: { idSucursal } })
      if (franjas.length > 0) await tx.horarioSucursal.createMany({ data: franjas.map((f) => ({ ...f, idSucursal })) })
    })
    return responder({ mensaje: 'Horario guardado.' })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return responder({ error: 'No encontramos esa sucursal.' }, 404)
    }
    return responderError(error)
  }
}
