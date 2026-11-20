// La persona elige o cambia su PIN de caja (solo el suyo: sale de la sesión).
import { prisma } from '@/lib/db/prisma'
import { guardarPin } from '@/lib/caja/pin'
import { conPersonal, responder } from '@/lib/caja/http'
import { leerCuerpo } from '@/lib/sucursales/sucursales-validacion'

export async function PUT(request: Request) {
  return conPersonal(request, { escritura: true }, async ({ idUsuario }) => {
    const cuerpo = await leerCuerpo(request)
    await guardarPin(prisma, idUsuario, (cuerpo as { pin?: unknown })?.pin)
    return responder({ mensaje: 'PIN guardado.' })
  })
}
