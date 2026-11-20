// Cerrar una caja con arqueo: efectivo contado y PIN de quien cierra (puede ser otra persona
// que quien abrió). Devuelve lo esperado, lo contado y la diferencia.
import { prisma } from '@/lib/db/prisma'
import { identificarPorPin } from '@/lib/caja/pin'
import { cajasDeSucursal, cerrarTurno } from '@/lib/caja/turnos'
import { conPersonal, responder } from '@/lib/caja/http'
import { idValido, leerCuerpo } from '@/lib/sucursales/sucursales-validacion'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'

export async function POST(request: Request) {
  return conPersonal(request, { escritura: true }, async ({ idUsuario, idSucursal }) => {
    const cuerpo = (await leerCuerpo(request)) as { idCaja?: unknown; efectivoContado?: unknown; observacion?: unknown; pin?: unknown }
    if (!idValido(cuerpo.idCaja)) throw new ErrorPedido(400, 'Elegí la caja.')
    const responsable = await identificarPorPin(prisma, { idUsuario, idSucursal }, cuerpo.pin)
    const resumen = await cerrarTurno(prisma, {
      idSucursal, idCaja: cuerpo.idCaja, efectivoContado: cuerpo.efectivoContado, observacion: cuerpo.observacion, idUsuario: responsable,
    })
    return responder({ resumen, cajas: await cajasDeSucursal(prisma, idSucursal) })
  })
}
