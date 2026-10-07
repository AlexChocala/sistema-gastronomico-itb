// Alta de un pedido desde el menú digital (POST /api/pedidos). Es pública: no hay
// sesión, así que todo lo que importa se decide acá con datos de la base (precios,
// disponibilidad, formas de entrega y de pago). Solo corre en el servidor.
//
// Estados con los que nace el pedido:
//   efectivo       → estadoPedido 'recibido'       y estadoPago 'pendiente' (se cobra al entregar).
//   transferencia  → estadoPedido 'pendiente_pago' y estadoPago 'pendiente_verificacion'
//                    (no pasa a Cocina hasta que alguien confirma el pago).

import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorSucursal, leerCuerpo } from '@/lib/sucursales/sucursales-validacion'
import {
  ErrorPedido, MENSAJE_LOCALIDAD, MENSAJE_SUCURSAL_NO_DISPONIBLE, validarPedidoOnline,
  type ItemPedidoOnline, type PedidoOnlineValidado, type TipoEntregaOnline,
} from './pedidos-validacion'
import { datosTransferencia } from '@/lib/negocio/negocio'

// Límite de pedidos por IP. Vive en la memoria del proceso: si la aplicación corre en
// varias instancias (o serverless), cada una lleva su propia cuenta. Al desplegar hay que
// moverlo a un almacenamiento compartido (Redis, la base, el límite del proveedor, etc.).
const MAX_PEDIDOS_POR_IP = 5
const VENTANA_LIMITE_MS = 10 * 60 * 1000
const pedidosPorIp = new Map<string, number[]>()

// La IP sale del primer valor de x-forwarded-for, que pone el proxy de la plataforma.
// Sin un proxy delante que lo pise, el cliente podría inventarlo: es un freno para el uso
// normal, no una protección contra un ataque dirigido.
function ipDe(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'desconocida'
}

function recientes(ip: string, ahora: number) {
  return (pedidosPorIp.get(ip) ?? []).filter((momento) => ahora - momento < VENTANA_LIMITE_MS)
}

// Reserva un lugar antes de procesar (así varios envíos simultáneos no pasan todos el
// límite) y devuelve el momento reservado, para liberarlo si el pedido no se crea.
function reservarLugar(ip: string) {
  const ahora = Date.now()
  const actuales = recientes(ip, ahora)
  if (actuales.length >= MAX_PEDIDOS_POR_IP) {
    throw new ErrorPedido(429, 'Hiciste varios pedidos seguidos. Esperá unos minutos e intentá de nuevo.')
  }
  pedidosPorIp.set(ip, [...actuales, ahora])
  // Limpieza de IPs viejas para que el mapa no crezca sin fin.
  if (pedidosPorIp.size > 10000) {
    for (const [clave] of pedidosPorIp) {
      if (recientes(clave, ahora).length === 0) pedidosPorIp.delete(clave)
    }
  }
  return ahora
}

// Solo cuentan los pedidos creados: corregir un dato mal cargado no gasta intentos.
function liberarLugar(ip: string, momento: number) {
  const actuales = pedidosPorIp.get(ip) ?? []
  const indice = actuales.indexOf(momento)
  if (indice !== -1) pedidosPorIp.set(ip, actuales.filter((_, posicion) => posicion !== indice))
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorPedido) return responder({ error: error.message, ...error.extra }, error.estado)
  // ErrorSucursal llega desde leerCuerpo (415 / JSON inválido).
  if (error instanceof ErrorSucursal) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2034') return responder({ error: 'Hay muchos pedidos al mismo tiempo. Intentá nuevamente.' }, 409)
  return responder({ error: 'No se pudo registrar el pedido. Intentá nuevamente más tarde.' }, 500)
}

// Precios con centavos: se redondea para no arrastrar errores de coma flotante.
function redondear(valor: number) {
  return Math.round(valor * 100) / 100
}

// ---- Reglas compartidas con el alta de Caja (lib/pedidos/pedidos-internos.ts) ----

// Localidad de un delivery. Si la sucursal tiene zonas de delivery cargadas, la
// localidad es obligatoria y tiene que ser una de ellas; si no, es opcional (pero tiene
// que existir).
export async function verificarLocalidadDelivery(
  tx: Prisma.TransactionClient,
  zonas: number[],
  idLocalidad: number | null,
) {
  if (zonas.length > 0) {
    if (idLocalidad === null) throw new ErrorPedido(400, MENSAJE_LOCALIDAD)
    if (!zonas.includes(idLocalidad)) throw new ErrorPedido(400, 'No hacemos delivery a esa localidad.')
  } else if (idLocalidad !== null) {
    const existe = await tx.localidad.findUnique({ where: { idLocalidad }, select: { idLocalidad: true } })
    if (!existe) throw new ErrorPedido(400, 'La localidad elegida no existe.')
  }
}

export async function buscarTipoEntrega(tx: Prisma.TransactionClient, nombre: TipoEntregaOnline) {
  const tipoEntrega = await tx.tipoEntrega.findUnique({ where: { nombre }, select: { idTipoEntrega: true } })
  // Los tipos de entrega los carga el seed; sin ellos no se puede guardar ningún pedido.
  if (!tipoEntrega) throw new ErrorPedido(500, 'Falta configurar los tipos de entrega.')
  return tipoEntrega.idTipoEntrega
}

// Líneas y total del pedido con los precios de la base, nunca los del cliente.
// Disponible = producto activo, de una categoría activa y habilitado en esta sucursal.
// Precio unitario = precio del producto + la variación elegida + cada extra elegido.
//
// Opciones de cada línea:
//   - Si el producto tiene variaciones disponibles, elegir una es obligatorio: sin
//     idVariacion responde 400 'Elegí una opción para {producto}.'.
//   - Una variación que no es una de las disponibles del producto (se desactivó, es de
//     otro producto o el producto ya no tiene variaciones) y un extra inactivo o que no
//     está asociado al producto hacen que la línea no se pueda preparar como se pidió: se
//     trata igual que un producto no disponible (409 con productosNoDisponibles). Así el
//     menú digital saca esas líneas del carrito en lugar de trabar al cliente con un
//     error que no puede corregir desde el checkout.
// Si falta algo responde 409 con los ids de producto afectados (sin repetir).
export async function calcularLineas(tx: Prisma.TransactionClient, idSucursal: number, items: ItemPedidoOnline[]) {
  const ids = [...new Set(items.map((item) => item.idProducto))]
  const productos = await tx.producto.findMany({
    where: { idProducto: { in: ids } },
    select: {
      idProducto: true, nombre: true, precio: true, activo: true,
      categoria: { select: { activa: true } },
      sucursales: { where: { idSucursal }, select: { disponible: true } },
      variaciones: { where: { disponible: true }, select: { idVariacion: true, nombre: true, precioAdicional: true } },
      extras: {
        where: { extra: { activo: true } },
        orderBy: { extra: { nombre: 'asc' } },
        select: { extra: { select: { idExtra: true, nombre: true, precioAdicional: true } } },
      },
    },
  })
  const porId = new Map(productos.map((producto) => [producto.idProducto, producto]))
  const noDisponibles = new Set<number>()
  // Productos que exigen elegir una variación y llegaron sin ella.
  const sinOpcion: string[] = []

  const lineas = items.flatMap(({ idProducto, cantidad, idVariacion, extras }) => {
    const producto = porId.get(idProducto)
    if (!producto || !producto.activo || !producto.categoria.activa || !producto.sucursales[0]?.disponible) {
      noDisponibles.add(idProducto)
      return []
    }
    const variacion = idVariacion === null
      ? null
      : producto.variaciones.find((opcion) => opcion.idVariacion === idVariacion)
    if (variacion === undefined) {
      noDisponibles.add(idProducto)
      return []
    }
    if (variacion === null && producto.variaciones.length > 0) {
      sinOpcion.push(producto.nombre)
      return []
    }
    // En el orden del producto (por nombre), no en el que llegaron.
    const elegidos = producto.extras.map(({ extra }) => extra).filter((extra) => extras.includes(extra.idExtra))
    if (elegidos.length !== extras.length) {
      noDisponibles.add(idProducto)
      return []
    }

    const precioVariacion = variacion?.precioAdicional ?? 0
    const precioUnitario = redondear(
      producto.precio + precioVariacion + elegidos.reduce((suma, extra) => suma + extra.precioAdicional, 0),
    )
    return [{
      idProducto,
      nombre: producto.nombre,
      cantidad,
      precioBase: producto.precio,
      idVariacion: variacion?.idVariacion ?? null,
      variacion: variacion?.nombre ?? null,
      precioVariacion,
      extras: elegidos,
      precioUnitario,
      subtotal: redondear(precioUnitario * cantidad),
    }]
  })

  if (noDisponibles.size > 0) {
    throw new ErrorPedido(409, 'Algunos productos ya no están disponibles.', {
      productosNoDisponibles: [...noDisponibles],
    })
  }
  if (sinOpcion.length > 0) throw new ErrorPedido(400, `Elegí una opción para ${sinOpcion[0]}.`)
  return { lineas, total: redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0)) }
}

type LineaPedido = Awaited<ReturnType<typeof calcularLineas>>['lineas'][number]

// Filas de DetallePedido (con sus extras) con los precios que se aplicaron.
export function detallesDe(lineas: LineaPedido[]) {
  return lineas.map((linea) => ({
    idProducto: linea.idProducto,
    idVariacion: linea.idVariacion,
    cantidad: linea.cantidad,
    precioBaseAplicado: linea.precioBase,
    precioVariacionAplicado: linea.precioVariacion,
    precioUnitario: linea.precioUnitario,
    subtotal: linea.subtotal,
    extras: {
      create: linea.extras.map((extra) => ({ idExtra: extra.idExtra, precioExtraAplicado: extra.precioAdicional })),
    },
  }))
}

// Cómo vuelve cada línea en la respuesta: variación y extras solo por nombre.
function itemRespuesta(linea: LineaPedido) {
  return {
    idProducto: linea.idProducto,
    nombre: linea.nombre,
    cantidad: linea.cantidad,
    precioUnitario: linea.precioUnitario,
    subtotal: linea.subtotal,
    variacion: linea.variacion,
    extras: linea.extras.map((extra) => extra.nombre),
  }
}

async function registrarEnTransaccion(db: PrismaClient, pedido: PedidoOnlineValidado) {
  return db.$transaction(async (tx) => {
    const sucursal = await tx.sucursal.findUnique({
      where: { slug: pedido.slugSucursal },
      select: {
        idSucursal: true, nombre: true, whatsapp: true, activa: true, ofreceRetiro: true, ofreceDelivery: true,
        localidadesDelivery: { select: { idLocalidad: true } },
      },
    })
    if (!sucursal?.activa) throw new ErrorPedido(404, MENSAJE_SUCURSAL_NO_DISPONIBLE)

    if (pedido.tipoEntrega === 'retiro' && !sucursal.ofreceRetiro) {
      throw new ErrorPedido(400, 'Esta sucursal no ofrece retiro en el local.')
    }
    if (pedido.tipoEntrega === 'delivery') {
      if (!sucursal.ofreceDelivery) throw new ErrorPedido(400, 'Esta sucursal no hace delivery.')
      await verificarLocalidadDelivery(tx, sucursal.localidadesDelivery.map((zona) => zona.idLocalidad), pedido.idLocalidad)
    }

    const negocio = await tx.negocio.findUnique({
      where: { idNegocio: 1 },
      select: { transferenciaAlias: true, transferenciaCuit: true, transferenciaTitular: true },
    })
    const transferencia = negocio ? datosTransferencia(negocio) : null
    if (pedido.metodoPago === 'transferencia' && !transferencia) {
      throw new ErrorPedido(400, 'Por ahora no se puede pagar por transferencia. Elegí efectivo.')
    }

    const { lineas, total } = await calcularLineas(tx, sucursal.idSucursal, pedido.items)
    const idTipoEntrega = await buscarTipoEntrega(tx, pedido.tipoEntrega)

    const esTransferencia = pedido.metodoPago === 'transferencia'
    const cliente = await tx.cliente.create({
      data: { nombre: pedido.cliente.nombre, telefono: pedido.cliente.telefono },
      select: { idCliente: true, nombre: true },
    })
    const creado = await tx.pedido.create({
      data: {
        origenPedido: 'online',
        estadoPedido: esTransferencia ? 'pendiente_pago' : 'recibido',
        metodoPago: pedido.metodoPago,
        estadoPago: esTransferencia ? 'pendiente_verificacion' : 'pendiente',
        // En retiro el validador ya los dejó en null.
        direccion: pedido.direccion,
        referencias: pedido.referencias,
        aclaracion: pedido.aclaracion,
        subtotal: total,
        total,
        idCliente: cliente.idCliente,
        idSucursal: sucursal.idSucursal,
        idTipoEntrega,
        idLocalidad: pedido.tipoEntrega === 'delivery' ? pedido.idLocalidad : null,
        detalles: { create: detallesDe(lineas) },
      },
      select: { idPedido: true, metodoPago: true, estadoPedido: true, estadoPago: true },
    })

    return {
      idPedido: creado.idPedido,
      cliente: { nombre: cliente.nombre },
      tipoEntrega: pedido.tipoEntrega,
      // Lo que el cliente cargó para el delivery, para el resumen de la confirmación.
      direccion: pedido.direccion,
      referencias: pedido.referencias,
      aclaracion: pedido.aclaracion,
      metodoPago: creado.metodoPago,
      estadoPedido: creado.estadoPedido,
      estadoPago: creado.estadoPago,
      items: lineas.map(itemRespuesta),
      total,
      sucursal: { nombre: sucursal.nombre, whatsapp: sucursal.whatsapp },
      // Los datos para transferir solo se devuelven a quien eligió pagar así.
      ...(esTransferencia && transferencia ? { transferencia } : {}),
    }
  }, { isolationLevel: 'Serializable', timeout: 15000 })
}

function esConflictoSerializable(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034'
}

export function crearControladorPedidosOnline(db: PrismaClient) {
  return {
    crear: async (request: Request) => {
      try {
        // Solo desde el propio menú: se rechaza si el navegador indica otro origen.
        const origen = request.headers.get('origin')
        if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ErrorPedido(403, 'La solicitud debe realizarse desde esta aplicación.')
        }
        const ip = ipDe(request)
        const momento = reservarLugar(ip)
        try {
          const pedido = validarPedidoOnline(await leerCuerpo(request))
          // Dos pedidos al mismo tiempo pueden chocar en la transacción serializable: se
          // reintenta una vez antes de pedirle al cliente que vuelva a enviarlo.
          let creado
          try {
            creado = await registrarEnTransaccion(db, pedido)
          } catch (error) {
            if (!esConflictoSerializable(error)) throw error
            creado = await registrarEnTransaccion(db, pedido)
          }
          return responder({ pedido: creado }, 201)
        } catch (error) {
          liberarLugar(ip, momento)
          throw error
        }
      } catch (error) {
        return responderError(error)
      }
    },
  }
}
