// Alta de la configuración inicial: datos del negocio + primeras sucursales, todo en una
// sola transacción (o se guarda todo, o nada). Solo admin, y solo mientras el negocio
// no exista todavía.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { ErrorConfiguracion, validarNegocioInicial } from '@/lib/negocio/negocio-validacion'
import { ErrorSucursal, MAX_SUCURSALES, idValido, leerCuerpo } from '@/lib/sucursales/sucursales-validacion'
import { crearSucursalEnTransaccion, verificarTopeSucursales } from '@/lib/sucursales/sucursales-administracion'

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorConfiguracion || error instanceof ErrorSucursal) {
    return responder({ error: error.message }, error.estado)
  }
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2003') return responder({ error: 'Alguna de las localidades elegidas no existe.' }, 400)
  // P2002: otra carga simultánea creó el mismo registro. P2034: conflicto de la transacción serializable.
  if (codigo === 'P2002' || codigo === 'P2034') {
    return responder({ error: 'Otra operación se cruzó con esta. Intentá nuevamente.' }, 409)
  }
  return responder({ error: 'No se pudo completar la configuración. Intentá nuevamente más tarde.' }, 500)
}

// Misma protección que la administración de sucursales: sesión, admin activo, contraseña
// ya cambiada y solicitud desde esta misma aplicación.
async function verificarAcceso(request: Request) {
  const sesion = await getServerSession(authOptions)
  if (!sesion || !idValido(sesion.user?.idUsuario)) {
    throw new ErrorConfiguracion(401, 'Iniciá sesión para configurar el sistema.')
  }
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
  })
  if (!usuario?.activo || usuario.rol.nombre !== 'admin') {
    throw new ErrorConfiguracion(403, 'Solo un administrador puede configurar el sistema.')
  }
  if (usuario.debeCambiarContrasena) {
    throw new ErrorConfiguracion(403, 'Primero tenés que cambiar tu contraseña.')
  }
  const origen = request.headers.get('origin')
  if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ErrorConfiguracion(403, 'La solicitud debe realizarse desde esta aplicación.')
  }
}

// Forma general del cuerpo: { negocio: {...}, sucursales: [...] }. El contenido de cada
// sucursal lo valida crearSucursalEnTransaccion, igual que en el alta de Sucursales.
function leerConfiguracion(cuerpo: unknown) {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorConfiguracion(400, 'Enviá un objeto JSON con los datos de la configuración.')
  }
  const datos = cuerpo as Record<string, unknown>
  if (Object.keys(datos).some((c) => c !== 'negocio' && c !== 'sucursales')) {
    throw new ErrorConfiguracion(400, 'Enviá solo los datos del negocio y la lista de sucursales.')
  }
  if (!Array.isArray(datos.sucursales)) {
    throw new ErrorConfiguracion(400, 'Las sucursales deben enviarse como una lista.')
  }
  if (datos.sucursales.length > MAX_SUCURSALES) {
    throw new ErrorConfiguracion(400, `Podés cargar hasta ${MAX_SUCURSALES} sucursales.`)
  }
  return { negocio: datos.negocio, sucursales: datos.sucursales as unknown[] }
}

export async function POST(request: Request) {
  try {
    await verificarAcceso(request)
    const { negocio, sucursales } = leerConfiguracion(await leerCuerpo(request))

    await prisma.$transaction(async (tx) => {
      // Se revisa adentro de la transacción serializable: dos envíos simultáneos no
      // pueden configurar el sistema dos veces.
      if (await tx.negocio.findUnique({ where: { idNegocio: 1 }, select: { idNegocio: true } })) {
        throw new ErrorConfiguracion(409, 'El sistema ya está configurado.')
      }
      const datosNegocio = validarNegocioInicial(negocio)
      await verificarTopeSucursales(tx, sucursales.length)

      await tx.negocio.create({ data: { idNegocio: 1, ...datosNegocio } })

      for (const [indice, sucursal] of sucursales.entries()) {
        try {
          await crearSucursalEnTransaccion(tx, sucursal)
        } catch (error) {
          // Se indica cuál sucursal falló para que el formulario pueda señalarla.
          if (error instanceof ErrorSucursal) {
            throw new ErrorSucursal(error.estado, `Sucursal ${indice + 1}: ${error.message}`)
          }
          throw error
        }
      }

      // Puede no venir ninguna sucursal nueva si ya había activas; pero al terminar
      // tiene que quedar al menos una activa, si no el sistema sigue sin configurar.
      if (await tx.sucursal.count({ where: { activa: true } }) < 1) {
        throw new ErrorConfiguracion(400, 'Cargá al menos una sucursal.')
      }
    }, { isolationLevel: 'Serializable', timeout: 15000 })

    return responder({ ok: true }, 201)
  } catch (error) {
    return responderError(error)
  }
}
