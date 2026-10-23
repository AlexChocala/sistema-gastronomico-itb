import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { crearControladorPedidosInternos } from '../src/lib/pedidos/pedidos-internos'
import { crearControladorPedidosOnline } from '../src/lib/pedidos/pedidos-online'
import { CODIGO_ASISTENCIA_REQUERIDA, turnoHabilitaPedidos, type TurnoParaPedidos } from '../src/lib/asistencia/permiso-pedidos'
import { fechaParaBase, instanteArgentina } from '../src/lib/asistencia/reglas'

function marca(fecha = '2026-10-23', entrada = '09:00', salida = '17:00'): TurnoParaPedidos {
  return { idSucursal: 1, fechaJornada: fechaParaBase(fecha), entradaPrevista: instanteArgentina(fecha, entrada), salidaPrevista: instanteArgentina(entrada > salida ? '2026-10-24' : fecha, salida), entrada: instanteArgentina(fecha, entrada), salida: null }
}

test('permiso de jornada: requiere marca abierta propia de la sucursal y rechaza fechas viejas/futuras', () => {
  const ahora = instanteArgentina('2026-10-23', '10:00'), turno = marca()
  assert.equal(turnoHabilitaPedidos(turno, 1, ahora), true)
  assert.equal(turnoHabilitaPedidos(null, 1, ahora), false)
  assert.equal(turnoHabilitaPedidos({ ...turno, salida: ahora }, 1, ahora), false)
  assert.equal(turnoHabilitaPedidos(turno, 2, ahora), false)
  assert.equal(turnoHabilitaPedidos({ ...turno, entrada: new Date(+ahora + 60000) }, 1, ahora), false)
  assert.equal(turnoHabilitaPedidos(marca('2026-10-22'), 1, ahora), false)
})

test('turnos nocturnos siguen habilitados después de medianoche; permiten compensar minutos sin servir indefinidamente', () => {
  const turno = marca('2026-10-23', '19:00', '02:00')
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-24', '01:00')), true)
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-24', '02:30')), true)
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-24', '19:00')), false)
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-25', '01:00')), false)
  assert.equal(turnoHabilitaPedidos(marca(), 1, instanteArgentina('2026-10-23', '18:00')), true)
})

function escenario() {
  let momento = instanteArgentina('2026-10-23', '10:00')
  const estado = {
    rol: 'empleado', activo: true, cambiarContrasena: false, sucursal: 1, sesion: true,
    dentro: false, cerrarAlGuardar: false, rolAlGuardar: '', sucursalAlGuardar: 0,
    clientes: 0, pedidos: 0, bloqueos: 0, lecturas: 0, falloAsistencia: false,
    marcas: [] as (TurnoParaPedidos & { idUsuario: number })[],
  }
  const fila = {
    idPedido: 50, idSucursal: 1, idCliente: 1, idTipoEntrega: 1, fecha: momento, origenPedido: 'mostrador',
    estadoPedido: 'recibido', estadoPago: 'pagado', metodoPago: 'efectivo', direccion: null,
    referencias: null, aclaracion: null, subtotal: 1000, recargoDelivery: 0, total: 1000, idLocalidad: null,
    cliente: { nombre: 'Mesa 4', apellido: null, telefono: null }, tipoEntrega: { nombre: 'retiro' }, localidad: null, detalles: [],
  }
  const seleccionar = (idUsuario: number, idSucursal: number) => structuredClone(estado.marcas.find(m => m.idUsuario === idUsuario && m.idSucursal === idSucursal && m.salida === null) ?? null)
  const doble = {
    usuario: { findUnique: async () => ({ activo: estado.activo, debeCambiarContrasena: estado.cambiarContrasena, idSucursal: estado.dentro && estado.sucursalAlGuardar ? estado.sucursalAlGuardar : estado.sucursal, rol: { nombre: estado.dentro && estado.rolAlGuardar ? estado.rolAlGuardar : estado.rol } }) },
    asistenciaUsuario: { findFirst: async ({ where }: { where: { idUsuario: number; idSucursal: number; salida: null } }) => {
      estado.lecturas++; assert.equal(where.salida, null)
      if (estado.falloAsistencia) throw { code: 'P2021' }
      return seleccionar(where.idUsuario, where.idSucursal)
    } },
    $queryRaw: async (sql: TemplateStringsArray, ...valores: unknown[]) => {
      assert.equal(estado.dentro, true); assert.match(sql.join('?'), /FOR SHARE/)
      assert.match(sql.join('?'), /"salida" IS NULL/); assert.deepEqual(valores, [2, 1]); estado.bloqueos++
      if (estado.falloAsistencia) throw { code: 'P2021' }
      const turno = seleccionar(Number(valores[0]), Number(valores[1])); return turno ? [turno] : []
    },
    sucursal: { findUnique: async () => ({ idSucursal: 1, activa: true, ofreceRetiro: true, ofreceDelivery: true, localidadesDelivery: [], slug: 'avellaneda' }) },
    negocio: { findUnique: async () => null },
    producto: { findMany: async () => [{ idProducto: 1, nombre: 'Hamburguesa', precio: 1000, activo: true, categoria: { activa: true }, sucursales: [{ disponible: true }], variaciones: [], extras: [] }] },
    tipoEntrega: { findUnique: async () => ({ idTipoEntrega: 1 }) },
    cliente: { create: async () => { estado.clientes++; return { idCliente: 1 } } },
    pedido: { create: async ({ data }: { data: { idUsuario: number | null } }) => { estado.pedidos++; return { ...fila, idUsuario: data.idUsuario } } },
    $transaction: async <T>(accion: (tx: PrismaClient) => Promise<T>) => {
      estado.dentro = true
      if (estado.cerrarAlGuardar) estado.marcas.forEach(m => { m.salida = momento })
      try { return await accion(doble as unknown as PrismaClient) } finally { estado.dentro = false }
    },
  }
  const db = doble as unknown as PrismaClient
  const controlador = crearControladorPedidosInternos(db, async () => estado.sesion ? { user: { idUsuario: 2, rol: 'supervisor' } } : null, async () => estado.sucursal, () => new Date(momento))
  return { estado, controlador, db, mover: (fecha: string) => { momento = new Date(fecha) }, abrir: () => estado.marcas.push({ ...marca(), idUsuario: 2 }) }
}
const cuerpo = { cliente: { nombre: 'Mesa 4' }, tipoEntrega: 'retiro', metodoPago: 'efectivo', items: [{ idProducto: 1, cantidad: 1 }] }
function request(datos: unknown = cuerpo, method = 'POST') {
  return new Request('http://localhost:3000/api/pedidos/caja', { method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(datos) }) })
}

test('sin marcar asistencia, la consulta informa el bloqueo y POST directo no guarda clientes ni pedidos', async () => {
  const e = escenario()
  const permiso = await e.controlador.permisoCaja(request(undefined, 'GET'))
  assert.equal(permiso.status, 200); assert.equal((await permiso.json()).habilitado, false)
  const respuesta = await e.controlador.crearCaja(request())
  assert.equal(respuesta.status, 403); assert.equal((await respuesta.json()).codigo, CODIGO_ASISTENCIA_REQUERIDA)
  assert.equal(e.estado.clientes, 0); assert.equal(e.estado.pedidos, 0)
})

test('con asistencia abierta se registra un pedido y el servidor toma el usuario de la sesión', async () => {
  const e = escenario(); e.abrir()
  assert.equal((await (await e.controlador.permisoCaja(request(undefined, 'GET'))).json()).habilitado, true)
  const respuesta = await e.controlador.crearCaja(request()); assert.equal(respuesta.status, 201)
  assert.equal(e.estado.clientes, 1); assert.equal(e.estado.pedidos, 1); assert.equal(e.estado.bloqueos, 1)
})

for (const caso of ['cerrada', 'otro-usuario', 'otra-sucursal', 'otra-jornada'] as const) {
  test(`marca ${caso} no habilita la creación aunque se intente directamente por API`, async () => {
    const e = escenario(); e.abrir()
    if (caso === 'cerrada') e.estado.marcas[0].salida = instanteArgentina('2026-10-23', '09:30')
    if (caso === 'otro-usuario') e.estado.marcas[0].idUsuario = 8
    if (caso === 'otra-sucursal') e.estado.marcas[0].idSucursal = 2
    if (caso === 'otra-jornada') Object.assign(e.estado.marcas[0], marca('2026-10-22'))
    assert.equal((await e.controlador.crearCaja(request())).status, 403)
    assert.equal(e.estado.pedidos, 0); assert.equal(e.estado.clientes, 0)
  })
}

test('finalizar turno después de la consulta previa bloquea la confirmación al guardar', async () => {
  const e = escenario(); e.abrir()
  assert.equal((await (await e.controlador.permisoCaja(request(undefined, 'GET'))).json()).habilitado, true)
  e.estado.cerrarAlGuardar = true
  assert.equal((await e.controlador.crearCaja(request())).status, 403)
  assert.equal(e.estado.pedidos, 0); assert.equal(e.estado.clientes, 0)
})

test('rol y sucursal se vuelven a verificar en la transacción; un rol del token no saltea asistencia', async () => {
  const e = escenario(); e.abrir(); e.estado.rolAlGuardar = 'admin'
  assert.equal((await e.controlador.crearCaja(request())).status, 403)
  e.estado.rolAlGuardar = ''; e.estado.sucursalAlGuardar = 3
  assert.equal((await e.controlador.crearCaja(request())).status, 403)
  assert.equal(e.estado.pedidos, 0)
})

test('supervisor conserva su permiso y admin, sin sesión e inactivo siguen bloqueados', async () => {
  const e = escenario(); e.estado.rol = 'supervisor'
  assert.equal((await e.controlador.crearCaja(request())).status, 201)
  assert.equal(e.estado.bloqueos, 0)
  e.estado.rol = 'admin'; assert.equal((await e.controlador.crearCaja(request())).status, 403)
  e.estado.rol = 'empleado'; e.estado.activo = false; assert.equal((await e.controlador.crearCaja(request())).status, 403)
  e.estado.sesion = false; assert.equal((await e.controlador.crearCaja(request())).status, 401)
})

test('fallo al consultar asistencia bloquea el registro y no permite degradar el control', async () => {
  const e = escenario(); e.estado.falloAsistencia = true
  assert.equal((await e.controlador.permisoCaja(request(undefined, 'GET'))).status, 503)
  assert.equal((await e.controlador.crearCaja(request())).status, 503)
  assert.equal(e.estado.pedidos, 0); assert.equal(e.estado.clientes, 0)
})

test('marca enviada por el navegador no se acepta como prueba de asistencia', async () => {
  const e = escenario()
  assert.equal((await e.controlador.crearCaja(request({ ...cuerpo, asistio: true, idAsistencia: 1, idUsuario: 8 }))).status, 400)
  assert.equal(e.estado.pedidos, 0)
})

test('la carta online sigue permitiendo pedidos de clientes sin consultar asistencia del personal', async () => {
  const e = escenario()
  const controlador = crearControladorPedidosOnline(e.db)
  const respuesta = await controlador.crear(request({ ...cuerpo, slugSucursal: 'avellaneda', cliente: { nombre: 'Juan', telefono: '1123456789' } }))
  assert.equal(respuesta.status, 201)
  assert.equal(e.estado.lecturas, 0); assert.equal(e.estado.bloqueos, 0); assert.equal(e.estado.pedidos, 1)
})
