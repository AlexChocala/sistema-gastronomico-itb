import type { PrismaClient, Prisma } from '@prisma/client'
import { ErrorProducto, idValido, leerId, leerCuerpo, validarProducto } from './productos-validacion'
import { validarCategoria } from './categorias-validacion'

type Sesion = { user: { idUsuario: number } } | null
const camposProducto = {
  idProducto: true, nombre: true, descripcion: true, precio: true, activo: true,
  idCategoria: true, categoria: { select: { idCategoria: true, nombre: true, activa: true } },
  sucursales: {
    where: { disponible: true, sucursal: { activa: true } },
    select: { idSucursal: true, disponible: true, sucursal: { select: { nombre: true } } },
    orderBy: { idSucursal: 'asc' },
  },
} satisfies Prisma.ProductoSelect

const camposCategoria = {
  idCategoria: true, nombre: true, descripcion: true, orden: true, activa: true,
  _count: { select: { productos: true } },
} satisfies Prisma.CategoriaSelect

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorProducto) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2025') return responder({ error: 'No se encontró el registro solicitado.' }, 404)
  if (codigo === 'P2002') return responder({ error: 'Ya existe una categoría con ese nombre.' }, 409)
  if (codigo === 'P2003' || codigo === 'P2034') {
    return responder({ error: 'Los datos cambiaron durante la operación. Actualizá e intentá nuevamente.' }, 409)
  }
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

async function categoriaActiva(tx: Prisma.TransactionClient, idCategoria: number) {
  const categoria = await tx.categoria.findUnique({ where: { idCategoria }, select: { activa: true } })
  if (!categoria?.activa) throw new ErrorProducto(400, 'La categoría debe existir y estar activa.')
}

async function sucursalesActivas(tx: Prisma.TransactionClient, idSucursales: number[]) {
  const cantidad = await tx.sucursal.count({
    where: { idSucursal: { in: idSucursales }, activa: true },
  })
  if (cantidad !== idSucursales.length) {
    throw new ErrorProducto(400, 'Todas las sucursales elegidas deben existir y estar activas.')
  }
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
        // El formulario necesita también categorías que todavía no tienen productos.
        categorias: await tx.categoria.findMany({
          where: { activa: true },
          select: { idCategoria: true, nombre: true },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        }),
        sucursales: await tx.sucursal.findMany({
          where: { activa: true },
          select: { idSucursal: true, nombre: true },
          orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
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
        await sucursalesActivas(tx, datos.idSucursales!)
        return tx.producto.create({
          data: {
            nombre: datos.nombre!, descripcion: datos.descripcion ?? null,
            precio: datos.precio!, idCategoria: datos.idCategoria!,
            historialPrecios: { create: { precioAnterior: null, precioNuevo: datos.precio! } },
            sucursales: {
              create: datos.idSucursales!.map((idSucursal) => ({ idSucursal, disponible: true })),
            },
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
        if (datos.idSucursales !== undefined) {
          await sucursalesActivas(tx, datos.idSucursales)
        }
        const { idSucursales, ...cambiosProducto } = datos
        // El nuevo precio y su historial se guardan juntos; los pedidos previos conservan sus importes.
        await tx.producto.update({
          where: { idProducto },
          data: {
            ...cambiosProducto,
            ...(datos.precio !== undefined && datos.precio !== actual.precio ? {
              historialPrecios: { create: { precioAnterior: actual.precio, precioNuevo: datos.precio } },
            } : {}),
          },
        })
        if (idSucursales !== undefined) {
          // Conservamos las relaciones existentes y cambiamos su disponibilidad.
          await tx.sucursalProducto.updateMany({
            where: { idProducto, idSucursal: { notIn: idSucursales } },
            data: { disponible: false },
          })
          await Promise.all(idSucursales.map((idSucursal) => tx.sucursalProducto.upsert({
            where: { idSucursal_idProducto: { idSucursal, idProducto } },
            update: { disponible: true },
            create: { idSucursal, idProducto, disponible: true },
          })))
        }
        return tx.producto.findUniqueOrThrow({ where: { idProducto }, select: camposProducto })
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

    listarCategorias: (request: Request) => proteger(request, false, async () => {
      const categorias = await db.categoria.findMany({
        select: camposCategoria,
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }, { idCategoria: 'asc' }],
      })
      return responder({ categorias })
    }),

    crearCategoria: (request: Request) => proteger(request, true, async () => {
      const datos = validarCategoria(await leerCuerpo(request), false)
      const categoria = await db.categoria.create({
        data: {
          nombre: datos.nombre!,
          descripcion: datos.descripcion ?? null,
          orden: datos.orden!,
        },
        select: camposCategoria,
      })
      return responder({ categoria }, 201)
    }),

    editarCategoria: (request: Request, id: string) => proteger(request, true, async () => {
      const idCategoria = leerId(id)
      const datos = validarCategoria(await leerCuerpo(request), true)
      const existe = await db.categoria.findUnique({ where: { idCategoria }, select: { idCategoria: true } })
      if (!existe) throw new ErrorProducto(404, 'Categoría no encontrada.')
      if (datos.activa === false) {
        const productosActivos = await db.producto.count({ where: { idCategoria, activo: true } })
        if (productosActivos > 0) {
          throw new ErrorProducto(
            409,
            `La categoría tiene ${productosActivos} producto(s) activo(s). Movelos o desactivalos primero.`,
          )
        }
      }
      const categoria = await db.categoria.update({
        where: { idCategoria }, data: datos, select: camposCategoria,
      })
      return responder({ categoria })
    }),

    desactivarCategoria: (request: Request, id: string) => proteger(request, true, async () => {
      const idCategoria = leerId(id)
      const categoria = await db.$transaction(async (tx) => {
        const actual = await tx.categoria.findUnique({ where: { idCategoria } })
        if (!actual) throw new ErrorProducto(404, 'Categoría no encontrada.')
        const productosActivos = await tx.producto.count({ where: { idCategoria, activo: true } })
        if (productosActivos > 0) {
          throw new ErrorProducto(
            409,
            `La categoría tiene ${productosActivos} producto(s) activo(s). Movelos o desactivalos primero.`,
          )
        }
        return tx.categoria.update({
          where: { idCategoria }, data: { activa: false }, select: camposCategoria,
        })
      }, { isolationLevel: 'Serializable' })
      return responder({ mensaje: 'Categoría desactivada.', categoria })
    }),
  }
}
