import type { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'
import { ErrorUsuario, idValido, leerId, leerCuerpo, validarUsuario } from './usuarios-validacion'

type Sesion = { user: { idUsuario: number } } | null

const camposUsuario = {
  idUsuario: true, nombre: true, apellido: true, email: true, username: true, activo: true,
  idRol: true, rol: { select: { idRol: true, nombre: true } },
  idSucursal: true, sucursal: { select: { idSucursal: true, nombre: true } },
} satisfies Prisma.UsuarioSelect

function generarPasswordAleatoria(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return password
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorUsuario) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2025') return responder({ error: 'No se encontró el registro solicitado.' }, 404)
  if (codigo === 'P2002') return responder({ error: 'El email o username ya está en uso.' }, 409)
  if (codigo === 'P2003' || codigo === 'P2034') {
    return responder({ error: 'Los datos cambiaron durante la operación. Actualizá e intentá nuevamente.' }, 409)
  }
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

async function rolActivo(tx: Prisma.TransactionClient, idRol: number) {
  const rol = await tx.rol.findUnique({ where: { idRol } })
  if (!rol) throw new ErrorUsuario(400, 'El rol indicado no existe.')
}

async function sucursalActiva(tx: Prisma.TransactionClient, idSucursal: number) {
  const sucursal = await tx.sucursal.findUnique({ where: { idSucursal }, select: { activa: true } })
  if (!sucursal?.activa) throw new ErrorUsuario(400, 'La sucursal debe existir y estar activa.')
}

export function crearControladorUsuarios(db: PrismaClient, leerSesion: () => Promise<Sesion>) {
  async function proteger(
    request: Request,
    rolesPermitidos: string[],
    escritura: boolean,
    accion: (idUsuarioSesion: number) => Promise<Response>
  ) {
    try {
      // La sesión identifica al usuario; los permisos se vuelven a leer de la base.
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) {
        throw new ErrorUsuario(401, 'Iniciá sesión para administrar usuarios.')
      }
      const usuario = await db.usuario.findUnique({
        where: { idUsuario: sesion.user.idUsuario },
        select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
      })
      if (!usuario?.activo || !rolesPermitidos.includes(usuario.rol.nombre)) {
        throw new ErrorUsuario(403, 'No tenés permiso para administrar usuarios.')
      }
      if (usuario.debeCambiarContrasena) {
        throw new ErrorUsuario(403, 'Primero tenés que cambiar tu contraseña.')
      }
      if (escritura) {
        const origen = request.headers.get('origin')
        if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ErrorUsuario(403, 'La solicitud debe realizarse desde esta aplicación.')
        }
      }
      return await accion(sesion.user.idUsuario)
    } catch (error) {
      return responderError(error)
    }
  }

  return {
    // Ver el listado: solo admin.
    listar: (request: Request) => proteger(request, ['admin'], false, async (idUsuarioSesion) => {
      const sesionCompleta = await db.usuario.findUnique({
        where: { idUsuario: idUsuarioSesion },
        select: { rol: { select: { nombre: true } } },
      })
      const [usuarios, roles, sucursales] = await db.$transaction([
        db.usuario.findMany({ select: camposUsuario, orderBy: [{ nombre: 'asc' }, { idUsuario: 'asc' }] }),
        db.rol.findMany({ select: { idRol: true, nombre: true }, orderBy: { idRol: 'asc' } }),
        db.sucursal.findMany({
          where: { activa: true },
          select: { idSucursal: true, nombre: true },
          orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
        }),
      ])
      return responder({
        usuarios, roles, sucursales,
        esAdmin: sesionCompleta?.rol.nombre === 'admin',
      })
    }),

    // Crear, editar y desactivar/activar: solo admin.
    crear: (request: Request) => proteger(request, ['admin'], true, async () => {
      const datos = validarUsuario(await leerCuerpo(request), false)
      const passwordGenerada = generarPasswordAleatoria()
      const passwordHash = await bcrypt.hash(passwordGenerada, 10)

      const usuario = await db.$transaction(async (tx) => {
        await rolActivo(tx, datos.idRol!)
        await sucursalActiva(tx, datos.idSucursal!)
        return tx.usuario.create({
          data: {
            nombre: datos.nombre!,
            apellido: datos.apellido!,
            email: datos.email!,
            username: datos.username!,
            passwordHash,
            idRol: datos.idRol!,
            idSucursal: datos.idSucursal!,
            debeCambiarContrasena: true,
          },
          select: camposUsuario,
        })
      }, { isolationLevel: 'Serializable' })

      return responder({ usuario, passwordGenerada }, 201)
    }),

    editar: (request: Request, id: string) => proteger(request, ['admin'], true, async () => {
      const idUsuario = leerId(id)
      const datos = validarUsuario(await leerCuerpo(request), true)

      const usuario = await db.$transaction(async (tx) => {
        const actual = await tx.usuario.findUnique({ where: { idUsuario } })
        if (!actual) throw new ErrorUsuario(404, 'Usuario no encontrado.')
        if (datos.idRol !== undefined) await rolActivo(tx, datos.idRol)
        if (datos.idSucursal !== undefined) await sucursalActiva(tx, datos.idSucursal)
        return tx.usuario.update({ where: { idUsuario }, data: datos, select: camposUsuario })
      }, { isolationLevel: 'Serializable' })

      return responder({ usuario })
    }),

    desactivar: (request: Request, id: string) => proteger(request, ['admin'], true, async (idUsuarioSesion) => {
      const idUsuario = leerId(id)
      if (idUsuario === idUsuarioSesion) {
        throw new ErrorUsuario(400, 'No podés desactivar tu propio usuario.')
      }
      // No borramos el registro: sigue disponible para el historial de pedidos.
      const usuario = await db.usuario.update({
        where: { idUsuario }, data: { activo: false }, select: camposUsuario,
      })
      return responder({ mensaje: 'Usuario desactivado.', usuario })
    }),

    activar: (request: Request, id: string) => proteger(request, ['admin'], true, async () => {
      const usuario = await db.usuario.update({
        where: { idUsuario: leerId(id) }, data: { activo: true }, select: camposUsuario,
      })
      return responder({ mensaje: 'Usuario activado.', usuario })
    }),
  }
}