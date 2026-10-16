import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import {
  coordenadasValidas, dentroDelRadio, distanciaEnKm, radioDeliveryValido, separarDireccion,
} from '../src/lib/sucursales/radio-delivery'
import { geocodificarDireccion } from '../src/lib/sucursales/geocodificacion'
import { prepararCoberturaDelivery, verificarCoberturaActual } from '../src/lib/sucursales/cobertura-delivery'
import { prepararSucursal } from '../src/lib/sucursales/sucursales-administracion'
import { ErrorSucursal } from '../src/lib/sucursales/sucursales-validacion'
import { validarPedidoCaja, validarPedidoOnline } from '../src/lib/pedidos/pedidos-validacion'
import { crearControladorPedidosOnline } from '../src/lib/pedidos/pedidos-online'
import { crearControladorPedidosInternos } from '../src/lib/pedidos/pedidos-internos'

// Todas las consultas son dobles en memoria. No usa .env, Supabase ni direcciones reales de clientes.
const fetchOriginal = globalThis.fetch
afterEach(() => { globalThis.fetch = fetchOriginal })
const origen = { latitud: -34.6652, longitud: -58.3576 }
const cerca = { latitud: -34.666, longitud: -58.3576 }
const lejos = { latitud: -37.9994, longitud: -57.5469 }
const contexto = { localidad: 'Avellaneda', provincia: 'Buenos Aires' }
const sucursalBase = {
  idSucursal: 1, nombre: 'Avellaneda', slug: 'avellaneda', activa: true, ofreceDelivery: true, ofreceRetiro: true,
  direccion: 'Olavarría 65', idLocalidad: 1, radioDeliveryKm: 5, ...origen,
  whatsapp: '1123456789', localidadesDelivery: [] as { idLocalidad: number }[],
}
function direccionGeoref(punto = cerca, calle = 'OLAVARRIA', id = 'calle-1') {
  return {
    calle: { id, nombre: calle }, altura: { valor: 100 }, provincia: { id: '06', nombre: 'Buenos Aires' },
    localidad: { nombre: null }, localidad_censal: { id: '06035010', nombre: 'Avellaneda' },
    ubicacion: { lat: punto.latitud, lon: punto.longitud },
  }
}
function mockGeoref(direcciones = [direccionGeoref()], antesDeConsultar = () => {}) {
  let consultas = 0
  globalThis.fetch = async (entrada, opciones) => {
    antesDeConsultar()
    consultas++
    const url = new URL(String(entrada))
    assert.equal(url.origin, 'https://apis.datos.gob.ar')
    assert.equal(opciones?.cache, 'no-store')
    if (url.pathname.endsWith('/localidades')) {
      return Response.json({ localidades: [{ nombre: 'Avellaneda', provincia: { id: '06', nombre: 'Buenos Aires' }, localidad_censal: { id: '06035010' } }] })
    }
    assert.equal(url.searchParams.get('localidad_censal'), '06035010')
    return Response.json({ total: direcciones.length, direcciones })
  }
  return () => consultas
}
function esError(estado: number) {
  return (error: unknown) => error instanceof ErrorSucursal && error.estado === estado
}

test('radio: acepta extremos y un decimal; rechaza cero, negativos, infinitos, texto y precisión extra', () => {
  for (const valor of [0.1, 0.3, 5, 100]) assert.equal(radioDeliveryValido(valor), true)
  for (const valor of [0, -1, 100.1, 1.01, Infinity, NaN, '5', null]) assert.equal(radioDeliveryValido(valor), false)
})
test('coordenadas y distancia: límites, identidad, simetría y distancia conocida de un grado', () => {
  assert.equal(coordenadasValidas(0, 0), true)
  for (const par of [[91, 0], [0, -181], [NaN, 0], [0, Infinity]]) assert.equal(coordenadasValidas(...par as [number, number]), false)
  assert.equal(distanciaEnKm(origen, origen), 0)
  assert.ok(Math.abs(distanciaEnKm({ latitud: 0, longitud: 0 }, { latitud: 0, longitud: 1 }) - 111.195) < 0.001)
  assert.equal(distanciaEnKm(origen, lejos), distanciaEnKm(lejos, origen))
  assert.ok(distanciaEnKm(origen, lejos) > 350)
})
test('el límite incluye la frontera y no redondea una dirección fuera del radio', () => {
  assert.equal(dentroDelRadio(5, 5), true)
  assert.equal(dentroDelRadio(5.00001, 5), false)
  assert.equal(dentroDelRadio(NaN, 5), false)
})
test('sin localidad seleccionada exige dirección completa y nunca supone la ciudad de la sucursal', () => {
  assert.equal(separarDireccion('Olavarría 100'), null)
  assert.deepEqual(separarDireccion('Olavarría 100', contexto), { direccion: 'Olavarría 100', ...contexto })
  assert.equal(separarDireccion('San Martín 2500, Mar del Plata, Buenos Aires', contexto), null)
  assert.ok(separarDireccion('Corrientes 100, CABA, Capital Federal', { localidad: 'Ciudad de Buenos Aires', provincia: 'Ciudad Autónoma de Buenos Aires' }))
})
test('Georef descarta coincidencias aproximadas de otra calle y acepta duplicados cercanos de la misma', async () => {
  mockGeoref([direccionGeoref(lejos, 'OLAVARRIA NORTE', 'otra'), direccionGeoref(), direccionGeoref({ ...cerca, latitud: cerca.latitud + 0.0001 })])
  const resultado = await geocodificarDireccion('Olavarría 100', contexto)
  assert.ok(distanciaEnKm(resultado, cerca) < 0.02)
})
for (const [nombre, datos] of [
  ['sin resultados', []],
  ['calles homónimas diferentes', [direccionGeoref(), direccionGeoref(cerca, 'OLAVARRIA', 'otra')]],
  ['puntos separados', [direccionGeoref(), direccionGeoref(lejos)]],
  ['otra altura', [{ ...direccionGeoref(), altura: { valor: 101 } }]],
  ['otra provincia', [{ ...direccionGeoref(), provincia: { id: '02', nombre: 'Buenos Aires' } }]],
  ['sin coordenadas', [{ ...direccionGeoref(), ubicacion: { lat: null, lon: null } }]],
] as const) {
  test(`Georef rechaza ${nombre}`, async () => {
    // La forma inválida de ubicación se prueba como respuesta externa, sin convertirla en un Punto válido.
    globalThis.fetch = async entrada => new URL(String(entrada)).pathname.endsWith('/localidades')
      ? Response.json({ localidades: [{ nombre: 'Avellaneda', provincia: { id: '06', nombre: 'Buenos Aires' }, localidad_censal: { id: '06035010' } }] })
      : Response.json({ total: datos.length, direcciones: datos })
    await assert.rejects(geocodificarDireccion('Olavarría 100', contexto), esError(400))
  })
}
test('Georef: proveedor caído devuelve 503 y no una ubicación supuesta', async () => {
  globalThis.fetch = async () => { throw new Error('sin red') }
  await assert.rejects(geocodificarDireccion('Olavarría 100', contexto), esError(503))
})

function escenario() {
  const sucursal = structuredClone(sucursalBase)
  const estado = { enTransaccion: false, clientes: 0, pedidos: 0, cambios: 0, cambiarRadio: false }
  const fila = {
    idPedido: 20, idSucursal: 1, idCliente: 1, idTipoEntrega: 1, fecha: new Date(), origenPedido: 'mostrador',
    estadoPedido: 'recibido', estadoPago: 'pagado', metodoPago: 'efectivo', direccion: null,
    referencias: null, aclaracion: null, total: 1000, idLocalidad: null,
    cliente: { nombre: 'Juan', apellido: null, telefono: '1123456789' }, tipoEntrega: { nombre: 'retiro' },
    localidad: null, detalles: [],
  }
  const dbDoble = {
    sucursal: { findUnique: async () => structuredClone(sucursal) },
    localidad: { findUnique: async () => ({ idLocalidad: 1, nombre: 'Avellaneda', provincia: { nombre: 'Buenos Aires' } }) },
    sucursalLocalidad: { findMany: async () => sucursal.localidadesDelivery },
    usuario: { findUnique: async () => ({ activo: true, debeCambiarContrasena: false, rol: { nombre: 'empleado' } }) },
    negocio: { findUnique: async () => null },
    tipoEntrega: { findUnique: async () => ({ idTipoEntrega: 2 }) },
    producto: { findMany: async () => [{ idProducto: 1, nombre: 'Hamburguesa', precio: 1000, activo: true, categoria: { activa: true }, sucursales: [{ disponible: true }], variaciones: [], extras: [] }] },
    cliente: {
      create: async () => { estado.clientes++; return { idCliente: 1, nombre: 'Juan' } },
      update: async () => { estado.cambios++; return fila.cliente },
    },
    pedido: {
      create: async () => { estado.pedidos++; return fila },
      findFirst: async () => fila,
      updateMany: async () => { estado.cambios++; return { count: 1 } },
      findUniqueOrThrow: async () => fila,
    },
    $transaction: async <T>(operacion: (tx: PrismaClient) => Promise<T>) => {
      estado.enTransaccion = true
      if (estado.cambiarRadio) sucursal.radioDeliveryKm = 1
      try { return await operacion(dbDoble as unknown as PrismaClient) } finally { estado.enTransaccion = false }
    },
  }
  const db = dbDoble as unknown as PrismaClient
  const interno = crearControladorPedidosInternos(db, async () => ({ user: { idUsuario: 2 } }), async () => 1)
  return { db, sucursal, estado, interno, online: crearControladorPedidosOnline(db) }
}
let ip = 0
function request(cuerpo: unknown, method = 'POST') {
  return new Request('http://localhost:3000/api/pedidos', {
    method, headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': `prueba-${++ip}` }, body: JSON.stringify(cuerpo),
  })
}
const cuerpoDelivery = {
  cliente: { nombre: 'Juan', telefono: '1123456789' }, tipoEntrega: 'delivery', metodoPago: 'efectivo',
  direccion: 'Olavarría 100, Avellaneda, Buenos Aires', items: [{ idProducto: 1, cantidad: 1 }],
}
for (const canal of ['online', 'caja', 'cambiarEntrega'] as const) {
  async function enviar(e: ReturnType<typeof escenario>) {
    if (canal === 'online') return e.online.crear(request({ ...cuerpoDelivery, slugSucursal: 'avellaneda' }))
    if (canal === 'caja') return e.interno.crearCaja(request(cuerpoDelivery))
    return e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'delivery', direccion: cuerpoDelivery.direccion, telefono: cuerpoDelivery.cliente.telefono }, 'PATCH'), '20')
  }
  test(`${canal}: fuera de radio rechaza sin crear cliente, pedido ni cambiar entrega`, async () => {
    const e = escenario()
    mockGeoref([direccionGeoref(lejos)], () => assert.equal(e.estado.enTransaccion, false))
    const respuesta = await enviar(e)
    assert.equal(respuesta.status, 400)
    assert.match((await respuesta.json()).error, /fuera del radio/)
    assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
  })
  test(`${canal}: dirección cercana se acepta y Georef se consulta fuera de la transacción`, async () => {
    const e = escenario()
    const consultas = mockGeoref([direccionGeoref()], () => assert.equal(e.estado.enTransaccion, false))
    const respuesta = await enviar(e)
    assert.equal(respuesta.status, canal === 'cambiarEntrega' ? 200 : 201, JSON.stringify(await respuesta.json()))
    assert.equal(consultas(), 2)
    assert.ok(e.estado.pedidos + e.estado.cambios > 0)
  })
  test(`${canal}: cambio concurrente de cobertura devuelve 409 sin escrituras`, async () => {
    const e = escenario()
    e.estado.cambiarRadio = true
    mockGeoref()
    assert.equal((await enviar(e)).status, 409)
    assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
  })
}
test('retiro funciona sin cobertura ni acceso a Georef, tanto online como Caja', async () => {
  const e = escenario()
  e.sucursal.radioDeliveryKm = 0
  globalThis.fetch = async () => { assert.fail('Retiro no consulta Georef') }
  const cuerpo = { cliente: { nombre: 'Juan' }, tipoEntrega: 'retiro', metodoPago: 'efectivo', items: cuerpoDelivery.items }
  assert.equal((await e.interno.crearCaja(request(cuerpo))).status, 201)
  assert.equal((await e.online.crear(request({ ...cuerpo, cliente: cuerpoDelivery.cliente, slugSucursal: 'avellaneda' }))).status, 201)
})
test('no se aceptan coordenadas ni radio enviados por el comprador para evitar la validación', () => {
  assert.throws(() => validarPedidoCaja({ ...cuerpoDelivery, latitud: 0, longitud: 0, radioDeliveryKm: 100 }))
  assert.throws(() => validarPedidoOnline({ ...cuerpoDelivery, slugSucursal: 'avellaneda', latitud: 0, longitud: 0, radioDeliveryKm: 100 }))
})
test('sucursal pendiente de configurar y localidad fuera de zonas se rechazan antes de la red', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  e.sucursal.radioDeliveryKm = 0
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null), esError(409))
  e.sucursal.radioDeliveryKm = 5
  e.sucursal.localidadesDelivery = [{ idLocalidad: 2 }]
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, 1), esError(400))
})
test('la comparación de cobertura detecta el cambio de ubicación', () => {
  assert.throws(() => verificarCoberturaActual({ ...sucursalBase, latitud: 0 }, { sucursal: sucursalBase, distanciaKm: 1 }), esError(409))
})
test('editar radio conserva coordenadas; cambiar dirección geocodifica nuevamente', async () => {
  const e = escenario()
  let consultas = mockGeoref()
  const radio = await prepararSucursal(e.db, { radioDeliveryKm: 3 }, e.sucursal)
  assert.equal(radio.latitud, origen.latitud)
  assert.equal(consultas(), 0)
  consultas = mockGeoref()
  const nueva = await prepararSucursal(e.db, { direccion: 'Olavarría 100' }, e.sucursal)
  assert.equal(nueva.latitud, cerca.latitud)
  assert.equal(consultas(), 2)
})
test('deshabilitar delivery limpia cobertura; coordenadas manuales válidas no consultan Georef', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  assert.deepEqual(await prepararSucursal(e.db, { ofreceDelivery: false }, e.sucursal), { ofreceDelivery: false, radioDeliveryKm: null, latitud: null, longitud: null })
  const preparada = await prepararSucursal(e.db, { latitud: cerca.latitud, longitud: cerca.longitud }, e.sucursal)
  assert.equal(preparada.latitud, cerca.latitud)
})

test('Georef no confunde localidades homónimas en una provincia', async () => {
  globalThis.fetch = async () => Response.json({ localidades: [
    { nombre: 'Avellaneda', provincia: { id: '06', nombre: 'Buenos Aires' }, localidad_censal: { id: 'uno' } },
    { nombre: 'Avellaneda', provincia: { id: '06', nombre: 'Buenos Aires' }, localidad_censal: { id: 'dos' } },
  ] })
  await assert.rejects(geocodificarDireccion('Olavarría 100', contexto), esError(400))
})
test('Georef devuelve un error controlado ante una respuesta HTTP o JSON inválida', async () => {
  for (const respuesta of [new Response('', { status: 503 }), Response.json(null), new Response('{')]) {
    globalThis.fetch = async () => respuesta
    await assert.rejects(geocodificarDireccion('Olavarría 100', contexto), esError(503))
  }
})
test('sucursal inactiva o sin delivery se rechaza antes de consultar direcciones', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  e.sucursal.activa = false
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null), esError(404))
  e.sucursal.activa = true
  e.sucursal.ofreceDelivery = false
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null), esError(400))
})
test('las operaciones del personal conservan la exigencia de sesión antes de consultar la cobertura', async () => {
  const e = escenario()
  const sinSesion = crearControladorPedidosInternos(e.db, async () => null, async () => 1)
  globalThis.fetch = async () => { assert.fail('Sin sesión no consulta Georef') }
  assert.equal((await sinSesion.crearCaja(request(cuerpoDelivery))).status, 401)
  assert.equal((await sinSesion.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'delivery', direccion: cuerpoDelivery.direccion, telefono: '1123456789' }, 'PATCH'), '20')).status, 401)
  assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
})
test('las direcciones incompletas se rechazan en los tres puntos de entrada sin escrituras', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('Dirección incompleta no consulta Georef') }
  const cuerpo = { ...cuerpoDelivery, direccion: 'Olavarría 100' }
  assert.equal((await e.online.crear(request({ ...cuerpo, slugSucursal: 'avellaneda' }))).status, 400)
  assert.equal((await e.interno.crearCaja(request(cuerpo))).status, 400)
  assert.equal((await e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'delivery', direccion: cuerpo.direccion, telefono: '1123456789' }, 'PATCH'), '20')).status, 400)
  assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
})
test('alta con localidad nueva prepara ubicación sin crear registros; exige radio y coordenadas coherentes', async () => {
  const e = escenario()
  mockGeoref()
  const datos = { nombre: 'Local nuevo', direccion: 'Olavarría 100', radioDeliveryKm: 5, localidadNueva: { nombre: 'Avellaneda', nombreProvincia: 'Buenos Aires' } }
  const preparada = await prepararSucursal(e.db, datos)
  assert.equal(preparada.latitud, cerca.latitud)
  assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
  for (const cambio of [{ radioDeliveryKm: 0 }, { radioDeliveryKm: null }, { latitud: 0 }, { latitud: 91, longitud: 0 }]) {
    await assert.rejects(prepararSucursal(e.db, { ...datos, ...cambio }), esError(400))
  }
})

test('la provincia CABA se consulta con su identificador oficial y se verifica el barrio', async () => {
  globalThis.fetch = async entrada => {
    const url = new URL(String(entrada))
    assert.equal(url.searchParams.get('provincia'), '02')
    return url.pathname.endsWith('/localidades')
      ? Response.json({ localidades: [{ nombre: 'Recoleta', provincia: { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires' }, localidad_censal: { id: '02014010' } }] })
      : Response.json({ total: 1, direcciones: [{ ...direccionGeoref(), calle: { id: 'santafe', nombre: 'AV SANTA FE' }, altura: { valor: 2000 }, provincia: { id: '02' }, localidad: { nombre: 'Recoleta' } }] })
  }
  assert.deepEqual(await geocodificarDireccion('Avenida Santa Fe 2000', { localidad: 'Recoleta', provincia: 'CABA' }), cerca)
})
