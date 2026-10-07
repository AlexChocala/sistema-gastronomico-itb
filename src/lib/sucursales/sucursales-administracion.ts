import type { PrismaClient, Prisma } from '@prisma/client'
import {
  ErrorSucursal, MAX_SUCURSALES, MENSAJE_SIN_ENTREGA, elegirSlug, generarSlug, idValido, leerId, leerCuerpo,
  validarSucursal,
} from './sucursales-validacion'
import { validarLocalidadNueva } from './localidades-validacion'

type Sesion = { user: { idUsuario: number } } | null

const camposSucursal = {
  idSucursal: true, nombre: true, slug: true, direccion: true, whatsapp: true, horario: true, activa: true,
  ofreceRetiro: true, ofreceDelivery: true, idLocalidad: true,
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
  // Conflicto de la transacción serializable (otra alta al mismo tiempo).
  if (codigo === 'P2034') return responder({ error: 'Otra operación se cruzó con esta. Intentá nuevamente.' }, 409)
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

// Tope de sucursales para un alta de `nuevas` sucursales. Tiene que correr dentro de
// una transacción serializable junto con las altas, así el conteo no queda viejo.
export async function verificarTopeSucursales(tx: Prisma.TransactionClient, nuevas: number) {
  const total = await tx.sucursal.count()
  if (total + nuevas > MAX_SUCURSALES) {
    throw new ErrorSucursal(409, total >= MAX_SUCURSALES
      ? `Llegaste al máximo de ${MAX_SUCURSALES} sucursales.`
      : `Podés cargar ${MAX_SUCURSALES - total} sucursales más como máximo (tope de ${MAX_SUCURSALES}).`)
  }
}

// Sin ninguna sucursal activa el sistema vuelve a quedar "sin configurar" y el panel se
// bloquea (ver lib/negocio/configuracion-inicial.ts), así que la última activa no se desactiva.
async function exigirOtraSucursalActiva(tx: Prisma.TransactionClient, idSucursal: number) {
  const otrasActivas = await tx.sucursal.count({ where: { activa: true, idSucursal: { not: idSucursal } } })
  if (otrasActivas === 0) {
    throw new ErrorSucursal(409, 'No podés desactivar la única sucursal activa.')
  }
}

// Alta de una sucursal dentro de una transacción ya abierta (la usan el alta de
// Sucursales y la configuración inicial). No controla el tope: eso lo hace cada llamador
// con verificarTopeSucursales, porque uno crea una sola y el otro varias juntas.
export async function crearSucursalEnTransaccion(tx: Prisma.TransactionClient, cuerpo: unknown) {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorSucursal(400, 'Enviá un objeto JSON con los datos de la sucursal.')
  }
  const datosCuerpo = cuerpo as Record<string, unknown>
  let idLocalidad = datosCuerpo.idLocalidad

  // Si viene "localidadNueva" en vez de idLocalidad, se crea la localidad (y provincia si hace falta) primero.
  if (!idLocalidad && datosCuerpo.localidadNueva) {
    const datosLoc = validarLocalidadNueva(datosCuerpo.localidadNueva)
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

  // "localidadNueva" ya se procesó arriba; validarSucursal rechaza campos que no conoce.
  const camposSucursalBody = Object.fromEntries(
    Object.entries(datosCuerpo).filter(([campo]) => campo !== 'localidadNueva'),
  )
  const datos = validarSucursal({ ...camposSucursalBody, idLocalidad }, false)
  return tx.sucursal.create({ data: { ...datos, slug: await slugLibre(tx, datos.nombre) }, select: camposSucursal })
}

// Slug de la URL pública. Se busca dentro de la misma transacción serializable, así dos
// altas simultáneas con el mismo nombre no eligen el mismo (y si pasara, el índice único
// lo frena). Solo se genera en el alta: al renombrar la sucursal el slug NO cambia, para
// que los QR impresos con la URL sigan funcionando.
async function slugLibre(tx: Prisma.TransactionClient, nombre: string) {
  const base = generarSlug(nombre) || 'sucursal'
  const parecidos = await tx.sucursal.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
  return elegirSlug(base, new Set(parecidos.map((s) => s.slug)))
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
      const cuerpo = await leerCuerpo(request)

      const sucursal = await db.$transaction(async (tx) => {
        // Se cuenta dentro de la transacción serializable: dos altas simultáneas no pueden
        // pasar juntas el tope.
        await verificarTopeSucursales(tx, 1)
        return crearSucursalEnTransaccion(tx, cuerpo)
      }, { isolationLevel: 'Serializable' })

      return responder({ sucursal }, 201)
    }),

    editar: (request: Request, id: string) => proteger(request, true, async () => {
      const idSucursal = leerId(id)
      const datos = validarSucursal(await leerCuerpo(request), true)
      const sucursal = await db.$transaction(async (tx) => {
        const actual = await tx.sucursal.findUnique({ where: { idSucursal } })
        if (!actual) throw new ErrorSucursal(404, 'Sucursal no encontrada.')
        if (datos.activa === false && actual.activa) await exigirOtraSucursalActiva(tx, idSucursal)
        // Si viene una sola forma de entrega, la regla se revisa junto con la que ya tiene.
        const retiro = datos.ofreceRetiro ?? actual.ofreceRetiro
        const delivery = datos.ofreceDelivery ?? actual.ofreceDelivery
        if (!retiro && !delivery) throw new ErrorSucursal(400, MENSAJE_SIN_ENTREGA)
        return tx.sucursal.update({ where: { idSucursal }, data: datos, select: camposSucursal })
      }, { isolationLevel: 'Serializable' })
      return responder({ sucursal })
    }),

    desactivar: (request: Request, id: string) => proteger(request, true, async () => {
      const idSucursal = leerId(id)
      const sucursal = await db.$transaction(async (tx) => {
        await exigirOtraSucursalActiva(tx, idSucursal)
        return tx.sucursal.update({ where: { idSucursal }, data: { activa: false }, select: camposSucursal })
      }, { isolationLevel: 'Serializable' })
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