import type { PrismaClient, Prisma } from '@prisma/client'
import { ErrorProducto, idValido, leerId, leerCuerpo, validarProducto } from './productos-validacion'

type Sesion = { user: { idUsuario: number } } | null
const camposProducto = {
  idProducto: true, nombre: true, descripcion: true, precio: true, activo: true,
  idCategoria: true, categoria: { select: { idCategoria: true, nombre: true, activa: true } },
} satisfies Prisma.ProductoSelect

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorProducto) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2025') return responder({ error: 'Producto no encontrado.' }, 404)
  if (codigo === 'P2003' || codigo === 'P2034') {
    return responder({ error: 'Los datos cambiaron durante la operación. Actualizá e intentá nuevamente.' }, 409)
  }
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

async function categoriaActiva(tx: Prisma.TransactionClient, idCategoria: number) {
  const categoria = await tx.categoria.findUnique({ where: { idCategoria }, select: { activa: true } })
  if (!categoria?.activa) throw new ErrorProducto(400, 'La categoría debe existir y estar activa.')
}

export function crearControladorProductos(db: PrismaClient, leerSesion: () => Promise<Sesion>) {
  async function proteger(request: Request, escritura: boolean, accion: () => Promise<Response>) {
    try {
      // La sesión identifica al usuario; los permisos se vuelven a leer de la base.
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) {
        throw new ErrorProducto(401, 'Iniciá sesión para administrar productos.')
      }
      const usuario = await db.usuario.findUnique({
        where: { idUsuario: sesion.user.idUsuario },
        select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
      })
      if (!usuario?.activo || !['admin', 'supervisor'].includes(usuario.rol.nombre)) {
        throw new ErrorProducto(403, 'No tenés permiso para administrar productos.')
      }
      if (usuario.debeCambiarContrasena) {
        throw new ErrorProducto(403, 'Primero tenés que cambiar tu contraseña.')
      }
      if (escritura) {
        const origen = request.headers.get('origin')
        if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ErrorProducto(403, 'La solicitud debe realizarse desde esta aplicación.')
        }
      }
      return await accion()
    } catch (error) {
      return responderError(error)
    }
  }

  return {
    listar: (request: Request) => proteger(request, false, async () => {
      const parametros = new URL(request.url).searchParams
      if ([...parametros.keys()].some((clave) => !['pagina', 'limite', 'estado'].includes(clave) || parametros.getAll(clave).length > 1)) {
        throw new ErrorProducto(400, 'Los parámetros de listado no son válidos.')
      }
      const pagina = leerId(parametros.get('pagina') ?? '1')
      const limite = leerId(parametros.get('limite') ?? '20')
      const estado = parametros.get('estado') ?? 'todos'
      if (limite > 100 || !['todos', 'activos', 'inactivos'].includes(estado) || (pagina - 1) * limite > 2147483647) {
        throw new ErrorProducto(400, 'Usá un límite de hasta 100 y estado todos, activos o inactivos.')
      }
      const where = estado === 'todos' ? {} : { activo: estado === 'activos' }
      const resultado = await db.$transaction(async (tx) => ({
        productos: await tx.producto.findMany({
          where, select: camposProducto, orderBy: [{ nombre: 'asc' }, { idProducto: 'asc' }],
          skip: (pagina - 1) * limite, take: limite,
        }),
        total: await tx.producto.count({ where }),
      }), { isolationLevel: 'RepeatableRead' })
      return responder({ ...resultado, pagina, limite })
    }),

    obtener: (request: Request, id: string) => proteger(request, false, async () => {
      const producto = await db.producto.findUnique({ where: { idProducto: leerId(id) }, select: camposProducto })
      if (!producto) throw new ErrorProducto(404, 'Producto no encontrado.')
      return responder({ producto })
    }),

    crear: (request: Request) => proteger(request, true, async () => {
      const datos = validarProducto(await leerCuerpo(request), false)
      const producto = await db.$transaction(async (tx) => {
        await categoriaActiva(tx, datos.idCategoria!)
        // Crear un producto no lo asigna automáticamente a ninguna sucursal.
        return tx.producto.create({
          data: {
            nombre: datos.nombre!, descripcion: datos.descripcion ?? null,
            precio: datos.precio!, idCategoria: datos.idCategoria!,
            historialPrecios: { create: { precioAnterior: null, precioNuevo: datos.precio! } },
          },
          select: camposProducto,
        })
      }, { isolationLevel: 'Serializable' })
      return responder({ producto }, 201)
    }),

    editar: (request: Request, id: string) => proteger(request, true, async () => {
      const idProducto = leerId(id)
      const datos = validarProducto(await leerCuerpo(request), true)
      const producto = await db.$transaction(async (tx) => {
        const actual = await tx.producto.findUnique({ where: { idProducto } })
        if (!actual) throw new ErrorProducto(404, 'Producto no encontrado.')
        if (datos.idCategoria !== undefined || datos.activo === true) {
          await categoriaActiva(tx, datos.idCategoria ?? actual.idCategoria)
        }
        // El nuevo precio y su historial se guardan juntos; los pedidos previos conservan sus importes.
        return tx.producto.update({
          where: { idProducto },
          data: {
            ...datos,
            ...(datos.precio !== undefined && datos.precio !== actual.precio ? {
              historialPrecios: { create: { precioAnterior: actual.precio, precioNuevo: datos.precio } },
            } : {}),
          },
          select: camposProducto,
        })
      }, { isolationLevel: 'Serializable' })
      return responder({ producto })
    }),

    desactivar: (request: Request, id: string) => proteger(request, true, async () => {
      // No borramos el registro: sigue disponible para el historial de pedidos.
      const producto = await db.producto.update({
        where: { idProducto: leerId(id) }, data: { activo: false }, select: camposProducto,
      })
      return responder({ mensaje: 'Producto desactivado.', producto })
    }),
  }
}
