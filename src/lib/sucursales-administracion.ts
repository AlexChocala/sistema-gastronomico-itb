import type { PrismaClient, Prisma } from '@prisma/client'
import { ErrorSucursal, idValido, leerId, leerCuerpo, validarSucursal } from './sucursales-validacion'
import { validarLocalidadNueva } from './localidades-validacion'

type Sesion = { user: { idUsuario: number } } | null

const camposSucursal = {
  idSucursal: true, nombre: true, direccion: true, telefono: true, horario: true, activa: true,
  idLocalidad: true,
  localidad: { select: { idLocalidad: true, nombre: true, provincia: { select: { idProvincia: true, nombre: true } } } },
} satisfies Prisma.SucursalSelect

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorSucursal) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2025') return responder({ error: 'No se encontró el registro solicitado.' }, 404)
  if (codigo === 'P2002') return responder({ error: 'Ya existe una sucursal con esos datos.' }, 409)
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

export function crearControladorSucursales(db: PrismaClient, leerSesion: () => Promise<Sesion>) {
  async function proteger(request: Request, escritura: boolean, accion: () => Promise<Response>) {
    try {
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) {
        throw new ErrorSucursal(401, 'Iniciá sesión para administrar sucursales.')
      }
      const usuario = await db.usuario.findUnique({
        where: { idUsuario: sesion.user.idUsuario },
        select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
      })
      if (!usuario?.activo || usuario.rol.nombre !== 'admin') {
        throw new ErrorSucursal(403, 'No tenés permiso para administrar sucursales.')
      }
      if (usuario.debeCambiarContrasena) {
        throw new ErrorSucursal(403, 'Primero tenés que cambiar tu contraseña.')
      }
      if (escritura) {
        const origen = request.headers.get('origin')
        if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ErrorSucursal(403, 'La solicitud debe realizarse desde esta aplicación.')
        }
      }
      return await accion()
    } catch (error) {
      return responderError(error)
    }
  }

  return {
    listar: (request: Request) => proteger(request, false, async () => {
      const [sucursales, localidades] = await db.$transaction([
        db.sucursal.findMany({ select: camposSucursal, orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }] }),
        db.localidad.findMany({
          select: { idLocalidad: true, nombre: true, provincia: { select: { idProvincia: true, nombre: true } } },
          orderBy: [{ nombre: 'asc' }],
        }),
      ])
      return responder({ sucursales, localidades })
    }),

    crear: (request: Request) => proteger(request, true, async () => {
      const body = await leerCuerpo(request)
      // Si viene "localidadNueva" en vez de idLocalidad, se crea la localidad (y provincia si hace falta) primero.
      const cuerpo = body as Record<string, unknown>
      let idLocalidad = cuerpo.idLocalidad

      const sucursal = await db.$transaction(async (tx) => {
        if (!idLocalidad && cuerpo.localidadNueva) {
          const datosLoc = validarLocalidadNueva(cuerpo.localidadNueva)
          const provincia = await tx.provincia.upsert({
            where: { nombre: datosLoc.nombreProvincia },
            update: {},
            create: { nombre: datosLoc.nombreProvincia },
          })
          const localidad = await tx.localidad.upsert({
            where: { nombre_idProvincia: { nombre: datosLoc.nombre, idProvincia: provincia.idProvincia } },
            update: {},
            create: { nombre: datosLoc.nombre, idProvincia: provincia.idProvincia },
          })
          idLocalidad = localidad.idLocalidad
        }

        const datos = validarSucursal({ ...cuerpo, idLocalidad }, false)
        return tx.sucursal.create({ data: datos as any, select: camposSucursal })
      }, { isolationLevel: 'Serializable' })

      return responder({ sucursal }, 201)
    }),

    editar: (request: Request, id: string) => proteger(request, true, async () => {
      const idSucursal = leerId(id)
      const datos = validarSucursal(await leerCuerpo(request), true)
      const actual = await db.sucursal.findUnique({ where: { idSucursal } })
      if (!actual) throw new ErrorSucursal(404, 'Sucursal no encontrada.')
      const sucursal = await db.sucursal.update({ where: { idSucursal }, data: datos, select: camposSucursal })
      return responder({ sucursal })
    }),

    desactivar: (request: Request, id: string) => proteger(request, true, async () => {
      const sucursal = await db.sucursal.update({
        where: { idSucursal: leerId(id) }, data: { activa: false }, select: camposSucursal,
      })
      return responder({ mensaje: 'Sucursal desactivada.', sucursal })
    }),

    activar: (request: Request, id: string) => proteger(request, true, async () => {
      const sucursal = await db.sucursal.update({
        where: { idSucursal: leerId(id) }, data: { activa: true }, select: camposSucursal,
      })
      return responder({ mensaje: 'Sucursal activada.', sucursal })
    }),
  }
}