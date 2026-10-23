import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import type { PrismaClient } from '@prisma/client'
import { crearControladorAsistencia } from '../src/lib/asistencia/controlador'
import {
  ErrorAsistencia, fechaArgentina, fechaParaBase, instanteArgentina, rangoAsistencia, resultadoTurno, turnoProgramado, validarHorario,
  type HorarioDia,
} from '../src/lib/asistencia/reglas'

const viernes: HorarioDia = { diaSemana: 5, entrada: '09:00', salida: '17:00', toleranciaMinutos: 10 }
const error400 = (e: unknown) => e instanceof ErrorAsistencia && e.estado === 400

test('horarios válidos, días únicos y valores de hora/tolerancia estrictos', () => {
  assert.deepEqual(validarHorario([viernes]), [viernes])
  assert.deepEqual(validarHorario([]), [])
  for (const cambio of [{ diaSemana: 7 }, { entrada: '9:00' }, { entrada: '25:00' }, { salida: '09:00' }, { toleranciaMinutos: -1 }, { toleranciaMinutos: 121 }, { toleranciaMinutos: 2.5 }, { idUsuario: 1 }]) {
    assert.throws(() => validarHorario([{ ...viernes, ...cambio }]), error400)
  }
  assert.throws(() => validarHorario([viernes, viernes]), error400)
})
test('valida superposiciones nocturnas y el cruce domingo/lunes; permite horarios contiguos', () => {
  const noche = { ...viernes, diaSemana: 0, entrada: '19:00', salida: '02:00' }
  assert.equal(validarHorario([noche])[0].salida, '02:00')
  assert.throws(() => validarHorario([noche, { ...viernes, diaSemana: 1, entrada: '01:00' }]), error400)
  assert.equal(validarHorario([noche, { ...viernes, diaSemana: 1, entrada: '02:00' }]).length, 2)
})
test('fecha y hora usan Argentina aunque el servidor esté en UTC', () => {
  assert.equal(fechaArgentina(new Date('2026-10-24T01:00:00Z')), '2026-10-23')
  assert.equal(instanteArgentina('2026-10-23', '09:00').toISOString(), '2026-10-23T12:00:00.000Z')
})
test('el turno después de medianoche pertenece a la jornada anterior', () => {
  const horario = [{ ...viernes, entrada: '19:00', salida: '02:00' }]
  const turno = turnoProgramado(horario, new Date('2026-10-24T04:00:00Z'))!
  assert.equal(turno.fechaJornada, '2026-10-23')
  assert.equal(turno.salidaPrevista.toISOString(), '2026-10-24T05:00:00.000Z')
  assert.equal(turnoProgramado(horario, new Date('2026-10-24T06:00:00Z')), null)
})
test('puntualidad y cumplimiento son independientes; una llegada tarde se puede compensar', () => {
  const base = { fechaJornada: '2026-10-23', entradaPrevista: instanteArgentina('2026-10-23', '09:00'), salidaPrevista: instanteArgentina('2026-10-23', '17:00'), toleranciaMinutos: 10 }
  assert.equal(resultadoTurno({ ...base, entrada: instanteArgentina('2026-10-23', '09:10'), salida: null }).puntualidad, 'puntual')
  const tarde = resultadoTurno({ ...base, entrada: instanteArgentina('2026-10-23', '09:25'), salida: instanteArgentina('2026-10-23', '17:00') })
  assert.equal(tarde.puntualidad, 'tarde'); assert.equal(tarde.cumplimiento, 'incompleto'); assert.equal(tarde.minutosTrabajados, 455)
  const compensada = resultadoTurno({ ...base, entrada: instanteArgentina('2026-10-23', '09:25'), salida: instanteArgentina('2026-10-23', '17:25') })
  assert.equal(compensada.puntualidad, 'tarde'); assert.equal(compensada.cumplimiento, 'completo')
  const temprana = resultadoTurno({ ...base, entrada: instanteArgentina('2026-10-23', '09:00'), salida: instanteArgentina('2026-10-23', '16:30') })
  assert.equal(temprana.puntualidad, 'puntual'); assert.equal(temprana.salidaAnticipada, true)
  const segundos = resultadoTurno({ ...base, entrada: new Date('2026-10-23T12:00:20Z'), salida: instanteArgentina('2026-10-23', '17:00') })
  assert.equal(segundos.cumplimiento, 'incompleto', 'El redondeo visual no debe completar tiempo que no se trabajó')
})
test('rango por defecto y filtros inválidos responden de forma controlada', () => {
  const ahora = new Date('2026-10-23T12:00:00Z')
  assert.deepEqual(rangoAsistencia(new URLSearchParams(), ahora), { desde: '2026-09-24', hasta: '2026-10-23' })
  for (const texto of ['hasta=mal', 'desde=2026-02-30', 'desde=2027-01-01', 'desde=2024-01-01', 'idUsuario=1', 'desde=2026-10-01&desde=2026-10-02']) assert.throws(() => rangoAsistencia(new URLSearchParams(texto), ahora), error400)
})

type Persona = { idUsuario: number; nombre: string; apellido: string; activo: boolean; debeCambiarContrasena: boolean; idSucursal: number | null; rol: { nombre: string }; sucursal: { nombre: string; activa: boolean } | null }
type Marca = { idAsistencia: number; idUsuario: number; idSucursal: number | null; sucursalNombre: string | null; fechaJornada: Date; entradaPrevista: Date; salidaPrevista: Date; toleranciaMinutos: number; entrada: Date; salida: Date | null }
type HorarioBase = { idUsuario: number; diaSemana: number; entradaMinutos: number; salidaMinutos: number; toleranciaMinutos: number }
function escenario() {
  const personas: Persona[] = [
    { idUsuario: 1, nombre: 'Admin', apellido: 'Prueba', activo: true, debeCambiarContrasena: false, idSucursal: null, rol: { nombre: 'admin' }, sucursal: null },
    { idUsuario: 2, nombre: 'Empleado', apellido: 'Uno', activo: true, debeCambiarContrasena: false, idSucursal: 1, rol: { nombre: 'empleado' }, sucursal: { nombre: 'Avellaneda', activa: true } },
    { idUsuario: 3, nombre: 'Supervisor', apellido: 'Uno', activo: true, debeCambiarContrasena: false, idSucursal: 1, rol: { nombre: 'supervisor' }, sucursal: { nombre: 'Avellaneda', activa: true } },
    { idUsuario: 4, nombre: 'Empleado', apellido: 'Dos', activo: true, debeCambiarContrasena: false, idSucursal: 2, rol: { nombre: 'empleado' }, sucursal: { nombre: 'Quilmes', activa: true } },
    { idUsuario: 5, nombre: 'Archivado', apellido: 'Uno', activo: false, debeCambiarContrasena: false, idSucursal: 1, rol: { nombre: 'empleado' }, sucursal: { nombre: 'Avellaneda', activa: true } },
  ]
  let horarios: HorarioBase[] = [2, 3, 4].map(idUsuario => ({ idUsuario, diaSemana: 5, entradaMinutos: 540, salidaMinutos: 1020, toleranciaMinutos: 10 }))
  const marcas: Marca[] = []
  let momento = new Date('2026-10-23T12:00:00Z')
  let cola = Promise.resolve()
  const estado = { escrituras: 0, conflicto: false, cerrarCount: 1 }
  function coincide(m: Marca, w: { idUsuario?: number; idSucursal?: number | null; salida?: null; fechaJornada?: Date | { gte: Date; lte: Date } }) {
    return (w.idUsuario === undefined || m.idUsuario === w.idUsuario) && (w.idSucursal === undefined || m.idSucursal === w.idSucursal)
      && (!('salida' in w) || m.salida === null) && (!w.fechaJornada || (w.fechaJornada instanceof Date ? +m.fechaJornada === +w.fechaJornada : m.fechaJornada >= w.fechaJornada.gte && m.fechaJornada <= w.fechaJornada.lte))
  }
  const doble = {
    usuario: {
      findUnique: async ({ where }: { where: { idUsuario: number } }) => structuredClone(personas.find(p => p.idUsuario === where.idUsuario) ?? null),
      findMany: async ({ where }: { where: { idSucursal?: number | null } }) => structuredClone(personas.filter(p => where.idSucursal === undefined || p.idSucursal === where.idSucursal)),
    },
    horarioUsuario: {
      findMany: async ({ where }: { where: { idUsuario: number } }) => structuredClone(horarios.filter(h => h.idUsuario === where.idUsuario).sort((a, b) => a.diaSemana - b.diaSemana)),
      deleteMany: async ({ where }: { where: { idUsuario: number } }) => { horarios = horarios.filter(h => h.idUsuario !== where.idUsuario); estado.escrituras++; return { count: 1 } },
      createMany: async ({ data }: { data: HorarioBase[] }) => { horarios.push(...structuredClone(data)); estado.escrituras++; return { count: data.length } },
    },
    asistenciaUsuario: {
      findMany: async ({ where }: { where: Parameters<typeof coincide>[1] }) => structuredClone(marcas.filter(m => coincide(m, where)).sort((a, b) => +b.fechaJornada - +a.fechaJornada)),
      findFirst: async ({ where }: { where: Parameters<typeof coincide>[1] }) => structuredClone(marcas.find(m => coincide(m, where)) ?? null),
      findUnique: async ({ where }: { where: { idUsuario_fechaJornada: { idUsuario: number; fechaJornada: Date } } }) => structuredClone(marcas.find(m => coincide(m, where.idUsuario_fechaJornada)) ?? null),
      create: async ({ data }: { data: Omit<Marca, 'idAsistencia' | 'salida'> }) => {
        if (marcas.some(m => m.idUsuario === data.idUsuario && (m.salida === null || +m.fechaJornada === +data.fechaJornada))) throw { code: 'P2002' }
        const nueva = { ...structuredClone(data), idAsistencia: marcas.length + 1, salida: null }; marcas.push(nueva); estado.escrituras++; return structuredClone(nueva)
      },
      updateMany: async ({ where, data }: { where: { idAsistencia: number; idUsuario: number }; data: { salida: Date } }) => {
        const marca = marcas.find(m => m.idAsistencia === where.idAsistencia && m.idUsuario === where.idUsuario && m.salida === null)
        if (!marca || estado.cerrarCount === 0) return { count: 0 }
        marca.salida = data.salida; estado.escrituras++; return { count: 1 }
      },
    },
    $transaction: async <T>(accion: (db: PrismaClient) => Promise<T>) => {
      const anterior = cola; let liberar!: () => void; cola = new Promise<void>(r => { liberar = r }); await anterior
      try { if (estado.conflicto) throw { code: 'P2034' }; return await accion(doble as unknown as PrismaClient) } finally { liberar() }
    },
  }
  const db = doble as unknown as PrismaClient
  const controlador = (id: number | null) => crearControladorAsistencia(db, async () => id === null ? null : { user: { idUsuario: id } }, () => new Date(momento))
  return { db, personas, marcas, estado, controlador, mover: (iso: string) => { momento = new Date(iso) }, horario: (id: number, dias: HorarioDia[]) => { horarios = horarios.filter(h => h.idUsuario !== id).concat(dias.map(h => ({ idUsuario: id, diaSemana: h.diaSemana, entradaMinutos: Number(h.entrada.slice(0, 2)) * 60 + Number(h.entrada.slice(3)), salidaMinutos: Number(h.salida.slice(0, 2)) * 60 + Number(h.salida.slice(3)), toleranciaMinutos: h.toleranciaMinutos }))) } }
}
function request(cuerpo?: unknown, metodo = cuerpo === undefined ? 'GET' : 'POST', query = '') {
  return new Request('http://localhost:3000/api/asistencia' + query, { method: metodo, headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) })
}

test('sin sesión, inactivo y contraseña pendiente no consultan ni marcan asistencia', async () => {
  const e = escenario()
  assert.equal((await e.controlador(null).consultar(request())).status, 401)
  assert.equal((await e.controlador(5).marcar(request({ accion: 'iniciar' }))).status, 403)
  e.personas[1].debeCambiarContrasena = true
  assert.equal((await e.controlador(2).consultar(request())).status, 403)
  assert.equal(e.estado.escrituras, 0)
})
test('empleado ve solo lo propio; supervisor solo su sucursal y admin cualquier usuario', async () => {
  const e = escenario()
  assert.equal((await e.controlador(2).consultar(request())).status, 200)
  assert.equal((await e.controlador(2).consultar(request(), '4')).status, 404)
  assert.equal((await e.controlador(3).consultar(request(), '4')).status, 404)
  assert.equal((await e.controlador(3).consultar(request(), '2')).status, 200)
  assert.equal((await e.controlador(1).consultar(request(), '4')).status, 200)
  assert.equal((await e.controlador(1).consultar(request(), '5')).status, 200)
})
test('listado del supervisor filtrado por sucursal sin contraseñas ni emails; empleado no lista personal', async () => {
  const e = escenario()
  const respuesta = await e.controlador(3).listarPersonal(request())
  assert.equal(respuesta.status, 200)
  const datos = await respuesta.json()
  assert.deepEqual(datos.usuarios.map((u: { idUsuario: number }) => u.idUsuario), [2, 3, 5])
  assert.equal(JSON.stringify(datos).includes('password'), false); assert.equal(JSON.stringify(datos).includes('email'), false)
  assert.equal((await e.controlador(2).listarPersonal(request())).status, 403)
  e.personas[2].idSucursal = null
  assert.equal((await e.controlador(3).listarPersonal(request())).status, 403)
})
test('marcas toman hora e identidad del servidor; se rechazan fecha o usuario enviados por el cliente', async () => {
  const e = escenario(), c = e.controlador(2)
  assert.equal((await c.marcar(request({ accion: 'iniciar', idUsuario: 4, entrada: '2000-01-01' }))).status, 400)
  const respuesta = await c.marcar(request({ accion: 'iniciar' }))
  assert.equal(respuesta.status, 201)
  assert.equal(e.marcas[0].idUsuario, 2); assert.equal(e.marcas[0].entrada.toISOString(), '2026-10-23T12:00:00.000Z')
  assert.equal(e.marcas[0].sucursalNombre, 'Avellaneda')
  e.mover('2026-10-23T20:00:00Z')
  assert.equal((await c.marcar(request({ accion: 'finalizar' }))).status, 200)
  assert.equal((await c.marcar(request({ accion: 'finalizar' }))).status, 409)
  assert.equal(e.marcas.length, 1); assert.equal(e.marcas[0].salida?.toISOString(), '2026-10-23T20:00:00.000Z')
})
test('doble clic y dos pestañas no crean dos turnos ni reabren la misma jornada', async () => {
  const e = escenario(), c = e.controlador(2)
  const respuestas = await Promise.all([c.marcar(request({ accion: 'iniciar' })), c.marcar(request({ accion: 'iniciar' }))])
  assert.deepEqual(respuestas.map(r => r.status).sort(), [201, 409]); assert.equal(e.marcas.length, 1)
  await c.marcar(request({ accion: 'finalizar' }))
  assert.equal((await c.marcar(request({ accion: 'iniciar' }))).status, 409)
})
test('se impide iniciar sin horario, después de su final o sin sucursal activa asignada', async () => {
  const e = escenario(), c = e.controlador(2)
  e.horario(2, [])
  assert.equal((await c.marcar(request({ accion: 'iniciar' }))).status, 409)
  e.horario(2, [viernes]); e.mover('2026-10-23T21:00:00Z')
  assert.equal((await c.marcar(request({ accion: 'iniciar' }))).status, 409)
  e.mover('2026-10-23T12:00:00Z'); e.personas[1].sucursal!.activa = false
  assert.equal((await c.marcar(request({ accion: 'iniciar' }))).status, 403)
  assert.equal(e.estado.escrituras, 0)
})
test('solo admin guarda horarios; versión vieja, datos extra y origen ajeno se rechazan', async () => {
  const e = escenario()
  const horario = { horario: [viernes], versionHorario: JSON.stringify([viernes]) }
  assert.equal((await e.controlador(2).guardarHorario(request(horario, 'PUT'), '2')).status, 403)
  assert.equal((await e.controlador(3).guardarHorario(request(horario, 'PUT'), '2')).status, 403)
  assert.equal((await e.controlador(1).guardarHorario(request({ ...horario, versionHorario: '[]' }, 'PUT'), '2')).status, 409)
  assert.equal((await e.controlador(1).guardarHorario(request({ ...horario, borrarHistorial: true }, 'PUT'), '2')).status, 400)
  const ajena = new Request('http://localhost:3000/api/asistencia', { method: 'POST', headers: { origin: 'https://otro.test', 'content-type': 'application/json' }, body: '{"accion":"iniciar"}' })
  assert.equal((await e.controlador(2).marcar(ajena)).status, 403)
  assert.equal(e.estado.escrituras, 0)
})
test('editar horario o sucursal no modifica el turno abierto ni sus resultados históricos', async () => {
  const e = escenario(), empleado = e.controlador(2)
  await empleado.marcar(request({ accion: 'iniciar' }))
  const snapshot = structuredClone(e.marcas[0])
  const respuesta = await e.controlador(1).guardarHorario(request({ horario: [{ ...viernes, entrada: '10:00', salida: '18:00', toleranciaMinutos: 5 }], versionHorario: JSON.stringify([viernes]) }, 'PUT'), '2')
  assert.equal(respuesta.status, 200)
  e.personas[1].idSucursal = 2; e.personas[1].sucursal = { nombre: 'Quilmes', activa: true }
  assert.deepEqual(e.marcas[0], snapshot)
  e.mover('2026-10-23T20:00:00Z'); await empleado.marcar(request({ accion: 'finalizar' }))
  const historial = await (await empleado.consultar(request())).json()
  assert.equal(historial.registros[0].cumplimiento, 'completo'); assert.equal(historial.registros[0].sucursal, 'Avellaneda')
})
test('supervisor no recibe registros históricos de otra sucursal tras un traslado', async () => {
  const e = escenario(); await e.controlador(2).marcar(request({ accion: 'iniciar' })); await e.controlador(2).marcar(request({ accion: 'finalizar' }))
  e.marcas[0].idSucursal = 2; e.marcas[0].sucursalNombre = 'Quilmes'
  const datos = await (await e.controlador(3).consultar(request(), '2')).json()
  assert.equal(datos.registros.length, 0); assert.equal(datos.registroDelDia, null)
  assert.equal((await (await e.controlador(1).consultar(request(), '2')).json()).registros.length, 1)
})
test('turno nocturno se cierra luego de medianoche sin crear otra fecha de jornada', async () => {
  const e = escenario(), c = e.controlador(2)
  e.horario(2, [{ ...viernes, entrada: '19:00', salida: '02:00' }]); e.mover('2026-10-23T22:00:00Z')
  assert.equal((await c.marcar(request({ accion: 'iniciar' }))).status, 201)
  e.mover('2026-10-24T05:00:00Z')
  const salida = await c.marcar(request({ accion: 'finalizar' })); assert.equal(salida.status, 200)
  const { registro } = await salida.json(); assert.equal(registro.fechaJornada, '2026-10-23'); assert.equal(registro.cumplimiento, 'completo'); assert.equal(registro.minutosTrabajados, 420)
})
test('historial acota fechas y devuelve 400 ante filtros inválidos en vez de error interno', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' }))
  assert.equal((await c.consultar(request(undefined, 'GET', '?hasta=mal'))).status, 400)
  const datos = await (await c.consultar(request(undefined, 'GET', '?desde=2026-10-01&hasta=2026-10-22'))).json()
  assert.equal(datos.registros.length, 0); assert.equal(datos.abierto.idAsistencia, 1)
  assert.equal(e.marcas[0].fechaJornada.toISOString(), fechaParaBase('2026-10-23').toISOString())
})
test('conflictos de transacción y cierre concurrente no se informan como marcas exitosas', async () => {
  const e = escenario(), c = e.controlador(2)
  e.estado.conflicto = true; assert.equal((await c.marcar(request({ accion: 'iniciar' }))).status, 409)
  e.estado.conflicto = false; await c.marcar(request({ accion: 'iniciar' }))
  e.estado.cerrarCount = 0; assert.equal((await c.marcar(request({ accion: 'finalizar' }))).status, 409)
  assert.equal(e.marcas[0].salida, null)
})

test('proxy permite asistencia de personal al supervisor, manteniendo administración de usuarios solo para admin', async () => {
  const codigo = ts.transpileModule(readFileSync('src/proxy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  async function acceder(ruta: string, rol: string | null) {
    const exports: Record<string, (request: unknown) => Promise<string>> = {}
    runInNewContext(codigo, { exports, URL, process: { env: {} }, require: (nombre: string) => {
      if (nombre === 'next-auth/jwt') return { getToken: async () => rol ? { rol } : null }
      if (nombre === 'next/server') return { NextResponse: { next: () => 'permitido', redirect: (url: URL) => url.pathname } }
      throw new Error('Dependencia inesperada: ' + nombre)
    } })
    return exports.proxy({ url: 'http://localhost:3000' + ruta, nextUrl: { pathname: ruta } })
  }
  for (const ruta of ['/usuarios/asistencia', '/usuarios/asistencia/2']) {
    assert.equal(await acceder(ruta, 'admin'), 'permitido')
    assert.equal(await acceder(ruta, 'supervisor'), 'permitido')
    assert.equal(await acceder(ruta, 'empleado'), '/dashboard')
    assert.equal(await acceder(ruta, null), '/acceso/login')
  }
  for (const ruta of ['/usuarios', '/usuarios/archivados', '/usuarios/asistencia-falsa']) assert.equal(await acceder(ruta, 'supervisor'), '/dashboard')
  assert.equal(await acceder('/perfil/asistencia', 'empleado'), 'permitido')
})
