import assert from 'node:assert/strict'
// Clave de prueba para firmar la ubicación elegida (no es la real).
process.env.NEXTAUTH_SECRET ??= 'secreto-de-prueba'
import { afterEach, test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import {
  recargoDeliveryValido, coordenadasValidas, dentroDelRadio, distanciaEnKm, leerZonas, separarDireccion,
} from '../src/lib/sucursales/radio-delivery'
import { geocodificarDireccion, localidadesCercanas } from '../src/lib/sucursales/geocodificacion'
import { prepararCoberturaDelivery, sugerirDireccionesDelivery, verificarCoberturaActual, zonasDeliveryDe } from '../src/lib/sucursales/cobertura-delivery'
import { firmarUbicacion } from '../src/lib/sucursales/ubicacion-firmada'
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
// Unos 19,5 km al sur del local, en Wilde (mismo partido).
const lejos = { latitud: -34.84, longitud: -58.3576 }
// Del otro lado del Riachuelo: Barracas, en Capital.
const barracas = { latitud: -34.645, longitud: -58.38 }
const provinciaBA = { id: '06', nombre: 'Buenos Aires' }
const partidoAvellaneda = { id: '06035', nombre: 'Avellaneda' }
const capital = { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires' }
const comuna4 = { id: '02028', nombre: 'Comuna 4' }
// Localidades de Georef (con su centro) que usa el doble de /localidades.
const localidadesGeoref: Record<string, unknown[]> = {
  '06': [
    { nombre: 'Avellaneda', centroide: { lat: origen.latitud, lon: origen.longitud }, provincia: provinciaBA, departamento: partidoAvellaneda },
    { nombre: 'Wilde', centroide: { lat: -34.83, lon: -58.36 }, provincia: provinciaBA, departamento: partidoAvellaneda },
  ],
  '02': [{ nombre: 'Barracas', centroide: { lat: barracas.latitud, lon: barracas.longitud }, provincia: capital, departamento: comuna4 }],
}
// Doble de /ubicacion: al norte del Riachuelo es Capital; al sur, Avellaneda.
function ubicacionGeoref(url: URL) {
  const capitalFederal = Number(url.searchParams.get('lat')) > -34.656
  return Response.json({ ubicacion: capitalFederal ? { provincia: capital, departamento: comuna4 } : { provincia: provinciaBA, departamento: partidoAvellaneda } })
}
function zona(idLocalidad: number, nombre: string, costoEnvio: number, provincia = 'Buenos Aires') {
  return { idLocalidad, costoEnvio, localidad: { nombre, provincia: { nombre: provincia } } }
}
// Como la configuración vieja: Avellaneda gratis y Wilde (más lejos) $2500.
const zonasBase = [zona(1, 'Avellaneda', 0), zona(2, 'Wilde', 2500)]
const zonasFormulario = [{ nombre: 'Avellaneda', provincia: 'Buenos Aires', costo: 0 }, { nombre: 'Wilde', provincia: 'Buenos Aires', costo: 2500 }]
const contexto = { localidad: 'Avellaneda', provincia: 'Buenos Aires' }
const sucursalBase = {
  idSucursal: 1, nombre: 'Avellaneda', slug: 'avellaneda', activa: true, ofreceDelivery: true, ofreceRetiro: true,
  direccion: 'Olavarría 65', idLocalidad: 1, ...origen,
  whatsapp: '1123456789', localidadesDelivery: zonasBase,
}
// Lo que recibe prepararSucursal como sucursal anterior al editar.
function anterior(sucursal: typeof sucursalBase) {
  return { ...sucursal, zonasDelivery: sucursal.localidadesDelivery.map((z) => ({ nombre: z.localidad.nombre, provincia: z.localidad.provincia.nombre, costo: z.costoEnvio })) }
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
    if (url.pathname.endsWith('/ubicacion')) return ubicacionGeoref(url)
    if (url.pathname.endsWith('/localidades') && !url.searchParams.get('nombre')) {
      return Response.json({ localidades: localidadesGeoref[url.searchParams.get('provincia') ?? ''] ?? [] })
    }
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

test('zonas: se validan nombre, provincia y costo; no se repite la misma localidad', () => {
  assert.deepEqual(leerZonas([{ nombre: ' Wilde ', provincia: 'Buenos Aires', costo: 1500 }]), [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: 1500 }])
  assert.deepEqual(leerZonas([]), [])
  for (const invalido of [null, 'x', [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: -1 }], [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: null }],
    [{ nombre: '', provincia: 'Buenos Aires', costo: 0 }], [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: 0, extra: 1 }],
    [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: 0 }, { nombre: 'wilde', provincia: 'buenos aires', costo: 100 }]]) {
    assert.equal(leerZonas(invalido), null)
  }
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
    usuario: { findUnique: async () => ({ idSucursal: 1, activo: true, debeCambiarContrasena: false, rol: { nombre: estado.rol } }) },
    asistenciaUsuario: { findFirst: async () => ({ idSucursal: 1, fechaJornada: new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) + 'T00:00:00Z'), entradaPrevista: new Date(), salidaPrevista: new Date(Date.now() + 3600000), entrada: new Date(Date.now() - 60000), salida: null }) },
    $queryRaw: async () => [await dbDoble.asistenciaUsuario.findFirst()],
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
      if (estado.cambiarRadio) sucursal.localidadesDelivery = [zona(2, 'Wilde', 2500)]
      if (estado.cambiarTarifa) sucursal.localidadesDelivery = [zona(1, 'Avellaneda', 0), zona(2, 'Wilde', 9000)]
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
  test(`${canal}: otra localidad con costo exige aceptar el recargo antes de guardar`, async () => {
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
    assert.ok(consultas() >= 2)
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
  e.sucursal.localidadesDelivery = []
  globalThis.fetch = async () => { assert.fail('Retiro no consulta Georef') }
  const cuerpo = { cliente: { nombre: 'Juan' }, tipoEntrega: 'retiro', metodoPago: 'efectivo', items: cuerpoDelivery.items }
  assert.equal((await e.interno.crearCaja(request(cuerpo))).status, 201)
  assert.equal((await e.online.crear(request({ ...cuerpo, cliente: cuerpoDelivery.cliente, slugSucursal: 'avellaneda' }))).status, 201)
})
test('no se aceptan coordenadas ni radio enviados por el comprador para evitar la validación', () => {
  assert.throws(() => validarPedidoCaja({ ...cuerpoDelivery, latitud: 0, longitud: 0, radioDeliveryKm: 100 }))
  assert.throws(() => validarPedidoOnline({ ...cuerpoDelivery, slugSucursal: 'avellaneda', latitud: 0, longitud: 0, radioDeliveryKm: 100 }))
})
test('sucursal sin localidades de delivery se rechaza; con localidades cotiza', async () => {
  const e = escenario()
  e.sucursal.localidadesDelivery = []
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null), esError(409))
  e.sucursal.localidadesDelivery = zonasBase
  mockGeoref()
  assert.equal((await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, 'Olavarría 100', 1)).cotizacion.recargoDelivery, 0)
})

test('la comparación de cobertura detecta el cambio de ubicación', () => {
  assert.throws(() => verificarCoberturaActual({ ...sucursalBase, latitud: 0 }, { sucursal: sucursalBase, idLocalidad: 1, cotizacion: { localidad: 'Avellaneda', recargoDelivery: 0 } }), esError(409))
})
test('editar las zonas conserva coordenadas; cambiar dirección geocodifica nuevamente', async () => {
  const e = escenario()
  let consultas = mockGeoref()
  const radio = await prepararSucursal(e.db, { zonasDelivery: [{ nombre: 'Avellaneda', provincia: 'Buenos Aires', costo: 500 }] }, anterior(e.sucursal))
  assert.equal(radio.latitud, origen.latitud)
  assert.equal(consultas(), 0)
  consultas = mockGeoref()
  const nueva = await prepararSucursal(e.db, { direccion: 'Olavarría 100' }, anterior(e.sucursal))
  assert.equal(nueva.latitud, cerca.latitud)
  assert.equal(consultas(), 2)
})
test('deshabilitar delivery limpia cobertura; coordenadas manuales válidas no consultan Georef', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  assert.deepEqual(await prepararSucursal(e.db, { ofreceDelivery: false }, anterior(e.sucursal)), { ofreceDelivery: false, zonasDelivery: [], latitud: null, longitud: null })
  const preparada = await prepararSucursal(e.db, { latitud: cerca.latitud, longitud: cerca.longitud }, anterior(e.sucursal))
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
test('alta con localidad nueva prepara ubicación sin crear registros; exige zonas y coordenadas coherentes', async () => {
  const e = escenario()
  mockGeoref()
  const datos = { nombre: 'Local nuevo', direccion: 'Olavarría 100', zonasDelivery: zonasFormulario, localidadNueva: { nombre: 'Avellaneda', nombreProvincia: 'Buenos Aires' } }
  const preparada = await prepararSucursal(e.db, datos)
  assert.equal(preparada.latitud, cerca.latitud)
  assert.equal(e.estado.clientes + e.estado.pedidos + e.estado.cambios, 0)
  for (const cambio of [{ zonasDelivery: [] }, { zonasDelivery: [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: -5 }] }, { latitud: 0 }, { latitud: 91, longitud: 0 }]) {
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

test('costo del envío: pesos enteros válidos; las zonas viajan validadas', () => {
  for (const importe of [0, 1, 2500, 10000000]) assert.equal(recargoDeliveryValido(importe), true)
  for (const importe of [-1, 0.5, 10000001, Infinity, NaN, null, '2500']) assert.equal(recargoDeliveryValido(importe), false)
  assert.deepEqual(validarSucursal({ zonasDelivery: zonasFormulario }, true).zonasDelivery, zonasFormulario)
  assert.throws(() => validarSucursal({ zonasDelivery: [{ nombre: 'Wilde', provincia: 'Buenos Aires', costo: -1 }] }, true))
  assert.throws(() => validarSucursal({ nombre: 'Nueva', direccion: 'Mitre 1', idLocalidad: 1, zonasDelivery: [] }, false), esError(400))
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
    e.sucursal.localidadesDelivery = [zona(1, 'Avellaneda', 0), zona(2, 'Wilde', 9000)]
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

test('una localidad con costo 0 entrega sin adicional aunque quede lejos', async () => {
  const e = escenario()
  e.sucursal.localidadesDelivery = [zona(2, 'Wilde', 0)]
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

test('localidad sin delivery: se rechaza con su nombre aunque esté cerca (Barracas, del otro lado del Riachuelo)', async () => {
  const e = escenario()
  mockGeoref([direccionGeoref(barracas)])
  await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null),
    (error: unknown) => error instanceof ErrorSucursal && error.estado === 400 && /No hacemos delivery a Barracas/.test(error.message))
})
test('cada localidad cobra su costo y el pedido guarda la localidad donde cayó la dirección', async () => {
  const e = escenario()
  mockGeoref([direccionGeoref(lejos)])
  const cobertura = await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, cuerpoDelivery.direccion, null)
  assert.deepEqual(cobertura.cotizacion, { localidad: 'Wilde', recargoDelivery: 2500 })
  assert.equal(cobertura.idLocalidad, 2)
  mockGeoref([direccionGeoref(lejos)])
  const respuesta = await e.online.crear(request({ ...cuerpoDelivery, recargoDeliveryAceptado: 2500, slugSucursal: 'avellaneda' }))
  assert.equal(respuesta.status, 201)
  assert.equal((e.estado.guardados[0] as unknown as { idLocalidad: number }).idLocalidad, 2)
})
test('editar sin mandar zonas conserva las guardadas; sin zonas no se puede ofrecer delivery', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  assert.deepEqual((await prepararSucursal(e.db, { nombre: 'Otro' }, anterior(e.sucursal))).zonasDelivery, zonasFormulario)
  e.sucursal.localidadesDelivery = []
  await assert.rejects(prepararSucursal(e.db, { nombre: 'Otro' }, anterior(e.sucursal)), esError(400))
})
test('localidades cercanas al local: de la más cercana a la más lejana, incluida Capital en el AMBA', async () => {
  mockGeoref()
  const cercanas = await localidadesCercanas(origen, 25)
  assert.deepEqual(cercanas.map((l) => l.nombre), ['Avellaneda', 'Barracas', 'Wilde'])
  assert.equal(cercanas[1].partido, 'Comuna 4')
  assert.deepEqual((await localidadesCercanas(origen, 5)).map((l) => l.nombre), ['Avellaneda', 'Barracas'])
})
function sucursalConProvincia() {
  const e = escenario()
  Object.assign(e.sucursal, { localidad: { provincia: { nombre: 'Buenos Aires' } } })
  return e
}
test('sugerencias: solo direcciones cercanas, ordenadas y en el formato que después se cotiza', async () => {
  const e = sucursalConProvincia()
  const consultas: string[] = []
  let ubicaciones = 0
  globalThis.fetch = async (entrada) => {
    const url = new URL(String(entrada))
    if (url.pathname.endsWith('/ubicacion')) {
      ubicaciones++
      return Response.json({ ubicacion: { provincia: provinciaBA, departamento: partidoAvellaneda } })
    }
    consultas.push(`${url.searchParams.get('provincia')}|${url.searchParams.get('departamento') ?? ''}`)
    return Response.json({ total: 2, direcciones: [direccionGeoref(lejos), direccionGeoref(), direccionGeoref()] })
  }
  const sugerencias = await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria 100')
  assert.deepEqual(sugerencias, [{ direccion: 'Olavarria 100, Avellaneda, Buenos Aires' }])
  // Primero el partido del local (Avellaneda) y después CABA y Provincia de Buenos Aires.
  assert.deepEqual(consultas.sort(), ['02|', '06|', '06|06035'])
  // El partido del local se consulta una sola vez (puede venir guardado de otra prueba).
  await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria 101')
  assert.ok(ubicaciones <= 1)
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
test('Georef: una localidad dentro de otra localidad censal (Lanús Este en Lanús) se ubica igual', async () => {
  globalThis.fetch = async (entrada) => {
    const url = new URL(String(entrada))
    if (url.pathname.endsWith('/localidades')) {
      return Response.json({ localidades: [{ nombre: 'Lanús Este', provincia: provinciaBA, localidad_censal: { id: '06434010' } }] })
    }
    assert.equal(url.searchParams.get('localidad_censal'), '06434010')
    return Response.json({ total: 1, direcciones: [{ ...direccionGeoref(), calle: { id: 'almeyra', nombre: 'ALMEYRA' }, altura: { valor: 2117 },
      localidad: { nombre: null }, localidad_censal: { id: '06434010', nombre: 'Lanús' } }] })
  }
  assert.deepEqual(await geocodificarDireccion('Almeyra 2117', { localidad: 'Lanús Este', provincia: 'Buenos Aires' }), cerca)
})

// Doble de Georef para buscar dentro de una localidad elegida (Avellaneda o Wilde).
function mockGeorefLocalidad(direcciones: unknown[]) {
  const consultas: string[] = []
  globalThis.fetch = async (entrada) => {
    const url = new URL(String(entrada))
    const nombre = url.searchParams.get('nombre')
    if (url.pathname.endsWith('/localidades') && nombre) {
      const l = (localidadesGeoref['06'] as { nombre: string }[]).find((x) => x.nombre === nombre)
      return Response.json({ localidades: l ? [l] : [] })
    }
    if (url.pathname.endsWith('/localidades')) return Response.json({ localidades: localidadesGeoref[url.searchParams.get('provincia') ?? ''] ?? [] })
    consultas.push(`${url.pathname.split('/').pop()}|${url.searchParams.get('provincia')}|${url.searchParams.get('departamento')}`)
    return Response.json({ total: direcciones.length, direcciones })
  }
  return consultas
}
test('zonas para el cliente: localidades con su costo, ordenadas; sin delivery no hay ninguna', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  assert.deepEqual(await zonasDeliveryDe(e.db, { idSucursal: 1 }), zonasFormulario)
  e.sucursal.ofreceDelivery = false
  assert.deepEqual(await zonasDeliveryDe(e.db, { idSucursal: 1 }), [])
})
test('sugerencias dentro de la localidad elegida: solo de esa localidad, y con ubicación firmada', async () => {
  const e = sucursalConProvincia()
  // Una en Avellaneda (cerca del local) y otra en Wilde (mismo partido).
  const consultas = mockGeorefLocalidad([direccionGeoref(cerca), direccionGeoref(lejos)])
  const enWilde = await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria 100', { nombre: 'Wilde', provincia: 'Buenos Aires' })
  assert.deepEqual(consultas, ['direcciones|06|06035'])
  assert.deepEqual(enWilde.map((s) => s.direccion), ['Olavarria 100, Wilde, Buenos Aires'])
  assert.ok(enWilde[0].ubicacion)
  // Con la ubicación firmada se cotiza sin volver a buscar la dirección.
  globalThis.fetch = async () => { assert.fail('Con ubicación firmada no consulta Georef') }
  const cobertura = await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, enWilde[0].direccion, null, enWilde[0].ubicacion)
  assert.deepEqual(cobertura.cotizacion, { localidad: 'Wilde', recargoDelivery: 2500 })
  // Una localidad a la que no entrega no sugiere nada.
  assert.deepEqual(await sugerirDireccionesDelivery(e.db, { idSucursal: 1 }, 'olavarria 100', { nombre: 'Barracas', provincia: 'CABA' }), [])
})
test('ubicación firmada: si se cambia la dirección, la localidad o la sucursal se rechaza', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  const datos = { idSucursal: 1, direccion: 'Olavarria 100, Avellaneda, Buenos Aires', ...cerca, localidad: 'Avellaneda', provincia: 'Buenos Aires' }
  const token = firmarUbicacion(datos)
  const [cuerpo, firma] = token.split('.')
  const alterado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(cuerpo, 'base64url').toString()), localidad: 'Wilde' })).toString('base64url')
  for (const [direccion, ubicacion] of [
    ['Otra 1, Avellaneda, Buenos Aires', token],
    [datos.direccion, `${alterado}.${firma}`],
    [datos.direccion, firmarUbicacion({ ...datos, idSucursal: 2 })],
    [datos.direccion, firmarUbicacion(datos, Date.now() - 25 * 60 * 60 * 1000)],
  ]) {
    await assert.rejects(prepararCoberturaDelivery(e.db, { idSucursal: 1 }, direccion, null, ubicacion), esError(400))
  }
  assert.equal((await prepararCoberturaDelivery(e.db, { idSucursal: 1 }, datos.direccion, null, token)).cotizacion.recargoDelivery, 0)
})
test('pedido online con la ubicación elegida se crea sin volver a buscar la dirección', async () => {
  const e = escenario()
  globalThis.fetch = async () => { assert.fail('No debe consultar Georef') }
  const direccion = 'Olavarria 100, Wilde, Buenos Aires'
  const ubicacion = firmarUbicacion({ idSucursal: 1, direccion, ...lejos, localidad: 'Wilde', provincia: 'Buenos Aires' })
  const respuesta = await e.online.crear(request({ ...cuerpoDelivery, direccion, ubicacion, recargoDeliveryAceptado: 2500, slugSucursal: 'avellaneda' }))
  assert.equal(respuesta.status, 201)
  assert.equal((e.estado.guardados[0] as unknown as { idLocalidad: number }).idLocalidad, 2)
})
