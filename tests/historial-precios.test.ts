import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { crearControladorProductos } from '../src/lib/productos/productos-administracion'

type Registro = { idHistorial: number; idProducto: number; precioAnterior: number | null; precioNuevo: number; fechaCambio: Date }
function escenario() {
  const estado = { trigger: true, consultasTrigger: 0, escrituras: 0, fallar: false }
  let producto = { idProducto: 1, nombre: 'Hamburguesa', precio: 1000, activo: true, idCategoria: 1, descripcion: null, imagenPath: null, categoria: { idCategoria: 1, nombre: 'Comidas', activa: true }, sucursales: [], extras: [], variaciones: [] }
  let registros: Registro[] = []
  const agregar = (anterior: number | null, nuevo: number) => registros.push({ idHistorial: registros.length + 1, idProducto: producto.idProducto, precioAnterior: anterior, precioNuevo: nuevo, fechaCambio: new Date('2026-10-28T12:00:00Z') })
  const leer = (idProducto: number, select?: Record<string, unknown>) => {
    if (idProducto !== producto.idProducto) return null
    const dato = structuredClone(producto)
    return select ? Object.fromEntries(Object.keys(select).map(k => [k, dato[k as keyof typeof dato]])) : dato
  }
  const doble = {
    usuario: { findUnique: async ({ where }: { where: { idUsuario: number } }) => {
      const rol = where.idUsuario === 10 ? 'admin' : where.idUsuario === 11 ? 'supervisor' : 'empleado'
      return { activo: where.idUsuario !== 13, debeCambiarContrasena: where.idUsuario === 14, rol: { nombre: rol } }
    } },
    categoria: { findUnique: async () => ({ activa: true }) },
    sucursal: { count: async () => 1 },
    producto: {
      findUnique: async ({ where, select }: { where: { idProducto: number }; select?: Record<string, unknown> }) => leer(where.idProducto, select),
      findUniqueOrThrow: async ({ where, select }: { where: { idProducto: number }; select?: Record<string, unknown> }) => { const dato = leer(where.idProducto, select); if (!dato) throw { code: 'P2025' }; return dato },
      findFirst: async () => null,
      create: async ({ data }: { data: { nombre: string; precio: number; historialPrecios: { create: { precioAnterior: number | null; precioNuevo: number } } } }) => {
        producto = { ...producto, idProducto: 2, nombre: data.nombre, precio: data.precio }
        agregar(data.historialPrecios.create.precioAnterior, data.historialPrecios.create.precioNuevo)
        estado.escrituras++; return structuredClone(producto)
      },
      update: async ({ data }: { data: { precio?: number; descripcion?: null; historialPrecios?: { create: { precioAnterior: number | null; precioNuevo: number } } } }) => {
        const anterior = producto.precio
        if (data.precio !== undefined) producto.precio = data.precio
        if (data.historialPrecios) agregar(data.historialPrecios.create.precioAnterior, data.historialPrecios.create.precioNuevo)
        if (estado.trigger && anterior !== producto.precio) agregar(anterior, producto.precio)
        estado.escrituras++
        if (estado.fallar) throw { code: 'P2034' }
        return structuredClone(producto)
      },
    },
    historialPrecioProducto: {
      count: async ({ where }: { where: { idProducto: number } }) => registros.filter(r => r.idProducto === where.idProducto).length,
      findMany: async ({ where, take, skip }: { where: { idProducto: number }; take: number; skip: number }) => structuredClone(registros.filter(r => r.idProducto === where.idProducto).sort((a, b) => +b.fechaCambio - +a.fechaCambio || b.idHistorial - a.idHistorial).slice(skip, skip + take)).map(({ idProducto: _id, ...r }) => { void _id; return r }),
    },
    $queryRaw: async (sql: TemplateStringsArray) => { assert.match(sql.join(''), /pg_trigger/); assert.match(sql.join(''), /trg_historial_precio_producto/); estado.consultasTrigger++; return [{ activo: estado.trigger }] },
    $transaction: async <T>(accion: (tx: PrismaClient) => Promise<T>, opciones: { isolationLevel: string }) => {
      assert.ok(['RepeatableRead', 'Serializable'].includes(opciones.isolationLevel))
      const antes = { producto: structuredClone(producto), registros: structuredClone(registros), escrituras: estado.escrituras }
      try { return await accion(db) } catch (e) { producto = antes.producto; registros = antes.registros; estado.escrituras = antes.escrituras; throw e }
    },
  }
  const db = doble as unknown as PrismaClient
  const controlador = (id: number | null = 10) => crearControladorProductos(db, async () => id === null ? null : { user: { idUsuario: id } })
  return { estado, controlador, agregar, registros: () => registros, producto: () => producto, db }
}
const req = (query = '', cuerpo?: unknown) => new Request('http://localhost/api/productos/gestion/1/historial-precios' + query, {
  method: cuerpo === undefined ? 'GET' : 'PATCH', headers: { 'content-type': 'application/json', origin: 'http://localhost' },
  ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
})

test('admin y supervisor consultan solo el producto solicitado con paginación y orden estable', async () => {
  const e = escenario()
  for (let i = 0; i < 65; i++) e.agregar(i, i + 1)
  e.registros().push({ ...e.registros()[0], idHistorial: 999, idProducto: 999 })
  const primera = await (await e.controlador().historialPrecios(req(), '1')).json()
  assert.equal(primera.registros.length, 30); assert.equal(primera.totalRegistros, 65); assert.equal(primera.totalPaginas, 3)
  assert.equal(primera.registros[0].idHistorial, 65); assert.equal(primera.registros.at(-1).idHistorial, 36)
  assert.deepEqual(Object.keys(primera.producto).sort(), ['activo', 'idProducto', 'nombre', 'precio'])
  assert.equal(primera.registros[0].fechaCambio, '2026-10-28T12:00:00.000Z')
  const segunda = await (await e.controlador(11).historialPrecios(req('?pagina=2'), '1')).json()
  assert.equal(segunda.registros[0].idHistorial, 35)
  const ultima = await (await e.controlador().historialPrecios(req('?pagina=999'), '1')).json()
  assert.equal(ultima.pagina, 3); assert.equal(ultima.registros.length, 5)
  assert.equal(e.estado.escrituras, 0)
})

test('historial vacío, precio inicial nulo y producto inactivo se consultan sin inventar datos', async () => {
  const e = escenario()
  let datos = await (await e.controlador().historialPrecios(req(), '1')).json()
  assert.equal(datos.totalRegistros, 0); assert.equal(datos.totalPaginas, 1); assert.deepEqual(datos.registros, [])
  e.producto().activo = false; e.agregar(null, 1000)
  datos = await (await e.controlador().historialPrecios(req(), '1')).json()
  assert.equal(datos.producto.activo, false); assert.equal(datos.registros[0].precioAnterior, null)
  assert.equal((await e.controlador().historialPrecios(req(), '999')).status, 404)
  assert.equal(e.estado.escrituras, 0)
})

test('sesión, rol, cuenta activa y cambio obligatorio de contraseña se verifican antes del historial', async () => {
  const e = escenario()
  assert.equal((await e.controlador(null).historialPrecios(req(), '1')).status, 401)
  for (const actor of [12, 13, 14]) assert.equal((await e.controlador(actor).historialPrecios(req(), '1')).status, 403)
  assert.equal(e.estado.escrituras, 0)
})

test('se rechazan identificadores, páginas y parámetros inválidos sin devolver historial', async () => {
  const c = escenario().controlador()
  for (const q of ['?pagina=0', '?pagina=-1', '?pagina=01', '?pagina=1.5', '?pagina=abc', '?pagina=9007199254740992', '?pagina=1&pagina=2', '?idProducto=2', '?limite=100']) {
    assert.equal((await c.historialPrecios(req(q), '1')).status, 400, q)
  }
  assert.equal((await c.historialPrecios(req(), '1 OR 1=1')).status, 400)
})

for (const trigger of [true, false]) test(`precio cambia una sola vez con trigger ${trigger ? 'activo' : 'ausente o desactivado'}`, async () => {
  const e = escenario(); e.estado.trigger = trigger
  const respuesta = await e.controlador().editar(req('', { precio: 1500 }), '1')
  assert.equal(respuesta.status, 200)
  assert.equal(e.producto().precio, 1500); assert.equal(e.registros().length, 1)
  assert.equal(e.registros()[0].precioAnterior, 1000); assert.equal(e.registros()[0].precioNuevo, 1500)
  assert.equal(e.estado.consultasTrigger, 1)
})

test('guardar el mismo precio o editar otros campos no crea cambios de precio ni consulta el trigger', async () => {
  const e = escenario()
  assert.equal((await e.controlador().editar(req('', { precio: 1000 }), '1')).status, 200)
  assert.equal((await e.controlador().editar(req('', { descripcion: null }), '1')).status, 200)
  assert.equal(e.registros().length, 0); assert.equal(e.estado.consultasTrigger, 0)
})

test('fallar una edición revierte el precio y el historial de la misma transacción', async () => {
  const e = escenario(); e.estado.fallar = true
  const respuesta = await e.controlador().editar(req('', { precio: 1500 }), '1')
  assert.equal(respuesta.status, 409); assert.equal(e.producto().precio, 1000); assert.equal(e.registros().length, 0)
})

test('crear conserva el precio inicial y no duplica el alta con un trigger de UPDATE', async () => {
  const e = escenario()
  const r = await e.controlador().crear(req('', { nombre: 'Producto nuevo', precio: 2000, idCategoria: 1, idSucursales: [1], idExtras: [] }))
  assert.equal(r.status, 201)
  assert.equal(e.registros().length, 1); assert.equal(e.registros()[0].precioAnterior, null); assert.equal(e.registros()[0].precioNuevo, 2000)
  assert.equal(e.estado.consultasTrigger, 0)
})

test('errores inesperados no exponen datos internos de la base', async t => {
  const e = escenario()
  t.mock.method(e.db.historialPrecioProducto, 'count', async () => { throw new Error('postgresql://privado password') })
  const r = await e.controlador().historialPrecios(req(), '1')
  assert.equal(r.status, 500); assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.doesNotMatch(JSON.stringify(await r.json()), /postgresql|password|privado/)
})
