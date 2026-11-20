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
  ErrorPedido, MENSAJE_SUCURSAL_NO_DISPONIBLE, validarAccionPedido, validarPedidoCaja, validarCotizacionDelivery, validarBusquedaDireccion,
} from './pedidos-validacion'
import {
  MENSAJE_CONFLICTO_ESTADO, aplicarAccion, deshacerA, puedeCambiarEntrega, puedeCancelar, puedeModificar,
  type EstadoPago, type EstadoPedido, type Estados, type MetodoPago, type OrigenPedido, type PedidoMostrador,
  type PedidoPantalla, type TipoEntrega,
} from './pedidos-estados'
import { buscarTipoEntrega, calcularLineas, detallesDe, verificarLocalidadDelivery } from './pedidos-online'
import { identificarPorPin } from '@/lib/caja/pin'
import { metodoPrincipal, repartirPagos } from '@/lib/caja/pagos'
import { exigirTurnoAbierto } from '@/lib/caja/turnos'
import type { AccesoPantalla } from '@/lib/pantallas/acceso'
import {
  camposCobertura, exigirRecargoAceptado, prepararCoberturaDelivery, sugerirDireccionesDelivery, verificarCoberturaActual,
  zonasDeliveryDe,
} from '@/lib/sucursales/cobertura-delivery'

type SesionPersonal = { user: { idUsuario: number } }

// Una pantalla enlazada (sin sesión) solo hace lo suyo: Cocina prepara.
const ACCIONES_DE_PANTALLA: Record<string, readonly string[]> = {
  cocina: ['marcarEnPreparacion', 'marcarListo'],
}

// Los entregados salen de la lista después de 24 horas (contadas desde que se cargó el
// pedido: no se guarda la hora de entrega). Los que no se entregaron quedan siempre, para
// que ninguno se pierda de vista, hasta el tope de filas.
const VENTANA_ENTREGADOS_MS = 24 * 60 * 60 * 1000
const MAX_PEDIDOS_LISTA = 500

const camposPedido = {
  idPedido: true, idSucursal: true, fecha: true, fechaEnCocina: true, fechaListo: true, origenPedido: true, estadoPedido: true, metodoPago: true,
  estadoPago: true, direccion: true, referencias: true, aclaracion: true, subtotal: true, recargoDelivery: true, total: true, idLocalidad: true, idCliente: true,
  idTipoEntrega: true,
  pagos: { select: { metodo: true, monto: true }, orderBy: { idPago: 'asc' } },
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

// Qué fechas guardar cuando un pedido cambia de estado: cuándo llegó a Cocina y cuándo se
// marcó listo. Al deshacer, la fecha del paso que se deshace se borra.
function marcasDeTiempo(anterior: string, nuevo: string): Prisma.PedidoUncheckedUpdateManyInput {
  const ahora = new Date()
  if (nuevo === 'pendiente_pago') return { fechaEnCocina: null, fechaListo: null }
  if (nuevo === 'recibido') return anterior === 'recibido' ? {} : { fechaEnCocina: ahora, fechaListo: null }
  if (nuevo === 'listo') return { fechaListo: ahora }
  if (nuevo === 'en_preparacion') return { fechaListo: null }
  return {}
}

// Los estados se guardan como texto; los valores posibles los escribe solo este código
// y pedidos-online, por eso se toman tal cual.
function aPantalla(fila: FilaPedido): PedidoPantalla {
  return {
    idPedido: fila.idPedido,
    idSucursal: fila.idSucursal,
    fecha: fila.fecha.toISOString(),
    fechaEnCocina: fila.fechaEnCocina?.toISOString() ?? null,
    fechaListo: fila.fechaListo?.toISOString() ?? null,
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
    subtotal: fila.subtotal,
    recargoDelivery: fila.recargoDelivery,
    total: fila.total,
    pagos: fila.pagos.map((pago) => ({ metodo: pago.metodo as MetodoPago, monto: pago.monto })),
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

async function exigirPermisoOperativo(tx: Prisma.TransactionClient, idUsuario: number, idSucursal: number) {
  // Se vuelve a leer dentro de la transacción: el rol y sucursal pudieron cambiar.
  const usuario = await tx.usuario.findUnique({ where: { idUsuario }, select: { activo: true, debeCambiarContrasena: true, idSucursal: true, rol: { select: { nombre: true } } } })
  if (!usuario?.activo || usuario.debeCambiarContrasena) throw new ErrorPedido(403, 'Tu usuario no está habilitado para registrar pedidos.')
  if (!['empleado', 'supervisor'].includes(usuario.rol.nombre)) throw new ErrorPedido(403, 'El administrador puede ver los pedidos, pero no cargarlos ni cambiarlos.')
  if (usuario.idSucursal !== idSucursal) throw new ErrorPedido(403, 'Tu sucursal asignada cambió. Actualizá la pantalla antes de registrar pedidos.')
}

// `sucursalDe` resuelve la sucursal activa de la sesión (en la app, obtenerSucursalActiva):
// se inyecta para no atar este módulo a next/headers.
export function crearControladorPedidosInternos<S extends SesionPersonal>(
  db: PrismaClient,
  leerSesion: () => Promise<S | null>,
  sucursalDe: (sesion: S) => Promise<number | null>,
  // El equipo enlazado a una pantalla (cookie de /p/{código}), para cuando no hay sesión.
  leerAcceso: () => Promise<AccesoPantalla | null> = async () => null,
) {
  // Supervisor y empleado operan los pedidos de su sucursal. El admin solo los ve: así no
  // carga ni mueve un pedido por error (por ejemplo, con otra sucursal activa).
  async function proteger(
    request: Request,
    escritura: boolean,
    accion: (personal: { idUsuario: number | null; idSucursal: number; pantalla: AccesoPantalla | null }) => Promise<Response>,
    { permitePantalla = false }: { permitePantalla?: boolean } = {},
  ) {
    try {
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) {
        // Sin sesión: solo la pantalla de Cocina enlazada, y solo donde se permite.
        const pantalla = permitePantalla ? await leerAcceso() : null
        if (pantalla && pantalla.tipo === 'cocina') {
          if (escritura && !mismoOrigen(request)) throw new ErrorPedido(403, 'La solicitud debe realizarse desde esta aplicación.')
          return await accion({ idUsuario: null, idSucursal: pantalla.idSucursal, pantalla })
        }
        throw new ErrorPedido(401, 'Iniciá sesión para ver los pedidos.')
      }
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
      return await accion({ idUsuario: sesion.user.idUsuario, idSucursal, pantalla: null })
    } catch (error) {
      return responderError(error)
    }
  }

  return {
    cotizarDelivery: (request: Request) => proteger(request, true, async ({ idSucursal }) => {
      const datos = validarCotizacionDelivery(await leerCuerpo(request), false)
      const cobertura = await prepararCoberturaDelivery(db, { idSucursal }, datos.direccion, datos.idLocalidad, datos.ubicacion)
      return responder({ cotizacion: cobertura.cotizacion })
    }),
    sugerirDirecciones: (request: Request) => proteger(request, true, async ({ idSucursal }) => {
      const datos = validarBusquedaDireccion(await leerCuerpo(request), false)
      return responder({ sugerencias: await sugerirDireccionesDelivery(db, { idSucursal }, datos.texto, datos.localidad) })
    }),
    zonasDelivery: (request: Request) => proteger(request, true, async ({ idSucursal }) =>
      responder({ zonas: await zonasDeliveryDe(db, { idSucursal }) })),
    listar: (request: Request) => proteger(request, false, async ({ idSucursal }) => {
      const desde = new Date(Date.now() - VENTANA_ENTREGADOS_MS)
      const [filas, zonas] = await db.$transaction([
        db.pedido.findMany({
          // Todos los que no se entregaron + los entregados de las últimas 24 horas.
          where: { idSucursal, OR: [{ estadoPedido: { notIn: ['entregado', 'cancelado'] } }, { fecha: { gte: desde } }] },
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
    }, { permitePantalla: true }),

    // Caja cobra ANTES de crear el pedido: entra pagado y 'recibido' (directo a Cocina). Cobra
    // quien pone su PIN (queda en cada pago) y la caja tiene que tener un turno abierto.
    crearCaja: (request: Request) => proteger(request, true, async ({ idUsuario: idSesion, idSucursal }) => {
      const idUsuario = idSesion as number // sin permitePantalla, siempre hay sesión
      const pedido = validarPedidoCaja(await leerCuerpo(request))
      // Antes de la transacción: un PIN equivocado queda contado aunque el cobro no siga.
      const cobrador = await identificarPorPin(db, { idUsuario, idSucursal }, pedido.pin)
      const cobertura = pedido.tipoEntrega === 'delivery'
        ? await prepararCoberturaDelivery(db, { idSucursal }, pedido.direccion, pedido.idLocalidad, pedido.ubicacion)
        : null
      const creado = await db.$transaction(async (tx) => {
        await exigirPermisoOperativo(tx, idUsuario, idSucursal)
        const turno = await exigirTurnoAbierto(tx, idSucursal, pedido.idCaja)
        const sucursal = await tx.sucursal.findUnique({
          where: { idSucursal },
          select: camposCobertura,
        })
        if (!sucursal?.activa) throw new ErrorPedido(404, 'La sucursal asignada no está disponible.')
        // La tarifa y la ubicación también se verifican en los pedidos del personal.
        if (pedido.tipoEntrega === 'delivery') {
          await verificarLocalidadDelivery(tx, pedido.idLocalidad)
          verificarCoberturaActual(sucursal, cobertura)
        }
        const recargoDelivery = pedido.tipoEntrega === 'delivery' ? exigirRecargoAceptado(cobertura, pedido.recargoDeliveryAceptado) : 0
        const { lineas, total: subtotal } = await calcularLineas(tx, idSucursal, pedido.items)
        const total = Math.round((subtotal + recargoDelivery) * 100) / 100
        const pagos = repartirPagos(pedido, total)
        const idTipoEntrega = await buscarTipoEntrega(tx, pedido.tipoEntrega)
        const cliente = await tx.cliente.create({
          data: { nombre: pedido.cliente.nombre, telefono: pedido.cliente.telefono },
          select: { idCliente: true },
        })
        return tx.pedido.create({
          data: {
            origenPedido: 'mostrador',
            estadoPedido: 'recibido',
            fechaEnCocina: new Date(),
            metodoPago: metodoPrincipal(pagos),
            estadoPago: 'pagado',
            direccion: pedido.direccion,
            referencias: pedido.referencias,
            aclaracion: pedido.aclaracion,
            subtotal,
            recargoDelivery,
            total,
            idCliente: cliente.idCliente,
            idSucursal,
            // Quien cobra (por PIN) es el responsable del pedido.
            idUsuario: cobrador,
            idTipoEntrega,
            idLocalidad: pedido.tipoEntrega === 'delivery' ? cobertura?.idLocalidad ?? null : null,
            detalles: { create: detallesDe(lineas) },
            pagos: { create: pagos.map((pago) => ({ metodo: pago.metodo, monto: pago.monto, idUsuario: cobrador, idTurno: turno.idTurno })) },
          },
          select: camposPedido,
        })
      })
      return responder({ pedido: aPantalla(creado) }, 201)
    }),

    actualizar: (request: Request, id: string) => proteger(request, true, async ({ idUsuario, idSucursal, pantalla }) => {
      const idPedido = leerId(id)
      const accion = validarAccionPedido(await leerCuerpo(request))
      // Sin sesión, la pantalla enlazada solo puede hacer lo suyo.
      if (pantalla && !(ACCIONES_DE_PANTALLA[pantalla.tipo] ?? []).includes(accion.accion)) {
        throw new ErrorPedido(403, 'Esta pantalla no puede hacer esa acción.')
      }
      const cobertura = accion.accion === 'cambiarTipoEntrega' && accion.tipoEntrega === 'delivery'
        ? await prepararCoberturaDelivery(db, { idSucursal }, accion.direccion, accion.idLocalidad, accion.ubicacion)
        : null

      // Quién hace la acción se identifica con su PIN. Se resuelve ANTES de la transacción: un
      // PIN equivocado queda contado aunque la acción no siga.
      let responsable: number | null = null
      if (accion.accion === 'cancelar' || accion.accion === 'agregarProductos') {
        responsable = await identificarPorPin(db, { idUsuario, idSucursal }, accion.pin)
      } else if (accion.accion === 'marcarEntregado') {
        // Entregar un pedido con efectivo por cobrar es "Entregado y cobrado": cobra quien pone su PIN.
        const previo = await db.pedido.findFirst({ where: { idPedido, idSucursal }, select: { estadoPago: true } })
        if (previo?.estadoPago === 'pendiente') {
          if (accion.pin === null || accion.idCaja === null) throw new ErrorPedido(400, 'Ingresá tu PIN para registrar el cobro.')
          responsable = await identificarPorPin(db, { idUsuario, idSucursal }, accion.pin)
        }
      }

      const actualizado = await db.$transaction(async (tx) => {
        if (idUsuario !== null) await exigirPermisoOperativo(tx, idUsuario, idSucursal)
        const fila = await tx.pedido.findFirst({ where: { idPedido, idSucursal }, select: camposPedido })
        if (!fila) throw new ErrorPedido(404, 'No encontramos ese pedido en esta sucursal.')
        const actual = aPantalla(fila)

        let cambios: Prisma.PedidoUncheckedUpdateManyInput
        let telefonoNuevo: string | null = null
        let evento: { tipo: 'cancelacion' | 'modificacion'; motivo?: string; detalle?: Prisma.InputJsonValue } | null = null
        let lineasNuevas: Awaited<ReturnType<typeof calcularLineas>>['lineas'] | null = null
        let cobro: { monto: number; idTurno: number } | null = null
        let deshacerCobro = false
        let confirmaTransferencia = false
        if (accion.accion === 'cambiarTipoEntrega') {
          if (!puedeCambiarEntrega(actual) || actual.tipoEntrega === accion.tipoEntrega) throw conflicto()
          const recargoDelivery = accion.tipoEntrega === 'delivery' ? exigirRecargoAceptado(cobertura, accion.recargoDeliveryAceptado) : 0
          if (fila.estadoPago === 'pagado' && fila.recargoDelivery !== recargoDelivery) {
            throw new ErrorPedido(409, 'Este pedido ya está pagado. No se puede cambiar la entrega si modifica el importe cobrado. Consultá al administrador.')
          }
          const importeEntrega = { recargoDelivery, total: Math.round((fila.total - fila.recargoDelivery + recargoDelivery) * 100) / 100 }
          const idTipoEntrega = await buscarTipoEntrega(tx, accion.tipoEntrega)
          if (accion.tipoEntrega === 'retiro') {
            // El celular queda en el cliente: puede servir para avisarle.
            cambios = { ...importeEntrega, idTipoEntrega, direccion: null, referencias: null, idLocalidad: null }
          } else {
            const sucursal = await tx.sucursal.findUnique({ where: { idSucursal }, select: camposCobertura })
            if (!sucursal) throw new ErrorPedido(404, 'La sucursal no está disponible.')
            verificarCoberturaActual(sucursal, cobertura)
            await verificarLocalidadDelivery(tx, accion.idLocalidad)
            cambios = {
              ...importeEntrega, idTipoEntrega, direccion: accion.direccion, referencias: accion.referencias, idLocalidad: cobertura?.idLocalidad ?? null,
            }
            telefonoNuevo = accion.telefono
          }
        } else if (accion.accion === 'cancelar') {
          if (!puedeCancelar(actual)) throw conflicto()
          cambios = { estadoPedido: 'cancelado' }
          evento = { tipo: 'cancelacion', motivo: accion.motivo }
        } else if (accion.accion === 'agregarProductos') {
          if (!puedeModificar(actual)) throw conflicto()
          const { lineas, total: subtotalNuevo } = await calcularLineas(tx, idSucursal, accion.items)
          const subtotal = Math.round((fila.subtotal + subtotalNuevo) * 100) / 100
          cambios = { subtotal, total: Math.round((subtotal + fila.recargoDelivery) * 100) / 100 }
          lineasNuevas = lineas
          evento = { tipo: 'modificacion', detalle: { agregado: accion.items } }
        } else {
          const estados: Estados | null = accion.accion === 'deshacer'
            ? deshacerA(actual, accion.estadoAnterior)
            : aplicarAccion(actual, accion.accion)
          if (!estados) throw conflicto()
          cambios = { estadoPedido: estados.estado, estadoPago: estados.estadoPago, ...marcasDeTiempo(fila.estadoPedido, estados.estado) }
          // Entregado y cobrado: el efectivo entra a la caja con turno abierto.
          if (accion.accion === 'marcarEntregado' && fila.estadoPago === 'pendiente') {
            if (responsable === null || accion.idCaja === null) throw new ErrorPedido(400, 'Ingresá tu PIN para registrar el cobro.')
            const turno = await exigirTurnoAbierto(tx, idSucursal, accion.idCaja)
            cobro = { monto: fila.total, idTurno: turno.idTurno }
          }
          // Transferencia online confirmada: queda registrado el pago, sin turno (no entra a la caja).
          if (accion.accion === 'confirmarPago') confirmaTransferencia = true
          // Deshacer un cobro (la entrega con efectivo o la confirmación de una transferencia): el
          // pedido vuelve a quedar por cobrar y ese pago se borra.
          if (accion.accion === 'deshacer' && fila.estadoPago === 'pagado' && estados.estadoPago !== 'pagado') {
            deshacerCobro = true
          }
        }

        // Update condicional: solo si el pedido sigue exactamente como se leyó. Si otra
        // pantalla lo cambió en el medio, no toca nada (count 0) y se responde 409.
        const { count } = await tx.pedido.updateMany({
          where: {
            idPedido, idSucursal,
            estadoPedido: fila.estadoPedido, estadoPago: fila.estadoPago, idTipoEntrega: fila.idTipoEntrega,
            total: fila.total, recargoDelivery: fila.recargoDelivery,
          },
          data: cambios,
        })
        if (count === 0) throw conflicto()
        if (telefonoNuevo !== null) {
          await tx.cliente.update({ where: { idCliente: fila.idCliente }, data: { telefono: telefonoNuevo } })
        }
        if (lineasNuevas) {
          await tx.pedido.update({ where: { idPedido }, data: { detalles: { create: detallesDe(lineasNuevas) } } })
        }
        if (cobro && responsable !== null) {
          await tx.pago.create({ data: { idPedido, metodo: 'efectivo', monto: cobro.monto, idUsuario: responsable, idTurno: cobro.idTurno } })
        }
        if (deshacerCobro) await tx.pago.deleteMany({ where: { idPedido } })
        if (confirmaTransferencia) {
          await tx.pago.create({ data: { idPedido, metodo: 'transferencia', monto: fila.total, idUsuario } })
        }
        if (evento) {
          await tx.eventoPedido.create({ data: { idPedido, idUsuario: responsable, tipo: evento.tipo, motivo: evento.motivo ?? null, detalle: evento.detalle } })
        }
        return tx.pedido.findUniqueOrThrow({ where: { idPedido }, select: camposPedido })
      })
      return responder({ pedido: aPantalla(actualizado) })
    }, { permitePantalla: true }),
  }
}

// Monitor público de Pedidos Mostrador: sin sesión, así que devuelve lo mínimo (número,
// nombre de pila y estado) y solo de retiros en preparación o listos. Nada de celular,
// dirección, productos ni precios.
export function crearControladorMostrador(db: PrismaClient) {
  return {
    // `idSucursal` lo resuelve la ruta: el acceso del equipo (código del link) o la sesión.
    listar: async (idSucursal: number | null) => {
      try {
        if (idSucursal === null || !idValido(idSucursal)) throw new ErrorPedido(401, 'Esta pantalla no está habilitada. Pedí el link de acceso al administrador.')
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
