import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estaAbierta, franjasSinSolapar, cierreAMinutos, horaAMinutos } from '../src/lib/sucursales/horario-online'
import { puedeCancelar, puedeModificar } from '../src/lib/pedidos/pedidos-estados'
import { repartirPagos, metodoPrincipal } from '../src/lib/caja/pagos'
import { pinValido } from '../src/lib/caja/pin-formato'

// Fechas en hora de Argentina (UTC-3, sin horario de verano). 2026-11-20 es viernes.
const viernes = (hora: string) => new Date(`2026-11-20T${hora}:00-03:00`)
const sabado = (hora: string) => new Date(`2026-11-21T${hora}:00-03:00`)
const franja = (diaSemana: number, abre: string, cierra: string) => {
  const abreMin = horaAMinutos(abre)!
  return { diaSemana, abreMin, cierraMin: cierreAMinutos(abreMin, cierra)! }
}

test('sin horarios cargados acepta pedidos, salvo que esté pausado', () => {
  assert.equal(estaAbierta({ pausaPedidosOnline: false, horarios: [] }, viernes('03:00')), true)
  assert.equal(estaAbierta({ pausaPedidosOnline: true, horarios: [] }, viernes('12:00')), false)
})

test('turno partido: abre en cada franja y cierra entre ellas', () => {
  const horarios = [franja(5, '08:00', '13:00'), franja(5, '18:00', '23:30')]
  const sucursal = { pausaPedidosOnline: false, horarios }
  assert.equal(estaAbierta(sucursal, viernes('09:00')), true)
  assert.equal(estaAbierta(sucursal, viernes('13:00')), false)
  assert.equal(estaAbierta(sucursal, viernes('15:00')), false)
  assert.equal(estaAbierta(sucursal, viernes('19:00')), true)
  assert.equal(estaAbierta(sucursal, viernes('23:45')), false)
})

test('un cierre pasada la medianoche sigue abierto el día siguiente', () => {
  const sucursal = { pausaPedidosOnline: false, horarios: [franja(5, '18:00', '01:00')] }
  assert.equal(estaAbierta(sucursal, viernes('23:00')), true)
  assert.equal(estaAbierta(sucursal, sabado('00:30')), true)
  assert.equal(estaAbierta(sucursal, sabado('01:30')), false)
})

test('franjas del mismo día que se pisan se rechazan', () => {
  assert.equal(franjasSinSolapar([franja(1, '08:00', '13:00'), franja(1, '18:00', '22:00')]), true)
  assert.equal(franjasSinSolapar([franja(1, '08:00', '13:00'), franja(1, '12:00', '22:00')]), false)
})

test('cancelar solo antes de preparar; modificar según el método de pago', () => {
  assert.equal(puedeCancelar({ estado: 'recibido' }), true)
  assert.equal(puedeCancelar({ estado: 'en_preparacion' }), false)
  assert.equal(puedeModificar({ origen: 'online', metodoPago: 'transferencia', estado: 'pendiente_pago' }), true)
  assert.equal(puedeModificar({ origen: 'online', metodoPago: 'transferencia', estado: 'recibido' }), false)
  assert.equal(puedeModificar({ origen: 'online', metodoPago: 'efectivo', estado: 'recibido' }), true)
  assert.equal(puedeModificar({ origen: 'online', metodoPago: 'efectivo', estado: 'en_preparacion' }), false)
  assert.equal(puedeModificar({ origen: 'mostrador', metodoPago: 'efectivo', estado: 'recibido' }), false)
})

test('pago dividido: las partes deben sumar el total y el método principal es el de mayor monto', () => {
  const partes = [{ metodo: 'efectivo' as const, monto: 4000 }, { metodo: 'transferencia' as const, monto: 6000 }]
  assert.deepEqual(repartirPagos({ metodoPago: 'efectivo', pagos: partes }, 10000), partes)
  assert.throws(() => repartirPagos({ metodoPago: 'efectivo', pagos: partes }, 9000), /no suman/)
  assert.deepEqual(repartirPagos({ metodoPago: 'efectivo', pagos: null }, 5000), [{ metodo: 'efectivo', monto: 5000 }])
  assert.equal(metodoPrincipal(partes), 'transferencia')
})

test('el PIN son exactamente 4 números', () => {
  assert.equal(pinValido('1234'), true)
  for (const malo of ['123', '12345', 'abcd', '12 4', 1234, null]) assert.equal(pinValido(malo), false)
})

import { bloquesAFranjas, franjasABloques, textoHorario } from '../src/lib/sucursales/horario-bloques'

test('horario de corrido: un bloque de lunes a sábado se guarda por día y vuelve igual', () => {
  const resultado = bloquesAFranjas([{ dias: [1, 2, 3, 4, 5, 6], abre: '10:00', cierra: '23:30' }])
  assert.ok('franjas' in resultado)
  assert.equal(resultado.franjas.length, 6)
  assert.deepEqual(franjasABloques(resultado.franjas), [{ dias: [1, 2, 3, 4, 5, 6], abre: '10:00', cierra: '23:30' }])
  assert.equal(textoHorario(resultado.franjas), 'Lun a Sáb 10 a 23:30hs')
})

test('turno partido: dos bloques con los mismos días forman un solo texto', () => {
  const resultado = bloquesAFranjas([
    { dias: [1, 2, 3, 4, 5, 6], abre: '08:00', cierra: '13:00' },
    { dias: [1, 2, 3, 4, 5, 6], abre: '18:00', cierra: '23:30' },
  ])
  assert.ok('franjas' in resultado)
  assert.equal(textoHorario(resultado.franjas), 'Lun a Sáb 8 a 13 y 18 a 23:30hs')
  assert.equal(franjasABloques(resultado.franjas).length, 2)
})

test('días con horarios distintos y cierre pasada la medianoche', () => {
  const resultado = bloquesAFranjas([
    { dias: [1, 2, 3, 4, 5], abre: '18:00', cierra: '23:00' },
    { dias: [5, 6, 0], abre: '20:00', cierra: '01:00' },
  ])
  assert.ok('error' in resultado, 'el viernes tiene dos tramos que se pisan: 18 a 23 y 20 a 1')
  const bien = bloquesAFranjas([
    { dias: [1, 2, 3, 4], abre: '18:00', cierra: '23:00' },
    { dias: [5, 6, 0], abre: '20:00', cierra: '01:00' },
  ])
  assert.ok('franjas' in bien)
  assert.equal(textoHorario(bien.franjas), 'Lun a Jue 18 a 23hs · Vie a Dom 20 a 1hs')
})

test('un bloque sin horas se ignora; con una sola hora es un error; sin días es un error', () => {
  assert.deepEqual(bloquesAFranjas([{ dias: [1], abre: '', cierra: '' }]), { franjas: [] })
  assert.ok('error' in bloquesAFranjas([{ dias: [1], abre: '10:00', cierra: '' }]))
  assert.ok('error' in bloquesAFranjas([{ dias: [], abre: '10:00', cierra: '12:00' }]))
  assert.equal(textoHorario([]), null)
})

test('los siete días con el mismo horario se dicen "Todos los días"', () => {
  const resultado = bloquesAFranjas([{ dias: [0, 1, 2, 3, 4, 5, 6], abre: '09:00', cierra: '22:00' }])
  assert.ok('franjas' in resultado)
  assert.equal(textoHorario(resultado.franjas), 'Todos los días 9 a 22hs')
})
