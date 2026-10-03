// API de pedidos para las pantallas internas (Caja, Cocina, Pedidos, Dashboard) y para
// el monitor público de Pedidos Mostrador. Solo corre en el servidor.
//
//   GET   /api/pedidos/sucursal            pedidos de la sucursal activa (personal)
//   POST  /api/pedidos/caja                alta de un pedido de mostrador (personal)
//   PATCH /api/pedidos/{id}                cambio de estado, deshacer o tipo de entrega (personal)
//   GET   /api/pedidos/mostrador?sucursal  retiros en preparación / listos (público)
//
// La sucursal NUNCA la manda el personal: sale de la sesión (obtenerSucursalActiva), y
// un pedido de otra sucursal responde 404 como si no existiera. Las transiciones las
// decide lib/pedidos/pedidos-estados.ts; acá se aplican con un update condicional (el pedido
// tiene que seguir como se leyó), así dos pantallas que tocan el mismo pedido a la vez
// no se pisan: la segunda recibe 409 y vuelve a cargar la lista.

import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorSucursal, idValido, leerCuerpo, leerId } from '@/lib/sucursales/sucursales-validacion'
import {
  ErrorPedido, MENSAJE_SUCURSAL_NO_DISPONIBLE, validarAccionPedido, validarPedidoCaja,
} from './pedidos-validacion'
import {
  MENSAJE_CONFLICTO_ESTADO, aplicarAccion, deshacerA, puedeCambiarEntrega,
  type EstadoPago, type EstadoPedido, type Estados, type MetodoPago, type OrigenPedido, type PedidoMostrador,
  type PedidoPantalla, type TipoEntrega,
} from './pedidos-estados'
import { buscarTipoEntrega, calcularLineas, detallesDe, verificarLocalidadDelivery } from './pedidos-online'

type SesionPersonal = { user: { idUsuario: number } }

// Los entregados salen de la lista después de 24 horas (contadas desde que se cargó el
// pedido: no se guarda la hora de entrega). Los que no se entregaron quedan siempre, para
// que ninguno se pierda de vista, hasta el tope de filas.
const VENTANA_ENTREGADOS_MS = 24 * 60 * 60 * 1000
const MAX_PEDIDOS_LISTA = 500

const camposPedido = {
  idPedido: true, idSucursal: true, fecha: true, origenPedido: true, estadoPedido: true, metodoPago: true,
  estadoPago: true, direccion: true, referencias: true, aclaracion: true, total: true, idLocalidad: true, idCliente: true,
  idTipoEntrega: true,
  cliente: { select: { nombre: true, apellido: true, telefono: true } },
  tipoEntrega: { select: { nombre: true } },
  localidad: { select: { nombre: true } },
  detalles: {
    select: {
      idProducto: true, cantidad: true, precioUnitario: true,
      producto: { select: { nombre: true } },
      variacion: { select: { nombre: true } },
      extras: { select: { extra: { select: { nombre: true } } }, orderBy: { extra: { nombre: 'asc' } } },
    },
    orderBy: { idDetalle: 'asc' },
  },
} satisfies Prisma.PedidoSelect

type FilaPedido = Prisma.PedidoGetPayload<{ select: typeof camposPedido }>

// Los estados se guardan como texto; los valores posibles los escribe solo este código
// y pedidos-online, por eso se toman tal cual.
function aPantalla(fila: FilaPedido): PedidoPantalla {
  return {
    idPedido: fila.idPedido,
    idSucursal: fila.idSucursal,
    fecha: fila.fecha.toISOString(),
    origen: fila.origenPedido as OrigenPedido,
    cliente: [fila.cliente.nombre, fila.cliente.apellido].filter(Boolean).join(' '),
    telefono: fila.cliente.telefono,
    tipoEntrega: fila.tipoEntrega.nombre as TipoEntrega,
    estado: fila.estadoPedido as EstadoPedido,
    metodoPago: fila.metodoPago as MetodoPago,
    estadoPago: fila.estadoPago as EstadoPago,
    direccion: fila.direccion,
    idLocalidad: fila.idLocalidad,
    localidad: fila.localidad?.nombre ?? null,
    referencias: fila.referencias,
    aclaracion: fila.aclaracion,
    items: fila.detalles.map((detalle) => ({
      idProducto: detalle.idProducto,
      cantidad: detalle.cantidad,
      producto: detalle.producto.nombre,
      precioUnitario: detalle.precioUnitario,
      variacion: detalle.variacion?.nombre ?? null,
      extras: detalle.extras.map(({ extra }) => extra.nombre),
    })),
    total: fila.total,
  }
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorPedido) return responder({ error: error.message, ...error.extra }, error.estado)
  // ErrorSucursal llega desde leerCuerpo (415 / JSON inválido) y leerId.
  if (error instanceof ErrorSucursal) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2025') return responder({ error: 'No encontramos ese pedido en esta sucursal.' }, 404)
  if (codigo === 'P2034') return responder({ error: 'Otra operación se cruzó con esta. Intentá nuevamente.' }, 409)
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

function mismoOrigen(request: Request) {
  const origen = request.headers.get('origin')
  return !((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
}

const conflicto = () => new ErrorPedido(409, MENSAJE_CONFLICTO_ESTADO)

// `sucursalDe` resuelve la sucursal activa de la sesión (en la app, obtenerSucursalActiva):
// se inyecta para no atar este módulo a next/headers.
export function crearControladorPedidosInternos<S extends SesionPersonal>(
  db: PrismaClient,
  leerSesion: () => Promise<S | null>,
  sucursalDe: (sesion: S) => Promise<number | null>,
) {
  // Supervisor y empleado operan los pedidos de su sucursal. El admin solo los ve: así no
  // carga ni mueve un pedido por error (por ejemplo, con otra sucursal activa).
  async function proteger(
    request: Request,
    escritura: boolean,
    accion: (personal: { idUsuario: number; idSucursal: number }) => Promise<Response>,
  ) {
    try {
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) throw new ErrorPedido(401, 'Iniciá sesión para ver los pedidos.')
      const usuario = await db.usuario.findUnique({
        where: { idUsuario: sesion.user.idUsuario },
        select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
      })
      if (!usuario?.activo) throw new ErrorPedido(403, 'El usuario no está habilitado.')
      if (usuario.debeCambiarContrasena) throw new ErrorPedido(403, 'Primero tenés que cambiar tu contraseña.')
      // El rol se lee de la base y no de la sesión, por si se lo cambiaron hace poco.
      if (escritura && usuario.rol.nombre === 'admin') {
        throw new ErrorPedido(403, 'El administrador puede ver los pedidos, pero no cargarlos ni cambiarlos.')
      }
      if (escritura && !mismoOrigen(request)) throw new ErrorPedido(403, 'La solicitud debe realizarse desde esta aplicación.')
      const idSucursal = await sucursalDe(sesion)
      if (idSucursal === null) throw new ErrorPedido(400, 'Tu usuario no tiene una sucursal asignada.')
      return await accion({ idUsuario: sesion.user.idUsuario, idSucursal })
    } catch (error) {
      return responderError(error)
    }
  }

  return {
    listar: (request: Request) => proteger(request, false, async ({ idSucursal }) => {
      const desde = new Date(Date.now() - VENTANA_ENTREGADOS_MS)
      const [filas, zonas] = await db.$transaction([
        db.pedido.findMany({
          // Todos los que no se entregaron + los entregados de las últimas 24 horas.
          where: { idSucursal, OR: [{ estadoPedido: { not: 'entregado' } }, { fecha: { gte: desde } }] },
          select: camposPedido,
          orderBy: { idPedido: 'desc' },
          take: MAX_PEDIDOS_LISTA,
        }),
        db.sucursalLocalidad.findMany({
          where: { idSucursal },
          select: { localidad: { select: { idLocalidad: true, nombre: true } } },
          orderBy: { localidad: { nombre: 'asc' } },
        }),
      ])
      return responder({
        pedidos: filas.map(aPantalla),
        // Para "Cambiar a delivery": si hay zonas, la localidad es obligatoria.
        localidadesDelivery: zonas.map((zona) => zona.localidad),
      })
    }),

    // Caja cobra ANTES de crear el pedido: entra pagado y 'recibido' (directo a Cocina).
    crearCaja: (request: Request) => proteger(request, true, async ({ idUsuario, idSucursal }) => {
      const pedido = validarPedidoCaja(await leerCuerpo(request))
      const creado = await db.$transaction(async (tx) => {
        const sucursal = await tx.sucursal.findUnique({
          where: { idSucursal },
          select: { activa: true, localidadesDelivery: { select: { idLocalidad: true } } },
        })
        if (!sucursal?.activa) throw new ErrorPedido(404, 'La sucursal asignada no está disponible.')
        // ofreceRetiro/ofreceDelivery son del menú digital: en el mostrador se puede cargar
        // cualquiera de los dos. La regla de zonas sí vale igual que online.
        if (pedido.tipoEntrega === 'delivery') {
          await verificarLocalidadDelivery(tx, sucursal.localidadesDelivery.map((zona) => zona.idLocalidad), pedido.idLocalidad)
        }
        const { lineas, total } = await calcularLineas(tx, idSucursal, pedido.items)
        const idTipoEntrega = await buscarTipoEntrega(tx, pedido.tipoEntrega)
        const cliente = await tx.cliente.create({
          data: { nombre: pedido.cliente.nombre, telefono: pedido.cliente.telefono },
          select: { idCliente: true },
        })
        return tx.pedido.create({
          data: {
            origenPedido: 'mostrador',
            estadoPedido: 'recibido',
            metodoPago: pedido.metodoPago,
            estadoPago: 'pagado',
            direccion: pedido.direccion,
            referencias: pedido.referencias,
            aclaracion: pedido.aclaracion,
            subtotal: total,
            total,
            idCliente: cliente.idCliente,
            idSucursal,
            idUsuario,
            idTipoEntrega,
            idLocalidad: pedido.idLocalidad,
            detalles: { create: detallesDe(lineas) },
          },
          select: camposPedido,
        })
      })
      return responder({ pedido: aPantalla(creado) }, 201)
    }),

    actualizar: (request: Request, id: string) => proteger(request, true, async ({ idSucursal }) => {
      const idPedido = leerId(id)
      const accion = validarAccionPedido(await leerCuerpo(request))

      const actualizado = await db.$transaction(async (tx) => {
        const fila = await tx.pedido.findFirst({ where: { idPedido, idSucursal }, select: camposPedido })
        if (!fila) throw new ErrorPedido(404, 'No encontramos ese pedido en esta sucursal.')
        const actual = aPantalla(fila)

        let cambios: Prisma.PedidoUncheckedUpdateManyInput
        let telefonoNuevo: string | null = null
        if (accion.accion === 'cambiarTipoEntrega') {
          if (!puedeCambiarEntrega(actual) || actual.tipoEntrega === accion.tipoEntrega) throw conflicto()
          const idTipoEntrega = await buscarTipoEntrega(tx, accion.tipoEntrega)
          if (accion.tipoEntrega === 'retiro') {
            // El celular queda en el cliente: puede servir para avisarle.
            cambios = { idTipoEntrega, direccion: null, referencias: null, idLocalidad: null }
          } else {
            const zonas = await tx.sucursalLocalidad.findMany({ where: { idSucursal }, select: { idLocalidad: true } })
            await verificarLocalidadDelivery(tx, zonas.map((zona) => zona.idLocalidad), accion.idLocalidad)
            cambios = {
              idTipoEntrega, direccion: accion.direccion, referencias: accion.referencias, idLocalidad: accion.idLocalidad,
            }
            telefonoNuevo = accion.telefono
          }
        } else {
          const estados: Estados | null = accion.accion === 'deshacer'
            ? deshacerA(actual, accion.estadoAnterior)
            : aplicarAccion(actual, accion.accion)
          if (!estados) throw conflicto()
          cambios = { estadoPedido: estados.estado, estadoPago: estados.estadoPago }
        }

        // Update condicional: solo si el pedido sigue exactamente como se leyó. Si otra
        // pantalla lo cambió en el medio, no toca nada (count 0) y se responde 409.
        const { count } = await tx.pedido.updateMany({
          where: {
            idPedido, idSucursal,
            estadoPedido: fila.estadoPedido, estadoPago: fila.estadoPago, idTipoEntrega: fila.idTipoEntrega,
          },
          data: cambios,
        })
        if (count === 0) throw conflicto()
        if (telefonoNuevo !== null) {
          await tx.cliente.update({ where: { idCliente: fila.idCliente }, data: { telefono: telefonoNuevo } })
        }
        return tx.pedido.findUniqueOrThrow({ where: { idPedido }, select: camposPedido })
      })
      return responder({ pedido: aPantalla(actualizado) })
    }),
  }
}

// Monitor público de Pedidos Mostrador: sin sesión, así que devuelve lo mínimo (número,
// nombre de pila y estado) y solo de retiros en preparación o listos. Nada de celular,
// dirección, productos ni precios.
export function crearControladorMostrador(db: PrismaClient) {
  return {
    listar: async (request: Request) => {
      try {
        const valor = new URL(request.url).searchParams.get('sucursal') ?? ''
        const idSucursal = Number(valor)
        if (!/^[1-9]\d*$/.test(valor) || !idValido(idSucursal)) throw new ErrorPedido(400, 'Indicá una sucursal válida.')
        const sucursal = await db.sucursal.findUnique({ where: { idSucursal }, select: { activa: true } })
        if (!sucursal?.activa) throw new ErrorPedido(404, MENSAJE_SUCURSAL_NO_DISPONIBLE)

        const filas = await db.pedido.findMany({
          where: {
            idSucursal,
            tipoEntrega: { nombre: 'retiro' },
            estadoPedido: { in: ['en_preparacion', 'listo'] },
          },
          select: { idPedido: true, estadoPedido: true, cliente: { select: { nombre: true } } },
          orderBy: { idPedido: 'asc' },
          take: MAX_PEDIDOS_LISTA,
        })
        const pedidos: PedidoMostrador[] = filas.map((fila) => ({
          idPedido: fila.idPedido,
          cliente: fila.cliente.nombre.trim().split(/\s+/)[0] ?? '',
          estado: fila.estadoPedido as PedidoMostrador['estado'],
        }))
        return responder({ pedidos })
      } catch (error) {
        return responderError(error)
      }
    },
  }
}
