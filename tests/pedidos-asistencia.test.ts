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

test('turnos nocturnos funcionan después de medianoche, pero se apagan exactamente al terminar el horario', () => {
  const turno = marca('2026-10-23', '19:00', '02:00')
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-24', '01:00')), true)
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-24', '02:30')), false)
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-24', '19:00')), false)
  assert.equal(turnoHabilitaPedidos(turno, 1, instanteArgentina('2026-10-25', '01:00')), false)
  assert.equal(turnoHabilitaPedidos(marca(), 1, instanteArgentina('2026-10-23', '18:00')), false)
})

function escenario() {
  let momento = instanteArgentina('2026-10-23', '10:00')
  const estado = {
    rol: 'empleado', activo: true, cambiarContrasena: false, sucursal: 1, sesion: true,
    dentro: false, cerrarAlGuardar: false, rolAlGuardar: '', sucursalAlGuardar: 0,
    clientes: 0, pedidos: 0, cambios: 0, bloqueos: 0, lecturas: 0, falloAsistencia: false, avanzarAlBloquear: false, avanzarAlCalcular: false,
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
      if (estado.avanzarAlBloquear) momento = instanteArgentina('2026-10-23', '17:01')
      const turno = seleccionar(Number(valores[0]), Number(valores[1])); return turno ? [turno] : []
    },
    sucursal: { findUnique: async () => ({ idSucursal: 1, activa: true, ofreceRetiro: true, ofreceDelivery: true, localidadesDelivery: [], slug: 'avellaneda' }) },
    negocio: { findUnique: async () => null },
    producto: { findMany: async () => { if (estado.avanzarAlCalcular) momento = instanteArgentina('2026-10-23', '17:01'); return [{ idProducto: 1, nombre: 'Hamburguesa', precio: 1000, activo: true, categoria: { activa: true }, sucursales: [{ disponible: true }], variaciones: [], extras: [] }] } },
    tipoEntrega: { findUnique: async () => ({ idTipoEntrega: 1 }) },
    cliente: { create: async () => { estado.clientes++; return { idCliente: 1 } } },
    pedido: {
      create: async ({ data }: { data: { idUsuario: number | null } }) => { estado.pedidos++; return { ...fila, idUsuario: data.idUsuario } },
      findFirst: async () => structuredClone(fila),
      updateMany: async ({ data }: { data: Partial<typeof fila> }) => { estado.cambios++; Object.assign(fila, data); return { count: 1 } },
      findUniqueOrThrow: async () => structuredClone(fila),
    },
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

test('supervisor también requiere asistencia y admin, sin sesión e inactivo siguen bloqueados', async () => {
  const e = escenario(); e.estado.rol = 'supervisor'
  assert.equal((await e.controlador.crearCaja(request())).status, 403)
  e.abrir(); assert.equal((await e.controlador.crearCaja(request())).status, 201)
  assert.equal(e.estado.bloqueos, 2)
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


test('límites del horario: antes de entrada y desde la salida no se puede operar, aunque se haya fichado temprano', () => {
  const turno = { ...marca(), entrada: instanteArgentina('2026-10-23', '08:50') }
  assert.equal(turnoHabilitaPedidos(turno, 1, new Date(+turno.entradaPrevista - 1)), false)
  assert.equal(turnoHabilitaPedidos(turno, 1, turno.entradaPrevista), true)
  assert.equal(turnoHabilitaPedidos(turno, 1, new Date(+turno.salidaPrevista - 1)), true)
  assert.equal(turnoHabilitaPedidos(turno, 1, turno.salidaPrevista), false)
})

for (const rol of ['empleado', 'supervisor']) {
  test(`${rol}: permiso, creación y cambios de estado exigen turno abierto dentro del horario`, async () => {
    const e = escenario(); e.estado.rol = rol
    const accion = () => e.controlador.actualizar(request({ accion: 'marcarEnPreparacion' }, 'PATCH'), '50')
    assert.equal((await accion()).status, 403); assert.equal(e.estado.cambios, 0)
    e.abrir()
    const permiso = await (await e.controlador.permisoCaja(request(undefined, 'GET'))).json()
    assert.equal(permiso.habilitado, true); assert.equal(permiso.requiereAsistencia, true)
    assert.equal(permiso.habilitadoHasta, instanteArgentina('2026-10-23', '17:00').toISOString())
    assert.equal((await accion()).status, 200); assert.equal(e.estado.cambios, 1)
    e.mover(instanteArgentina('2026-10-23', '17:00').toISOString())
    const vencido = await (await e.controlador.permisoCaja(request(undefined, 'GET'))).json()
    assert.equal(vencido.habilitado, false); assert.equal(vencido.habilitadoHasta, null)
    const cerrado = await accion(); assert.equal(cerrado.status, 403)
    assert.equal((await cerrado.json()).codigo, CODIGO_ASISTENCIA_REQUERIDA)
    assert.equal((await e.controlador.crearCaja(request())).status, 403)
    assert.equal(e.estado.cambios, 1); assert.equal(e.estado.clientes, 0); assert.equal(e.estado.pedidos, 0)
  })
}

test('cerrar el turno o cambiar de sucursal bloquea acciones de Cocina y Entregas por API', async () => {
  for (const caso of ['cerrada', 'otra-sucursal', 'otro-usuario']) {
    const e = escenario(); e.abrir()
    if (caso === 'cerrada') e.estado.marcas[0].salida = instanteArgentina('2026-10-23', '09:30')
    if (caso === 'otra-sucursal') e.estado.marcas[0].idSucursal = 3
    if (caso === 'otro-usuario') e.estado.marcas[0].idUsuario = 3
    assert.equal((await e.controlador.actualizar(request({ accion: 'marcarListo' }, 'PATCH'), '50')).status, 403)
    assert.equal(e.estado.cambios, 0)
  }
})

test('la hora se comprueba después de esperar el bloqueo y antes de escribir datos', async () => {
  const bloqueo = escenario(); bloqueo.abrir(); bloqueo.estado.avanzarAlBloquear = true
  assert.equal((await bloqueo.controlador.crearCaja(request())).status, 403)
  assert.equal(bloqueo.estado.clientes, 0); assert.equal(bloqueo.estado.pedidos, 0)
  const calculo = escenario(); calculo.abrir(); calculo.estado.avanzarAlCalcular = true
  assert.equal((await calculo.controlador.crearCaja(request())).status, 403)
  assert.equal(calculo.estado.clientes, 0); assert.equal(calculo.estado.pedidos, 0)
})
