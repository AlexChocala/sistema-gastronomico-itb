import type { PrismaClient, Prisma } from '@prisma/client'
import { ErrorConfiguracion, validarNegocio } from './negocio-validacion'
import { ErrorSucursal, idValido, leerCuerpo } from '@/lib/sucursales/sucursales-validacion'
import { urlLogoNegocio } from './negocio'

type Sesion = { user: { idUsuario: number } } | null

const camposNegocio = {
  nombre: true, descripcion: true, logoPath: true, instagram: true, tiktok: true, facebook: true,
  transferenciaAlias: true, transferenciaCbu: true, transferenciaTitular: true,
} satisfies Prisma.NegocioSelect

type FilaNegocio = Prisma.NegocioGetPayload<{ select: typeof camposNegocio }>

// La ruta del bucket no sale del servidor: el cliente recibe la URL mostrable y si hay logo.
function aRespuesta({ logoPath, ...resto }: FilaNegocio) {
  return { ...resto, logoUrl: urlLogoNegocio(logoPath), tieneLogo: logoPath !== null }
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  // ErrorSucursal llega desde leerCuerpo (compartido con la API de Sucursales).
  if (error instanceof ErrorConfiguracion || error instanceof ErrorSucursal) {
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

    quitarLogo: (request: Request) => proteger(request, true, async () => {
      // Igual que la foto de perfil: por ahora solo se borra la ruta. Borrar el archivo
      // del bucket se agrega cuando se conecte Supabase Storage.
      const negocio = await db.negocio.update({ where: { idNegocio: 1 }, data: { logoPath: null }, select: camposNegocio })
      return responder({ mensaje: 'Logo eliminado.', negocio: aRespuesta(negocio) })
    }),
  }
}
