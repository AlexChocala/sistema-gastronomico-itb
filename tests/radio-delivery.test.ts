import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import {
  cotizarDistancia, recargoDeliveryValido, coordenadasValidas, dentroDelRadio, distanciaEnKm, kmTramoValido, leerTramos, separarDireccion,
} from '../src/lib/sucursales/radio-delivery'
import { geocodificarDireccion } from '../src/lib/sucursales/geocodificacion'
import { prepararCoberturaDelivery, sugerirDireccionesDelivery, verificarCoberturaActual } from '../src/lib/sucursales/cobertura-delivery'
import { prepararSucursal } from '../src/lib/sucursales/sucursales-administracion'
import { validarSucursal, ErrorSucursal } from '../src/lib/sucursales/sucursales-validacion'
import { validarPedidoCaja, validarPedidoOnline } from '../src/lib/pedidos/pedidos-validacion'
import { crearControladorPedidosOnline } from '../src/lib/pedidos/pedidos-online'
import { crearControladorPedidosInternos } from '../src/lib/pedidos/pedidos-internos'

// Todas las consultas son dobles en memoria. No usa .env, Supabase ni direcciones reales de clientes.
const fetchOriginal = globalThis.fetch
afterEach(() => { globalThis.fetch = fetchOriginal })
const origen = { latitud: -34.6652, longitud: -58.3576 }
const cerca = { latitud: -34.666, longitud: -58.3576 }
// Unos 19,5 km al sur del local.
const lejos = { latitud: -34.84, longitud: -58.3576 }
// Como la configuración vieja: gratis hasta 5 km y $2500 más lejos (hasta 100 km).
const tramosBase = [{ hastaKm: 5, costo: 0 }, { hastaKm: 100, costo: 2500 }]
const contexto = { localidad: 'Avellaneda', provincia: 'Buenos Aires' }
const sucursalBase = {
  idSucursal: 1, nombre: 'Avellaneda', slug: 'avellaneda', activa: true, ofreceDelivery: true, ofreceRetiro: true,
  direccion: 'Olavarría 65', idLocalidad: 1, tramosDelivery: tramosBase as unknown, ...origen,
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
  for (const valor of [0.1, 0.3, 5, 100]) assert.equal(kmTramoValido(valor), true)
  for (const valor of [0, -1, 100.1, 1.01, Infinity, NaN, '5', null]) assert.equal(kmTramoValido(valor), false)
})
test('coordenadas y distancia: límites, identidad, simetría y distancia conocida de un grado', () => {
  assert.equal(coordenadasValidas(0, 0), true)
  for (const par of [[91, 0], [0, -181], [NaN, 0], [0, Infinity]]) assert.equal(coordenadasValidas(...par as [number, number]), false)
  assert.equal(distanciaEnKm(origen, origen), 0)
  assert.ok(Math.abs(distanciaEnKm({ latitud: 0, longitud: 0 }, { latitud: 0, longitud: 1 }) - 111.195) < 0.001)
  assert.equal(distanciaEnKm(origen, lejos), distanciaEnKm(lejos, origen))
  assert.ok(distanciaEnKm(origen, lejos) > 15)
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
  const estado = { guardados: [] as { subtotal: number; total: number; recargoDelivery: number }[], cambiarTarifa: false, rol: 'empleado', enTransaccion: false, clientes: 0, pedidos: 0, cambios: 0, cambiarRadio: false }
  const fila = {
    idPedido: 20, idSucursal: 1, idCliente: 1, idTipoEntrega: 1, fecha: new Date(), origenPedido: 'mostrador',
    estadoPedido: 'recibido', estadoPago: 'pagado', metodoPago: 'efectivo', direccion: null,
    referencias: null, aclaracion: null, subtotal: 1000, recargoDelivery: 0, total: 1000, idLocalidad: null,
    cliente: { nombre: 'Juan', apellido: null, telefono: '1123456789' }, tipoEntrega: { nombre: 'retiro' },
    localidad: null, detalles: [],
  }
  const dbDoble = {
    sucursal: { findUnique: async () => structuredClone(sucursal) },
    localidad: { findUnique: async () => ({ idLocalidad: 1, nombre: 'Avellaneda', provincia: { nombre: 'Buenos Aires' } }) },
    sucursalLocalidad: { findMany: async () => sucursal.localidadesDelivery },
    usuario: { findUnique: async () => ({ activo: true, debeCambiarContrasena: false, rol: { nombre: estado.rol } }) },
    negocio: { findUnique: async () => null },
    tipoEntrega: { findUnique: async () => ({ idTipoEntrega: 2 }) },
    producto: { findMany: async () => [{ idProducto: 1, nombre: 'Hamburguesa', precio: 1000, activo: true, categoria: { activa: true }, sucursales: [{ disponible: true }], variaciones: [], extras: [] }] },
    cliente: {
      create: async () => { estado.clientes++; return { idCliente: 1, nombre: 'Juan' } },
      update: async () => { estado.cambios++; return fila.cliente },
    },
    pedido: {
      create: async ({ data }: { data: { subtotal: number; total: number; recargoDelivery: number } }) => {
        estado.pedidos++; estado.guardados.push(data)
        return { ...fila, subtotal: data.subtotal, total: data.total, recargoDelivery: data.recargoDelivery }
      },
      findFirst: async () => fila,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        estado.cambios++
        for (const campo of ['total', 'recargoDelivery', 'idTipoEntrega', 'direccion', 'referencias', 'idLocalidad', 'estadoPago', 'estadoPedido']) {
          if (campo in data) Object.assign(fila, { [campo]: data[campo] })
        }
        return { count: 1 }
      },
      findUniqueOrThrow: async () => fila,
    },
    $transaction: async <T>(operacion: (tx: PrismaClient) => Promise<T>) => {
      estado.enTransaccion = true
      if (estado.cambiarRadio) sucursal.tramosDelivery = [{ hastaKm: 1, costo: 0 }, { hastaKm: 100, costo: 2500 }]
      if (estado.cambiarTarifa) sucursal.tramosDelivery = [{ hastaKm: 5, costo: 0 }, { hastaKm: 100, costo: 9000 }]
      try { return await operacion(dbDoble as unknown as PrismaClient) } finally { estado.enTransaccion = false }
    },
  }
  const db = dbDoble as unknown as PrismaClient
  const interno = crearControladorPedidosInternos(db, async () => ({ user: { idUsuario: 2 } }), async () => 1)
  return { db, fila, sucursal, estado, interno, online: crearControladorPedidosOnline(db) }
}
let ip = 0
function request(cuerpo: unknown, method = 'POST') {
  return new Request('http://localhost:3000/api/pedidos', {
    method, headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': `prueba-${++ip}` }, body: JSON.stringify(cuerpo),
  })
}
const cuerpoDelivery = {
  cliente: { nombre: 'Juan', telefono: '1123456789' }, tipoEntrega: 'delivery', metodoPago: 'efectivo',
  direccion: 'Olavarría 100, Avellaneda, Buenos Aires', recargoDeliveryAceptado: 0, items: [{ idProducto: 1, cantidad: 1 }],
}
for (const canal of ['online', 'caja', 'cambiarEntrega'] as const) {
  async function enviar(e: ReturnType<typeof escenario>) {
    if (canal === 'online') return e.online.crear(request({ ...cuerpoDelivery, slugSucursal: 'avellaneda' }))
    if (canal === 'caja') return e.interno.crearCaja(request(cuerpoDelivery))
    return e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'delivery', direccion: cuerpoDelivery.direccion, telefono: cuerpoDelivery.cliente.telefono, recargoDeliveryAceptado: 0 }, 'PATCH'), '20')
  }
  test(`${canal}: fuera de radio exige aceptar el recargo antes de guardar`, async () => {
    const e = escenario()
    mockGeoref([direccionGeoref(lejos)], () => assert.equal(e.estado.enTransaccion, false))
    const respuesta = await enviar(e)
    assert.equal(respuesta.status, 409)
    assert.match((await respuesta.json()).error, /costo del envío cambió/)
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
  e.sucursal.tramosDelivery = []
  globalThis.fetch = async () => { assert.fail('Retiro no consulta Georef') }
  const cuerpo = { cliente: { nombre: 'Juan' }, tipoEntrega: 'retiro', metodoPago: 'efectivo', items: cuerpoDelivery.items }
  assert.equal((await e.interno.crearCaja(request(cuerpo))).status, 201)
  assert.equal((await e.online.crear(request({ ...cuerpo, cliente: cuerpoDelivery.cliente, slugSucursal: 'avellaneda' }))).status, 201)
})
test('no se aceptan coordenadas ni radio enviados por el comprador para evitar la validación', () => {
  assert.throws(() => validarPedidoCaja({ ...cuerpoDelivery, latitud: 0, longitud: 0, radioDeliveryKm: 100 }))
  assert.throws(() => validarPedidoOnline({ ...cuerpoDelivery, slugSucursal: 'avellaneda', latitud: 0, longitud: 0, radioDeliveryKm: 100 }))
})
test('sucursal sin cobertura se rechaza; las localidades guardadas no limitan otras direcciones', async () => {
  const e = escenario()
  e.sucursal.tramosDelivery = []
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null), esError(409))
  e.sucursal.tramosDelivery = tramosBase
  e.sucursal.localidadesDelivery = [{ idLocalidad: 2 }]
  mockGeoref()
  assert.equal((await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, 'Olavarría 100', 1)).cotizacion.recargoDelivery, 0)
})

test('la comparación de cobertura detecta el cambio de ubicación', () => {
  assert.throws(() => verificarCoberturaActual({ ...sucursalBase, latitud: 0 }, { sucursal: sucursalBase, distanciaKm: 1, cotizacion: cotizarDistancia(1, tramosBase) }), esError(409))
})
test('editar radio conserva coordenadas; cambiar dirección geocodifica nuevamente', async () => {
  const e = escenario()
  let consultas = mockGeoref()
  const radio = await prepararSucursal(e.db, { tramosDelivery: [{ hastaKm: 3, costo: 0 }] }, e.sucursal)
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
  assert.deepEqual(await prepararSucursal(e.db, { ofreceDelivery: false }, e.sucursal), { ofreceDelivery: false, tramosDelivery: [], latitud: null, longitud: null })
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
  const datos = { nombre: 'Local nuevo', direccion: 'Olavarría 100', tramosDelivery: tramosBase, localidadNueva: { nombre: 'Avellaneda', nombreProvincia: 'Buenos Aires' } }
  const preparada = await prepararSucursal(e.db, datos)
  assert.equal(preparada.latitud, cerca.latitud)
  assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
  for (const cambio of [{ tramosDelivery: [] }, { tramosDelivery: [{ hastaKm: 0, costo: 0 }] }, { latitud: 0 }, { latitud: 91, longitud: 0 }]) {
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

test('tramos: frontera incluida, distancias lejanas y pesos enteros válidos', () => {
  for (const importe of [0, 1, 2500, 10000000]) assert.equal(recargoDeliveryValido(importe), true)
  for (const importe of [-1, 0.5, 10000001, Infinity, NaN, null, '2500']) assert.equal(recargoDeliveryValido(importe), false)
  assert.equal(cotizarDistancia(5, tramosBase).recargoDelivery, 0)
  assert.equal(cotizarDistancia(5.001, tramosBase).recargoDelivery, 2500)
  assert.equal(cotizarDistancia(80, tramosBase).recargoDelivery, 2500)
  assert.throws(() => cotizarDistancia(100.1, tramosBase))
  assert.deepEqual(validarSucursal({ tramosDelivery: tramosBase }, true).tramosDelivery, tramosBase)
  assert.throws(() => validarSucursal({ tramosDelivery: [{ hastaKm: 5, costo: -1 }] }, true))
})

for (const canal of ['online', 'caja'] as const) {
  test(canal + ': pedido lejano guarda subtotal, recargo fijo y total sin multiplicarlo por km', async () => {
    const e = escenario()
    mockGeoref([direccionGeoref(lejos)])
    const cuerpo = { ...cuerpoDelivery, recargoDeliveryAceptado: 2500 }
    const respuesta = canal === 'online' ? await e.online.crear(request({ ...cuerpo, slugSucursal: 'avellaneda' })) : await e.interno.crearCaja(request(cuerpo))
    assert.equal(respuesta.status, 201, JSON.stringify(await respuesta.clone().json()))
    const { pedido } = await respuesta.json()
    assert.equal(pedido.subtotal, 1000)
    assert.equal(pedido.recargoDelivery, 2500)
    assert.equal(pedido.total, 3500)
    assert.equal(e.estado.guardados[0].total, 3500)
    assert.equal(e.estado.guardados[0].subtotal, 1000)
    e.sucursal.tramosDelivery = [{ hastaKm: 5, costo: 0 }, { hastaKm: 100, costo: 9000 }]
    assert.equal(e.estado.guardados[0].recargoDelivery, 2500)
  })
  test(canal + ': cambio concurrente de tarifa impide crear pedidos con otro importe', async () => {
    const e = escenario()
    mockGeoref([direccionGeoref(lejos)])
    e.estado.cambiarTarifa = true
    const cuerpo = { ...cuerpoDelivery, recargoDeliveryAceptado: 2500, slugSucursal: 'avellaneda' }
    const respuesta = canal === 'online' ? await e.online.crear(request(cuerpo)) : await e.interno.crearCaja(request({ ...cuerpoDelivery, recargoDeliveryAceptado: 2500 }))
    assert.equal(respuesta.status, 409)
    assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
  })
}

test('cotizaciones pública e interna no escriben y no exponen datos del cliente ni coordenadas del local', async () => {
  const e = escenario()
  mockGeoref([direccionGeoref(lejos)])
  for (const respuesta of [
    await e.online.cotizarDelivery(request({ direccion: cuerpoDelivery.direccion, slugSucursal: 'avellaneda' })),
    await e.interno.cotizarDelivery(request({ direccion: cuerpoDelivery.direccion })),
  ]) {
    assert.equal(respuesta.status, 200)
    const datos = await respuesta.json()
    assert.deepEqual(Object.keys(datos), ['cotizacion'])
    assert.equal(datos.cotizacion.recargoDelivery, 2500)
    assert.equal('sucursal' in datos.cotizacion, false)
  }
  assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
})

test('cotizar conserva permisos: sin sesión, admin y solicitud de otro origen rechazados', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  const sinSesion = crearControladorPedidosInternos(e.db, async () => null, async () => 1)
  assert.equal((await sinSesion.cotizarDelivery(request({ direccion: cuerpoDelivery.direccion }))).status, 401)
  e.estado.rol = 'admin'
  assert.equal((await e.interno.cotizarDelivery(request({ direccion: cuerpoDelivery.direccion }))).status, 403)
  assert.equal((await e.online.cotizarDelivery(new Request('http://localhost:3000/api/pedidos/cotizacion-delivery', { method: 'POST', headers: { origin: 'https://otro.test', 'content-type': 'application/json' }, body: '{}' }))).status, 403)
})

test('delivery exige revisar un recargo y no permite enviar su propio total o tarifa', () => {
  const { recargoDeliveryAceptado, ...sinCotizar } = cuerpoDelivery
  void recargoDeliveryAceptado
  assert.throws(() => validarPedidoCaja(sinCotizar))
  assert.throws(() => validarPedidoOnline({ ...sinCotizar, slugSucursal: 'avellaneda' }))
  assert.throws(() => validarPedidoCaja({ ...cuerpoDelivery, recargoFueraRadio: 0, total: 1 }))
})

test('un tramo de costo 0 permite entregar lejos sin adicional', async () => {
  const e = escenario()
  e.sucursal.tramosDelivery = [{ hastaKm: 100, costo: 0 }]
  mockGeoref([direccionGeoref(lejos)])
  assert.equal((await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null)).cotizacion.recargoDelivery, 0)
})

test('cambiar entrega suma y quita recargo en pendientes, sin alterar subtotal', async () => {
  const e = escenario()
  e.fila.estadoPago = 'pendiente'
  mockGeoref([direccionGeoref(lejos)])
  const respuesta = await e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'delivery', direccion: cuerpoDelivery.direccion, telefono: '1123456789', recargoDeliveryAceptado: 2500 }, 'PATCH'), '20')
  assert.equal(respuesta.status, 200, JSON.stringify(await respuesta.clone().json()))
  assert.equal(e.fila.total, 3500)
  assert.equal(e.fila.subtotal, 1000)
  e.fila.tipoEntrega.nombre = 'delivery'
  assert.equal((await e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'retiro' }, 'PATCH'), '20')).status, 200)
  assert.equal(e.fila.total, 1000)
  assert.equal(e.fila.recargoDelivery, 0)
})

test('un cambio de entrega nunca suma ni quita un recargo de un pedido ya pagado', async () => {
  const e = escenario()
  mockGeoref([direccionGeoref(lejos)])
  const respuesta = await e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'delivery', direccion: cuerpoDelivery.direccion, telefono: '1123456789', recargoDeliveryAceptado: 2500 }, 'PATCH'), '20')
  assert.equal(respuesta.status, 409)
  assert.match((await respuesta.json()).error, /ya está pagado/)
  assert.equal(e.estado.cambios, 0)
  e.fila.tipoEntrega.nombre = 'delivery'; e.fila.recargoDelivery = 2500; e.fila.total = 3500
  assert.equal((await e.interno.actualizar(request({ accion: 'cambiarTipoEntrega', tipoEntrega: 'retiro' }, 'PATCH'), '20')).status, 409)
  assert.equal(e.fila.total, 3500)
})

test('tramos: más lejos del último se rechaza con un mensaje claro; cada distancia paga su tramo', async () => {
  const e = escenario()
  e.sucursal.tramosDelivery = [{ hastaKm: 5, costo: 0 }, { hastaKm: 10, costo: 1500 }]
  mockGeoref([direccionGeoref(lejos)])
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, 'Olavarría 100', 1),
    (error: unknown) => error instanceof ErrorSucursal && error.estado === 400 && /No llegamos a esa dirección/.test(error.message))
  mockGeoref()
  assert.equal((await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, 'Olavarría 100', 1)).cotizacion.recargoDelivery, 0)
  const tramos = [{ hastaKm: 8, costo: 1500 }, { hastaKm: 2, costo: 0 }, { hastaKm: 5, costo: 1000 }]
  assert.equal(cotizarDistancia(1, tramos).recargoDelivery, 0)
  assert.equal(cotizarDistancia(4.5, tramos).recargoDelivery, 1000)
  assert.equal(cotizarDistancia(6, tramos).recargoDelivery, 1500)
  assert.throws(() => cotizarDistancia(8.1, tramos))
})
test('tramos: se ordenan; se rechazan vacíos, repetidos, de más y con campos extra', () => {
  assert.deepEqual(leerTramos([{ hastaKm: 5, costo: 1000 }, { hastaKm: 2, costo: 0 }]), [{ hastaKm: 2, costo: 0 }, { hastaKm: 5, costo: 1000 }])
  for (const invalido of [[], null, 'x', [{ hastaKm: 2, costo: 0 }, { hastaKm: 2, costo: 100 }], [{ hastaKm: 2, costo: 0, extra: 1 }],
    [{ hastaKm: 2 }], Array.from({ length: 11 }, (_, i) => ({ hastaKm: i + 1, costo: 0 }))]) {
    assert.equal(leerTramos(invalido), null)
  }
  assert.throws(() => validarSucursal({ tramosDelivery: [{ hastaKm: 101, costo: 0 }] }, true), esError(400))
})
test('editar sin mandar tramos conserva los guardados; sin tramos no se puede ofrecer delivery', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  assert.deepEqual((await prepararSucursal(e.db, { nombre: 'Otro' }, e.sucursal)).tramosDelivery, tramosBase)
  e.sucursal.tramosDelivery = []
  await assert.rejects(prepararSucursal(e.db, { nombre: 'Otro' }, e.sucursal), esError(400))
})
function sucursalConProvincia() {
  const e = escenario()
  Object.assign(e.sucursal, { localidad: { provincia: { nombre: 'Buenos Aires' } } })
  return e
}
test('sugerencias: solo direcciones cercanas, ordenadas y en el formato que después se cotiza', async () => {
  const e = sucursalConProvincia()
  e.sucursal.tramosDelivery = [{ hastaKm: 5, costo: 0 }, { hastaKm: 10, costo: 1500 }]
  const provincias: string[] = []
  globalThis.fetch = async (entrada) => {
    const url = new URL(String(entrada))
    provincias.push(url.searchParams.get('provincia') ?? '')
    return Response.json({ total: 2, direcciones: [direccionGeoref(lejos), direccionGeoref(), direccionGeoref()] })
  }
  const sugerencias = await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria 100')
  assert.deepEqual(sugerencias, [{ direccion: 'Olavarria 100, Avellaneda, Buenos Aires' }])
  assert.deepEqual(provincias.sort(), ['02', '06'])
  mockGeoref()
  assert.equal((await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, sugerencias[0].direccion, null)).cotizacion.recargoDelivery, 0)
})
test('sugerencias: sin número no consulta; si Georef falla devuelve lista vacía', async () => {
  const e = sucursalConProvincia()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  assert.deepEqual(await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria'), [])
  globalThis.fetch = async () => { throw new Error('sin red') }
  assert.deepEqual(await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria 100'), [])
})
