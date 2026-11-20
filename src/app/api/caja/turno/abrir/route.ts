// Abrir una caja: monto inicial y PIN de quien la abre (queda como responsable del turno).
import { prisma } from '@/lib/db/prisma'
import { identificarPorPin } from '@/lib/caja/pin'
import { abrirTurno, cajasDeSucursal } from '@/lib/caja/turnos'
import { conPersonal, responder } from '@/lib/caja/http'
import { idValido, leerCuerpo } from '@/lib/sucursales/sucursales-validacion'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'

export async function POST(request: Request) {
  return conPersonal(request, { escritura: true }, async ({ idUsuario, idSucursal }) => {
    const cuerpo = (await leerCuerpo(request)) as { idCaja?: unknown; montoInicial?: unknown; pin?: unknown }
    if (!idValido(cuerpo.idCaja)) throw new ErrorPedido(400, 'Elegí la caja.')
    const responsable = await identificarPorPin(prisma, { idUsuario, idSucursal }, cuerpo.pin)
    await abrirTurno(prisma, { idSucursal, idCaja: cuerpo.idCaja, montoInicial: cuerpo.montoInicial, idUsuario: responsable })
    return responder({ cajas: await cajasDeSucursal(prisma, idSucursal) }, 201)
  })
}
