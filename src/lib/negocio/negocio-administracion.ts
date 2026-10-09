import type { PrismaClient, Prisma } from '@prisma/client'
import { ErrorConfiguracion, validarNegocio } from './negocio-validacion'
import { ErrorSucursal, idValido, leerCuerpo } from '@/lib/sucursales/sucursales-validacion'
import { urlLogoNegocio } from './negocio'
import { ErrorImagen, subirImagen, quitarImagen } from '@/lib/storage/imagenes'

type Sesion = { user: { idUsuario: number } } | null

const camposNegocio = {
  nombre: true, descripcion: true, logoPath: true, instagram: true, tiktok: true, facebook: true,
  transferenciaAlias: true, transferenciaCuit: true, transferenciaTitular: true,
} satisfies Prisma.NegocioSelect

type FilaNegocio = Prisma.NegocioGetPayload<{ select: typeof camposNegocio }>

// En los datos generales del negocio se devuelve la URL mostrable y si hay logo.
function aRespuesta({ logoPath, ...resto }: FilaNegocio) {
  return { ...resto, logoUrl: urlLogoNegocio(logoPath), tieneLogo: logoPath !== null }
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  // ErrorSucursal llega desde leerCuerpo (compartido con la API de Sucursales).
  if (error instanceof ErrorConfiguracion || error instanceof ErrorSucursal || error instanceof ErrorImagen) {
    return responder({ error: error.message }, error.estado)
  }
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  // P2025: no existe la fila del negocio (update sobre un registro inexistente).
  if (codigo === 'P2025') return responder({ error: 'Todavía no se completó la configuración inicial.' }, 404)
  if (codigo === 'P2034') return responder({ error: 'Otra operación se cruzó con esta. Intentá nuevamente.' }, 409)
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

export function crearControladorNegocio(db: PrismaClient, leerSesion: () => Promise<Sesion>) {
  // Misma protección que Usuarios y Sucursales: sesión, admin activo, contraseña ya
  // cambiada y, en las escrituras, solicitud desde esta misma aplicación.
  async function proteger(request: Request, escritura: boolean, accion: () => Promise<Response>) {
    try {
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) {
        throw new ErrorConfiguracion(401, 'Iniciá sesión para administrar la configuración.')
      }
      const usuario = await db.usuario.findUnique({
        where: { idUsuario: sesion.user.idUsuario },
        select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
      })
      if (!usuario?.activo || usuario.rol.nombre !== 'admin') {
        throw new ErrorConfiguracion(403, 'No tenés permiso para administrar la configuración.')
      }
      if (usuario.debeCambiarContrasena) {
        throw new ErrorConfiguracion(403, 'Primero tenés que cambiar tu contraseña.')
      }
      if (escritura) {
        const origen = request.headers.get('origin')
        if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ErrorConfiguracion(403, 'La solicitud debe realizarse desde esta aplicación.')
        }
      }
      return await accion()
    } catch (error) {
      return responderError(error)
    }
  }

  async function gestionarLogo(request: Request, borrar: boolean) {
    const actual = await db.negocio.findUnique({ where: { idNegocio: 1 }, select: { logoPath: true } })
    if (!actual) throw new ErrorConfiguracion(404, 'Todavía no se completó la configuración inicial.')
    const guardar = async (esperada: string | null, nueva: string | null) => {
      const resultado = await db.negocio.updateMany({
        where: { idNegocio: 1, logoPath: esperada }, data: { logoPath: nueva },
      })
      return resultado.count === 1
    }
    if (borrar) await quitarImagen('logo', actual.logoPath, guardar)
    else await subirImagen(request, 'logo', 1, actual.logoPath, guardar)
    const negocio = await db.negocio.findUniqueOrThrow({ where: { idNegocio: 1 }, select: camposNegocio })
    return responder({
      mensaje: borrar ? 'Logo eliminado.' : 'Logo guardado.',
      imagen: { ruta: negocio.logoPath, url: urlLogoNegocio(negocio.logoPath) },
      negocio: aRespuesta(negocio),
    })
  }

  return {
    obtener: (request: Request) => proteger(request, false, async () => {
      const negocio = await db.negocio.findUnique({ where: { idNegocio: 1 }, select: camposNegocio })
      if (!negocio) throw new ErrorConfiguracion(404, 'Todavía no se completó la configuración inicial.')
      return responder({ negocio: aRespuesta(negocio) })
    }),

    editar: (request: Request) => proteger(request, true, async () => {
      const datos = validarNegocio(await leerCuerpo(request), true)
      const negocio = await db.negocio.update({ where: { idNegocio: 1 }, data: datos, select: camposNegocio })
      return responder({ mensaje: 'Cambios guardados.', negocio: aRespuesta(negocio) })
    }),

    subirLogo: (request: Request) => proteger(request, true, () => gestionarLogo(request, false)),

    quitarLogo: (request: Request) => proteger(request, true, () => gestionarLogo(request, true)),
  }
}
