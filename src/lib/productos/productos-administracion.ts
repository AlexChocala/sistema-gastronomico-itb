import type { PrismaClient, Prisma } from '@prisma/client'
import {
  ErrorProducto, idValido, leerId, leerCuerpo, validarProducto, type VariacionProducto,
} from './productos-validacion'
import { validarCategoria } from './categorias-validacion'
import { validarExtra } from './extras-validacion'

type Sesion = { user: { idUsuario: number } } | null
const camposProducto = {
  idProducto: true, nombre: true, descripcion: true, precio: true, activo: true,
  idCategoria: true, categoria: { select: { idCategoria: true, nombre: true, activa: true } },
  sucursales: {
    where: { disponible: true, sucursal: { activa: true } },
    select: { idSucursal: true, disponible: true, sucursal: { select: { nombre: true } } },
    orderBy: { idSucursal: 'asc' },
  },
  // Solo los extras activos asignados al producto.
  extras: {
    where: { extra: { activo: true } },
    select: { idExtra: true },
    orderBy: { idExtra: 'asc' },
  },
  // Las vigentes, de la más barata a la más cara (igual que en la carta).
  variaciones: {
    where: { disponible: true },
    select: { idVariacion: true, nombre: true, precioAdicional: true },
    orderBy: [{ precioAdicional: 'asc' }, { nombre: 'asc' }],
  },
} satisfies Prisma.ProductoSelect

const camposCategoria = {
  idCategoria: true, nombre: true, descripcion: true, orden: true, activa: true, nombresVariaciones: true,
  _count: { select: { productos: true, extras: true } },
} satisfies Prisma.CategoriaSelect

const camposExtra = {
  idExtra: true, idCategoria: true, nombre: true, precioAdicional: true, activo: true,
  // Solo los productos activos que lo tienen habilitado.
  productos: {
    where: { producto: { activo: true } },
    select: { idProducto: true },
    orderBy: { idProducto: 'asc' },
  },
} satisfies Prisma.ExtraSelect

const soloAdmin = ['admin', 'supervisor']

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

async function nombreDisponible(
  tx: Prisma.TransactionClient,
  nombre: string,
  idCategoria: number,
  idProductoActual?: number,
) {
  // El mismo nombre puede utilizarse en otra categoría, pero no repetirse dentro de esta.
  const existente = await tx.producto.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      idCategoria,
      ...(idProductoActual === undefined ? {} : { idProducto: { not: idProductoActual } }),
    },
    select: { idProducto: true },
  })
  if (existente) {
    throw new ErrorProducto(409, 'Ya existe un producto con ese nombre en la categoría seleccionada.')
  }
}

async function extrasDeCategoria(tx: Prisma.TransactionClient, idExtras: number[], idCategoria: number) {
  if (idExtras.length === 0) return
  const cantidad = await tx.extra.count({
    where: { idExtra: { in: idExtras }, idCategoria, activo: true },
  })
  if (cantidad !== idExtras.length) {
    throw new ErrorProducto(400, 'Los extras elegidos deben estar activos y ser de la categoría del producto.')
  }
}

async function productosDeCategoria(tx: Prisma.TransactionClient, idProductos: number[], idCategoria: number) {
  if (idProductos.length === 0) return
  const cantidad = await tx.producto.count({
    where: { idProducto: { in: idProductos }, idCategoria, activo: true },
  })
  if (cantidad !== idProductos.length) {
    throw new ErrorProducto(400, 'Los productos elegidos deben estar activos y ser de la categoría del extra.')
  }
}

async function nombreExtraDisponible(
  tx: Prisma.TransactionClient,
  nombre: string,
  idCategoria: number,
  idExtraActual?: number,
) {
  // En la base el nombre no es único, así que se valida acá (sin distinguir mayúsculas).
  const existente = await tx.extra.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      idCategoria,
      ...(idExtraActual === undefined ? {} : { idExtra: { not: idExtraActual } }),
    },
    select: { idExtra: true },
  })
  if (existente) throw new ErrorProducto(409, 'Ya existe un extra con ese nombre en esta categoría.')
}

// Deja las variaciones del producto iguales a la lista recibida:
// - con idVariacion: se edita (tiene que ser de este producto);
// - sin id: se crea, o se reactiva una oculta con el mismo nombre;
// - las que no vienen: se borran, salvo que ya estén en algún pedido (la base no deja
//   borrarlas y el historial las necesita): esas solo se ocultan (disponible = false).
async function sincronizarVariaciones(
  tx: Prisma.TransactionClient,
  idProducto: number,
  variaciones: VariacionProducto[],
) {
  const actuales = await tx.variacion.findMany({
    where: { idProducto },
    select: { idVariacion: true, nombre: true, disponible: true, _count: { select: { detallesPedido: true } } },
  })
  const porId = new Map(actuales.map((actual) => [actual.idVariacion, actual]))
  const conservadas = new Set<number>()

  for (const { idVariacion, nombre, precioAdicional } of variaciones) {
    if (idVariacion !== undefined && !porId.has(idVariacion)) {
      throw new ErrorProducto(400, 'Hay una variación que no es de este producto.')
    }
    const oculta = idVariacion === undefined
      ? actuales.find((actual) => !actual.disponible && actual.nombre.toLowerCase() === nombre.toLowerCase())
      : undefined
    const id = idVariacion ?? oculta?.idVariacion
    if (id === undefined) {
      await tx.variacion.create({ data: { idProducto, nombre, precioAdicional, disponible: true } })
    } else {
      conservadas.add(id)
      await tx.variacion.update({ where: { idVariacion: id }, data: { nombre, precioAdicional, disponible: true } })
    }
  }

  const sobrantes = actuales.filter((actual) => !conservadas.has(actual.idVariacion) && actual.disponible)
  const usadas = sobrantes.filter((actual) => actual._count.detallesPedido > 0).map((actual) => actual.idVariacion)
  const libres = sobrantes.filter((actual) => actual._count.detallesPedido === 0).map((actual) => actual.idVariacion)
  if (usadas.length > 0) {
    await tx.variacion.updateMany({ where: { idVariacion: { in: usadas } }, data: { disponible: false } })
  }
  if (libres.length > 0) await tx.variacion.deleteMany({ where: { idVariacion: { in: libres } } })
}

export function crearControladorProductos(db: PrismaClient, leerSesion: () => Promise<Sesion>) {
  async function proteger(
    request: Request,
    escritura: boolean,
    accion: () => Promise<Response>,
    roles: string[] = ['admin', 'supervisor'],
  ) {
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
      if (!usuario?.activo || !roles.includes(usuario.rol.nombre)) {
        throw new ErrorProducto(403, 'No tenés permiso para realizar esta acción.')
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
      const parametrosPermitidos = ['pagina', 'limite', 'estado', 'busqueda', 'idCategoria', 'idSucursal']
      if ([...parametros.keys()].some((clave) => !parametrosPermitidos.includes(clave) || parametros.getAll(clave).length > 1)) {
        throw new ErrorProducto(400, 'Los parámetros de listado no son válidos.')
      }
      const pagina = leerId(parametros.get('pagina') ?? '1')
      const limite = leerId(parametros.get('limite') ?? '20')
      const estado = parametros.get('estado') ?? 'todos'
      const busqueda = (parametros.get('busqueda') ?? '').trim()
      const valorCategoria = parametros.get('idCategoria')
      const idCategoria = valorCategoria ? leerId(valorCategoria) : null
      const valorSucursal = parametros.get('idSucursal')
      const idSucursal = valorSucursal ? leerId(valorSucursal) : null
      if (limite > 100 || !['todos', 'activos', 'inactivos'].includes(estado) || (pagina - 1) * limite > 2147483647) {
        throw new ErrorProducto(400, 'Usá un límite de hasta 100 y estado todos, activos o inactivos.')
      }
      if (busqueda.length > 120) {
        throw new ErrorProducto(400, 'La búsqueda puede tener hasta 120 caracteres.')
      }
      // Los mismos filtros se usan para obtener la página y calcular el total real.
      const where: Prisma.ProductoWhereInput = {
        ...(estado === 'todos' ? {} : { activo: estado === 'activos' }),
        ...(idCategoria === null ? {} : { idCategoria }),
        // Productos ofrecidos en esa sucursal (el selector de sucursal del panel).
        ...(idSucursal === null ? {} : { sucursales: { some: { idSucursal, disponible: true } } }),
        ...(busqueda ? {
          OR: [
            { nombre: { contains: busqueda, mode: 'insensitive' } },
            { descripcion: { contains: busqueda, mode: 'insensitive' } },
          ],
        } : {}),
      }
      const resultado = await db.$transaction(async (tx) => ({
        productos: await tx.producto.findMany({
          where, select: camposProducto, orderBy: [{ nombre: 'asc' }, { idProducto: 'asc' }],
          skip: (pagina - 1) * limite, take: limite,
        }),
        // El formulario necesita también categorías que todavía no tienen productos.
        categorias: await tx.categoria.findMany({
          where: { activa: true },
          // nombresVariaciones: lo que el formulario ofrece para tildar en cada producto.
          select: { idCategoria: true, nombre: true, nombresVariaciones: true },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        }),
        sucursales: await tx.sucursal.findMany({
          where: { activa: true },
          select: { idSucursal: true, nombre: true },
          orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
        }),
        // El formulario muestra los extras de la categoría elegida.
        extras: await tx.extra.findMany({
          where: { activo: true },
          select: { idExtra: true, idCategoria: true, nombre: true, precioAdicional: true },
          orderBy: [{ nombre: 'asc' }, { idExtra: 'asc' }],
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
        await extrasDeCategoria(tx, datos.idExtras!, datos.idCategoria!)
        await nombreDisponible(tx, datos.nombre!, datos.idCategoria!)
        return tx.producto.create({
          data: {
            nombre: datos.nombre!, descripcion: datos.descripcion ?? null,
            precio: datos.precio!, idCategoria: datos.idCategoria!,
            historialPrecios: { create: { precioAnterior: null, precioNuevo: datos.precio! } },
            sucursales: {
              create: datos.idSucursales!.map((idSucursal) => ({ idSucursal, disponible: true })),
            },
            extras: {
              create: datos.idExtras!.map((idExtra) => ({ idExtra })),
            },
            // En un producto nuevo no hay variaciones previas: se ignora cualquier id.
            variaciones: {
              create: (datos.variaciones ?? []).map(({ nombre, precioAdicional }) => ({ nombre, precioAdicional })),
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
        const idCategoriaFinal = datos.idCategoria ?? actual.idCategoria
        if (datos.idCategoria !== undefined || datos.activo === true) {
          await categoriaActiva(tx, idCategoriaFinal)
        }
        if (datos.idSucursales !== undefined) {
          await sucursalesActivas(tx, datos.idSucursales)
        }
        if (datos.idExtras !== undefined) {
          await extrasDeCategoria(tx, datos.idExtras, idCategoriaFinal)
        }
        await nombreDisponible(tx, datos.nombre ?? actual.nombre, idCategoriaFinal, idProducto)
        const { idSucursales, idExtras, variaciones, ...cambiosProducto } = datos
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
        // Si cambió de categoría, se le quitan los extras de la categoría anterior.
        if (idCategoriaFinal !== actual.idCategoria) {
          await tx.productoExtra.deleteMany({
            where: { idProducto, extra: { idCategoria: { not: idCategoriaFinal } } },
          })
        }
        if (idExtras !== undefined) {
          // Reemplaza solo los extras activos; los inactivos no se tocan.
          await tx.productoExtra.deleteMany({ where: { idProducto, extra: { activo: true } } })
          if (idExtras.length > 0) {
            await tx.productoExtra.createMany({ data: idExtras.map((idExtra) => ({ idProducto, idExtra })) })
          }
        }
        if (variaciones !== undefined) await sincronizarVariaciones(tx, idProducto, variaciones)
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
          nombresVariaciones: datos.nombresVariaciones ?? [],
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

    // ----- Extras (solo admin) -----

    listarExtras: (request: Request) => proteger(request, false, async () => {
      const resultado = await db.$transaction(async (tx) => ({
        categorias: await tx.categoria.findMany({
          where: { activa: true },
          select: { idCategoria: true, nombre: true },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        }),
        productos: await tx.producto.findMany({
          where: { activo: true, categoria: { activa: true } },
          select: { idProducto: true, idCategoria: true, nombre: true },
          orderBy: [{ nombre: 'asc' }, { idProducto: 'asc' }],
        }),
        extras: await tx.extra.findMany({
          where: { categoria: { activa: true } },
          select: camposExtra,
          orderBy: [{ nombre: 'asc' }, { idExtra: 'asc' }],
        }),
      }), { isolationLevel: 'RepeatableRead' })
      return responder(resultado)
    }, soloAdmin),

    crearExtra: (request: Request) => proteger(request, true, async () => {
      const datos = validarExtra(await leerCuerpo(request), false)
      const extra = await db.$transaction(async (tx) => {
        await categoriaActiva(tx, datos.idCategoria!)
        await nombreExtraDisponible(tx, datos.nombre!, datos.idCategoria!)
        await productosDeCategoria(tx, datos.idProductos!, datos.idCategoria!)
        return tx.extra.create({
          data: {
            idCategoria: datos.idCategoria!,
            nombre: datos.nombre!,
            precioAdicional: datos.precioAdicional!,
            productos: { create: datos.idProductos!.map((idProducto) => ({ idProducto })) },
          },
          select: camposExtra,
        })
      }, { isolationLevel: 'Serializable' })
      return responder({ extra }, 201)
    }, soloAdmin),

    editarExtra: (request: Request, id: string) => proteger(request, true, async () => {
      const idExtra = leerId(id)
      const datos = validarExtra(await leerCuerpo(request), true)
      const extra = await db.$transaction(async (tx) => {
        const actual = await tx.extra.findUnique({ where: { idExtra } })
        if (!actual) throw new ErrorProducto(404, 'Extra no encontrado.')
        if (datos.activo === true) await categoriaActiva(tx, actual.idCategoria)
        if (datos.nombre !== undefined) {
          await nombreExtraDisponible(tx, datos.nombre, actual.idCategoria, idExtra)
        }
        const { idProductos, idCategoria: _ignorada, ...cambiosExtra } = datos
        if (idProductos !== undefined) {
          await productosDeCategoria(tx, idProductos, actual.idCategoria)
          // Reemplaza solo las asignaciones a productos activos.
          await tx.productoExtra.deleteMany({ where: { idExtra, producto: { activo: true } } })
          if (idProductos.length > 0) {
            await tx.productoExtra.createMany({ data: idProductos.map((idProducto) => ({ idProducto, idExtra })) })
          }
        }
        if (Object.keys(cambiosExtra).length > 0) {
          await tx.extra.update({ where: { idExtra }, data: cambiosExtra })
        }
        return tx.extra.findUniqueOrThrow({ where: { idExtra }, select: camposExtra })
      }, { isolationLevel: 'Serializable' })
      return responder({ extra })
    }, soloAdmin),

    desactivarExtra: (request: Request, id: string) => proteger(request, true, async () => {
      // No se borra: puede estar en pedidos anteriores.
      const extra = await db.extra.update({
        where: { idExtra: leerId(id) }, data: { activo: false }, select: camposExtra,
      })
      return responder({ mensaje: 'Extra desactivado.', extra })
    }, soloAdmin),
  }
}