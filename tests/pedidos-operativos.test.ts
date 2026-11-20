import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { crearControladorPedidosInternos } from '../src/lib/pedidos/pedidos-internos'
import { crearControladorPedidosOnline } from '../src/lib/pedidos/pedidos-online'

// El PIN se guarda con una clave del servidor: las pruebas usan una propia.
process.env.NEXTAUTH_SECRET ??= 'clave-de-prueba'

function escenario() {
  const momento = new Date('2026-10-23T23:00:00Z')
  const estado = {
    rol: 'empleado', activo: true, cambiarContrasena: false, sucursal: 1, sesion: true,
    dentro: false, rolAlGuardar: '', sucursalAlGuardar: 0,
    clientes: 0, pedidos: 0, cambios: 0, autor: null as number | null,
  }
  const fila = {
    idPedido: 50, idSucursal: 1, idCliente: 1, idTipoEntrega: 1, fecha: momento, origenPedido: 'mostrador',
    estadoPedido: 'recibido', estadoPago: 'pagado', metodoPago: 'efectivo', direccion: null,
    referencias: null, aclaracion: null, subtotal: 1000, recargoDelivery: 0, total: 1000, idLocalidad: null,
    cliente: { nombre: 'Mesa 4', apellido: null, telefono: null }, tipoEntrega: { nombre: 'retiro' }, localidad: null, detalles: [], pagos: [],
  }
  const doble = {
    usuario: { findFirst: async () => ({ idUsuario: 2 }), update: async () => ({ pinIntentosFallidos: 0 }), findUnique: async () => ({ activo: estado.activo, debeCambiarContrasena: estado.cambiarContrasena, idSucursal: estado.dentro && estado.sucursalAlGuardar ? estado.sucursalAlGuardar : estado.sucursal, rol: { nombre: estado.dentro && estado.rolAlGuardar ? estado.rolAlGuardar : estado.rol } }) },
    sucursal: { findUnique: async () => ({ idSucursal: 1, activa: true, ofreceRetiro: true, ofreceDelivery: true, localidadesDelivery: [], slug: 'avellaneda', pausaPedidosOnline: false, horarios: [] }) },
    // Caja con turno abierto y un PIN que pertenece a la persona de la sesión.
    turnoCaja: { findFirst: async () => ({ idTurno: 1, montoInicial: 0 }) },
    negocio: { findUnique: async () => null },
    producto: { findMany: async () => [{ idProducto: 1, nombre: 'Hamburguesa', precio: 1000, activo: true, categoria: { activa: true }, sucursales: [{ disponible: true }], variaciones: [], extras: [] }] },
    tipoEntrega: { findUnique: async () => ({ idTipoEntrega: 1 }) },
    cliente: { create: async () => { estado.clientes++; return { idCliente: 1 } } },
    pedido: {
      create: async ({ data }: { data: { idUsuario?: number | null } }) => {
        estado.pedidos++
        estado.autor = data.idUsuario ?? null
        return { ...fila, idUsuario: estado.autor }
      },
      findFirst: async () => structuredClone(fila),
      updateMany: async ({ data }: { data: Partial<typeof fila> }) => { estado.cambios++; Object.assign(fila, data); return { count: 1 } },
      findUniqueOrThrow: async () => structuredClone(fila),
    },
    $transaction: async <T>(accion: (tx: PrismaClient) => Promise<T>) => {
      estado.dentro = true
      try { return await accion(doble as unknown as PrismaClient) } finally { estado.dentro = false }
    },
  }
  const db = doble as unknown as PrismaClient
  const controlador = crearControladorPedidosInternos(db, async () => estado.sesion ? { user: { idUsuario: 2, rol: 'supervisor' } } : null, async () => estado.sucursal)
  return { estado, controlador, db }
}
const cuerpo = { cliente: { nombre: 'Mesa 4' }, tipoEntrega: 'retiro', metodoPago: 'efectivo', items: [{ idProducto: 1, cantidad: 1 }], idCaja: 1, pin: '1234' }
function request(datos: unknown = cuerpo, method = 'POST') {
  return new Request('http://localhost:3000/api/pedidos/caja', { method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(datos) })
}

for (const rol of ['empleado', 'supervisor']) {
  test(`${rol} puede registrar y avanzar un pedido, con autor tomado de la sesión`, async () => {
    const e = escenario()
    e.estado.rol = rol
    assert.equal((await e.controlador.crearCaja(request())).status, 201)
    assert.equal(e.estado.autor, 2)
    assert.equal((await e.controlador.actualizar(request({ accion: 'marcarEnPreparacion' }, 'PATCH'), '50')).status, 200)
    assert.equal(e.estado.cambios, 1)
  })
}

test('Caja conserva los bloqueos por sesión, cuenta, contraseña, rol y sucursal', async () => {
  const e = escenario()
  const crear = () => e.controlador.crearCaja(request())
  e.estado.sesion = false
  assert.equal((await crear()).status, 401)
  e.estado.sesion = true
  e.estado.activo = false
  assert.equal((await crear()).status, 403)
  e.estado.activo = true
  e.estado.cambiarContrasena = true
  assert.equal((await crear()).status, 403)
  e.estado.cambiarContrasena = false
  e.estado.rol = 'admin'
  assert.equal((await crear()).status, 403)
  e.estado.rol = 'empleado'
  e.estado.rolAlGuardar = 'admin'
  assert.equal((await crear()).status, 403)
  e.estado.rolAlGuardar = ''
  e.estado.sucursalAlGuardar = 3
  assert.equal((await crear()).status, 403)
  assert.equal(e.estado.pedidos, 0)
  assert.equal(e.estado.clientes, 0)
})

test('Caja no acepta un autor enviado por el navegador', async () => {
  const e = escenario()
  assert.equal((await e.controlador.crearCaja(request({ ...cuerpo, idUsuario: 8 }))).status, 400)
  assert.equal(e.estado.pedidos, 0)
})

test('un pedido de la carta conserva el autor vacío', async () => {
  const e = escenario()
  const controlador = crearControladorPedidosOnline(e.db)
  const respuesta = await controlador.crear(request({ ...cuerpo, idCaja: undefined, pin: undefined, slugSucursal: 'avellaneda', cliente: { nombre: 'Juan', telefono: '1123456789' } }))
  assert.equal(respuesta.status, 201)
  assert.equal(e.estado.pedidos, 1)
  assert.equal(e.estado.autor, null)
})
