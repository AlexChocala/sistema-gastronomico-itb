import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { ESTADOS_PEDIDO } from '../src/lib/pedidos/pedidos-estados'
import { PESTANAS } from '../src/lib/reportes/pestanas'
import { generarDatosDeEjemplo } from '../src/lib/reportes/datos-de-ejemplo'
import type { FiltrosReportes } from '../src/lib/reportes/tipos'
import type * as Consultas from '../src/lib/reportes/consultas'

type Pedido = Parameters<typeof Consultas.calcularReportes>[1][number]
const filtros: FiltrosReportes = { desde: '2026-10-26', hasta: '2026-10-26', sucursal: 1, agrupacion: 'dia' }
function pedido(estadoPedido: string, idPedido = 1, estadoPago = 'pagado'): Pedido {
  return {
    idPedido, idSucursal: 1, fecha: new Date('2026-10-26T15:00:00Z'), origenPedido: 'mostrador',
    estadoPedido, estadoPago, metodoPago: 'efectivo', subtotal: 1000, recargoDelivery: 0, total: 1000,
    usuario: { nombre: 'Ana', apellido: 'Pérez' }, cliente: { nombre: 'Juan', apellido: null },
    sucursal: { nombre: 'Avellaneda' }, tipoEntrega: { nombre: 'retiro' },
    detalles: [{ idProducto: 1, cantidad: 1, subtotal: 1000, producto: { nombre: 'Hamburguesa' } }],
  }
}

// Módulo real con una base simulada: ninguna prueba lee .env ni consulta Supabase.
function consultas(pedidos: Pedido[] = []) {
  const salida: typeof Consultas = {} as typeof Consultas
  const fuente = readFileSync('src/lib/reportes/consultas.ts', 'utf8')
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const dependencias: Record<string, unknown> = {
    '@/lib/pedidos/pedidos-estados': { ESTADOS_PEDIDO },
    '@/lib/db/prisma': { prisma: {
      sucursal: { findMany: async () => [{ idSucursal: 1, nombre: 'Avellaneda' }] },
      pedido: { findMany: async ({ select, where }: { select: Record<string, boolean>; where: Record<string, unknown> }) => {
        assert.equal(select.estadoPedido, true)
        assert.equal('estadoPedido' in where, false, 'No debe filtrar solo entregados')
        assert.equal('estadoPago' in where, false, 'El detalle conserva los pendientes')
        return pedidos
      } },
    } },
  }
  runInNewContext(codigo, { exports: salida, require: (nombre: string) => {
    assert.ok(nombre in dependencias, `Dependencia inesperada: ${nombre}`)
    return dependencias[nombre]
  } })
  return salida
}

test('consulta el estado guardado y lo incluye en las filas y el JSON del reporte', async () => {
  const datos = await consultas([pedido('en_preparacion')]).consultarReportes(filtros)
  assert.equal(datos.pedidos[0].estadoPedido, 'en_preparacion')
  assert.equal(JSON.parse(JSON.stringify(datos)).pedidos[0].estadoPedido, 'en_preparacion')
})

test('representa todos los estados con nombres legibles en la tabla compartida por pantalla y exportaciones', () => {
  const datos = consultas().calcularReportes(filtros, ESTADOS_PEDIDO.map((estado, i) => pedido(estado, i + 1, estado === 'pendiente_pago' ? 'pendiente_verificacion' : 'pagado')), [{ idSucursal: 1, nombre: 'Avellaneda' }])
  const detalle = PESTANAS.find(p => p.id === 'pedidos')!
  const columna = detalle.columnas.findIndex(c => c.titulo === 'Estado del pedido')
  assert.ok(columna >= 0)
  const filas = detalle.filas(datos, 'dia')
  assert.ok(filas.every(f => f.length === detalle.columnas.length))
  assert.deepEqual(Array.from(filas, f => f[columna]).sort(), ['Pendiente de pago', 'Recibido', 'En preparación', 'Listo', 'Enviado', 'Entregado'].sort())
  assert.equal(datos.pedidos.length, 6)
})

test('un pagado en preparación suma como venta; un pendiente permanece visible y no suma', () => {
  const { calcularReportes } = consultas()
  const datos = calcularReportes(filtros, [pedido('en_preparacion'), pedido('pendiente_pago', 2, 'pendiente_verificacion')], [{ idSucursal: 1, nombre: 'Avellaneda' }])
  assert.equal(datos.pedidos.length, 2)
  assert.equal(datos.resumen.totalVendido, 1000)
  assert.equal(datos.resumen.cantidadPedidos, 1)
  assert.equal(datos.pedidos.find(p => p.idPedido === 1)?.vendido, true)
  assert.equal(datos.pedidos.find(p => p.idPedido === 2)?.vendido, false)
  const entregados = calcularReportes(filtros, [pedido('entregado'), pedido('pendiente_pago', 2, 'pendiente_verificacion')], [{ idSucursal: 1, nombre: 'Avellaneda' }])
  assert.equal(entregados.resumen.totalVendido, datos.resumen.totalVendido)
})

test('no inventa un estado ante datos incompatibles y los ejemplos incluyen estados válidos', () => {
  const { calcularReportes } = consultas()
  assert.throws(() => calcularReportes(filtros, [pedido('desconocido')], []), /incompatibles/)
  const ejemplo = generarDatosDeEjemplo(filtros)
  assert.ok(ejemplo.pedidos.length > 0)
  assert.ok(ejemplo.pedidos.every(p => ESTADOS_PEDIDO.includes(p.estadoPedido)))
})
