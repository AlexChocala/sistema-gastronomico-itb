import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import type { PrismaClient } from '@prisma/client'
import { crearControladorAsistencia } from '../src/lib/asistencia/controlador'
import { filasAsistencia } from '../src/lib/asistencia/exportar'
import { turnoHabilitaPedidos } from '../src/lib/asistencia/permiso-pedidos'
import {
  ErrorAsistencia, fechaArgentina, fechaParaBase, instanteArgentina, minutosHora, rangoAsistencia, resultadoTurno, sumarDias, turnoProgramado, validarHorario,
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
  assert.deepEqual(rangoAsistencia(new URLSearchParams(), ahora), { desde: null, hasta: '2026-10-23', pagina: 1, todo: true, puntualidad: null, jornada: null })
  for (const texto of ['hasta=mal', 'desde=2026-02-30', 'desde=2027-01-01', 'idUsuario=1', 'desde=2026-10-01&desde=2026-10-02']) assert.throws(() => rangoAsistencia(new URLSearchParams(texto), ahora), error400)
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
  const estado = { escrituras: 0, conflicto: false, cerrarCount: 1, paginas: [] as { take: number; skip: number }[], alLeerMarca: null as (() => void) | null }
  function coincide(m: Marca, w: { idAsistencia?: number; idUsuario?: number; idSucursal?: number | null; salida?: Date | null; fechaJornada?: Date | { gte?: Date; lte?: Date } }) {
    return (w.idAsistencia === undefined || m.idAsistencia === w.idAsistencia) && (w.idUsuario === undefined || m.idUsuario === w.idUsuario) && (w.idSucursal === undefined || m.idSucursal === w.idSucursal)
      && (!('salida' in w) || (w.salida === null ? m.salida === null : m.salida !== null && +m.salida === +w.salida!)) && (!w.fechaJornada || (w.fechaJornada instanceof Date ? +m.fechaJornada === +w.fechaJornada : (!w.fechaJornada.gte || m.fechaJornada >= w.fechaJornada.gte) && (!w.fechaJornada.lte || m.fechaJornada <= w.fechaJornada.lte)))
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
      count: async ({ where }: { where: Parameters<typeof coincide>[1] }) => marcas.filter(m => coincide(m, where)).length,
      findMany: async ({ where, take, skip }: { where: Parameters<typeof coincide>[1]; take: number; skip: number }) => {
        estado.paginas.push({ take, skip })
        return structuredClone(marcas.filter(m => coincide(m, where)).sort((a, b) => +b.fechaJornada - +a.fechaJornada || b.idAsistencia - a.idAsistencia).slice(skip, skip + take))
      },
      findFirst: async ({ where }: { where: Parameters<typeof coincide>[1] }) => { const encontrada = structuredClone(marcas.find(m => coincide(m, where)) ?? null); if (where.idAsistencia !== undefined) estado.alLeerMarca?.(); return encontrada },
      findUnique: async ({ where }: { where: { idUsuario_fechaJornada: { idUsuario: number; fechaJornada: Date } } }) => structuredClone(marcas.find(m => coincide(m, where.idUsuario_fechaJornada)) ?? null),
      create: async ({ data }: { data: Omit<Marca, 'idAsistencia' | 'salida'> }) => {
        if (marcas.some(m => m.idUsuario === data.idUsuario && (m.salida === null || +m.fechaJornada === +data.fechaJornada))) throw { code: 'P2002' }
        const nueva = { ...structuredClone(data), idAsistencia: marcas.length + 1, salida: null }; marcas.push(nueva); estado.escrituras++; return structuredClone(nueva)
      },
      updateMany: async ({ where, data }: { where: { idAsistencia: number; idUsuario: number; salida: Date | null }; data: { salida: Date | null } }) => {
        const marca = marcas.find(m => m.idAsistencia === where.idAsistencia && coincide(m, where))
        if (!marca || estado.cerrarCount === 0) return { count: 0 }
        marca.salida = data.salida; estado.escrituras++; return { count: 1 }
      },
    },
    $transaction: async <T>(accion: (db: PrismaClient) => Promise<T>) => {
      const anterior = cola; let liberar!: () => void; cola = new Promise<void>(r => { liberar = r }); await anterior
      try { if (estado.conflicto) throw { code: 'P2034' }; return await accion(db) } finally { liberar() }
    },
  }
  // Emula solo SELECTs del historial; otras operaciones SQL se rechazan.
  const consultarSql = async (consulta: { sql: string; values: unknown[] }) => {
    const sql = consulta.sql
    assert.ok(sql.startsWith('SELECT ')); assert.ok(sql.includes('FROM "AsistenciaUsuario"'))
    const parametro = (columna: string, operador: string) => {
      const indice = sql.indexOf(`"${columna}" ${operador} ?`)
      return indice < 0 ? undefined : consulta.values[(sql.slice(0, indice).match(/\?/g) ?? []).length]
    }
    const idUsuario = parametro('idUsuario', '=') as number
    const idSucursal = parametro('idSucursal', '=') as number | undefined
    const desde = parametro('fechaJornada', '>=') as Date | undefined
    const hasta = parametro('fechaJornada', '<=') as Date
    assert.ok(Number.isInteger(idUsuario)); assert.ok(hasta instanceof Date)
    const filas = marcas.filter(m => {
      if (m.idUsuario !== idUsuario || (idSucursal !== undefined && m.idSucursal !== idSucursal) || (sql.includes('"idSucursal" IS NULL') && m.idSucursal !== null) || (desde && m.fechaJornada < desde) || m.fechaJornada > hasta) return false
      const resultado = resultadoTurno({ ...m, fechaJornada: m.fechaJornada.toISOString().slice(0, 10) })
      if (sql.includes('"entrada" <= "entradaPrevista"') && resultado.puntualidad !== 'puntual') return false
      if (sql.includes('"entrada" > "entradaPrevista"') && resultado.puntualidad !== 'tarde') return false
      if (sql.includes('"salida" IS NULL') && m.salida !== null) return false
      if (sql.includes('"salida" < "salidaPrevista"') && !resultado.salidaAnticipada) return false
      if (sql.includes('"salida" - "entrada" >=') && resultado.cumplimiento !== 'completo') return false
      if (sql.includes('"salida" - "entrada" <') && (resultado.cumplimiento !== 'incompleto' || resultado.salidaAnticipada)) return false
      return true
    }).sort((a, b) => +b.fechaJornada - +a.fechaJornada || b.idAsistencia - a.idAsistencia)
    if (sql.startsWith('SELECT COUNT')) return [{ total: filas.length }]
    const [take, skip] = consulta.values.slice(-2) as number[]
    assert.ok(Number.isInteger(take) && take >= 0); assert.ok(Number.isInteger(skip) && skip >= 0)
    return structuredClone(filas.slice(skip, skip + take))
  }
  const db = { ...doble, $queryRaw: consultarSql } as unknown as PrismaClient
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


function cargarHistorial(e: ReturnType<typeof escenario>, cantidad: number) {
  for (let i = 0; i < cantidad; i++) {
    const fecha = sumarDias('2026-10-23', -i)
    e.marcas.push({
      idAsistencia: i + 1, idUsuario: 2, idSucursal: 1, sucursalNombre: 'Avellaneda',
      fechaJornada: fechaParaBase(fecha), entradaPrevista: instanteArgentina(fecha, '09:00'),
      salidaPrevista: instanteArgentina(fecha, '17:00'), toleranciaMinutos: 10,
      entrada: instanteArgentina(fecha, '09:00'), salida: instanteArgentina(fecha, '17:00'),
    })
  }
}

test('historial admite rangos de varios años y valida fechas, páginas y modo completo', () => {
  const ahora = new Date('2026-10-23T12:00:00Z')
  assert.deepEqual(rangoAsistencia(new URLSearchParams('desde=2020-01-01&hasta=2026-10-23&pagina=2'), ahora), {
    desde: '2020-01-01', hasta: '2026-10-23', pagina: 2, todo: false, puntualidad: null, jornada: null,
  })
  assert.deepEqual(rangoAsistencia(new URLSearchParams('todo=1'), ahora), { desde: null, hasta: '2026-10-23', pagina: 1, todo: true, puntualidad: null, jornada: null })
  for (const query of ['pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=01', 'pagina=abc', 'pagina=9007199254740992', 'pagina=1&pagina=2', 'todo=0', 'todo=si', 'todo=1&todo=1', 'todo=1&desde=2024-01-01', 'todo=1&hasta=2026-10-23', 'desde=0000-01-01', 'desde=2026-10-24&hasta=2026-10-23']) {
    assert.throws(() => rangoAsistencia(new URLSearchParams(query), ahora), error400, query)
  }
})

test('todo el historial se consulta por páginas sin truncar jornadas anteriores a un año', async () => {
  const e = escenario(), c = e.controlador(2)
  cargarHistorial(e, 405)
  const consultar = async (query: string) => {
    const respuesta = await c.consultar(request(undefined, 'GET', query))
    assert.equal(respuesta.status, 200)
    return respuesta.json()
  }
  const primera = await consultar('?todo=1')
  assert.equal(primera.totalRegistros, 405); assert.equal(primera.totalPaginas, 14)
  assert.equal(primera.porPagina, 30); assert.equal(primera.pagina, 1); assert.equal(primera.desde, null)
  assert.equal(primera.registros.length, 30)
  assert.deepEqual(primera.registros.map((r: { idAsistencia: number }) => r.idAsistencia), Array.from({ length: 30 }, (_, i) => i + 1))
  const segunda = await consultar('?todo=1&pagina=2')
  assert.deepEqual(segunda.registros.map((r: { idAsistencia: number }) => r.idAsistencia), Array.from({ length: 30 }, (_, i) => i + 31))
  const ultima = await consultar('?todo=1&pagina=999')
  assert.equal(ultima.pagina, 14)
  assert.deepEqual(ultima.registros.map((r: { idAsistencia: number }) => r.idAsistencia), Array.from({ length: 15 }, (_, i) => i + 391))
  assert.deepEqual(e.estado.paginas, [{ take: 30, skip: 0 }, { take: 30, skip: 30 }, { take: 30, skip: 390 }])
  const amplio = await consultar('?desde=2020-01-01&hasta=2026-10-23&pagina=14')
  assert.equal(amplio.totalRegistros, 405); assert.equal(amplio.registros.length, 15)
  const reciente = await consultar('')
  assert.equal(reciente.totalRegistros, 405); assert.equal(reciente.totalPaginas, 14); assert.equal(reciente.registros.length, 30)
  assert.equal(reciente.registroDelDia.idAsistencia, 1)
  assert.equal(e.estado.escrituras, 0)
})

test('el total y todas las páginas respetan el usuario y la sucursal autorizados', async () => {
  const e = escenario()
  cargarHistorial(e, 85)
  e.marcas.forEach((m, i) => { if (i % 2) { m.idSucursal = 2; m.sucursalNombre = 'Quilmes' } })
  e.marcas.push({ ...e.marcas[0], idAsistencia: 999, idUsuario: 4, idSucursal: 2, sucursalNombre: 'Quilmes' })
  const primera = await (await e.controlador(3).consultar(request(undefined, 'GET', '?todo=1'), '2')).json()
  const segunda = await (await e.controlador(3).consultar(request(undefined, 'GET', '?todo=1&pagina=2'), '2')).json()
  assert.equal(primera.totalRegistros, 43); assert.equal(primera.totalPaginas, 2)
  assert.equal(primera.registros.length, 30); assert.equal(segunda.registros.length, 13)
  assert.ok([...primera.registros, ...segunda.registros].every(r => r.sucursal === 'Avellaneda' && r.idAsistencia !== 999))
  const propio = await (await e.controlador(2).consultar(request(undefined, 'GET', '?todo=1'))).json()
  assert.equal(propio.totalRegistros, 85)
  assert.equal((await e.controlador(2).consultar(request(undefined, 'GET', '?todo=1&pagina=2'), '4')).status, 404)
  assert.equal((await e.controlador(3).consultar(request(undefined, 'GET', '?todo=1'), '4')).status, 404)
})

test('filtros sin resultados conservan el turno y la paginación vacía es válida', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' }))
  const datos = await (await c.consultar(request(undefined, 'GET', '?desde=2020-01-01&hasta=2021-01-01&pagina=8'))).json()
  assert.equal(datos.totalRegistros, 0); assert.equal(datos.totalPaginas, 1); assert.equal(datos.pagina, 1)
  assert.equal(datos.registros.length, 0); assert.equal(datos.abierto.idAsistencia, 1)
  for (const query of ['?pagina=0', '?pagina=1&pagina=2', '?todo=1&desde=2024-01-01']) {
    assert.equal((await c.consultar(request(undefined, 'GET', query))).status, 400)
  }
})


test('vista inicial incluye todo el historial en páginas de 30 sin límite de antigüedad', async () => {
  const e = escenario(), c = e.controlador(2)
  cargarHistorial(e, 40)
  e.marcas.forEach(m => {
    m.fechaJornada = fechaParaBase(sumarDias(m.fechaJornada.toISOString().slice(0, 10), -400))
    m.entradaPrevista = new Date(+m.entradaPrevista - 400 * 86400000)
    m.salidaPrevista = new Date(+m.salidaPrevista - 400 * 86400000)
    m.entrada = new Date(+m.entrada - 400 * 86400000)
    m.salida = new Date(+m.salida! - 400 * 86400000)
  })
  const inicial = await (await c.consultar(request())).json()
  assert.equal(inicial.totalRegistros, 40); assert.equal(inicial.registros.length, 30)
  assert.equal(inicial.totalPaginas, 2); assert.equal(inicial.todo, true); assert.equal(inicial.desde, null)
  assert.deepEqual(inicial.registros.map((r: { idAsistencia: number }) => r.idAsistencia), Array.from({ length: 30 }, (_, i) => i + 1))
  const todos = await (await c.consultar(request(undefined, 'GET', '?todo=1'))).json()
  assert.equal(todos.totalRegistros, 40); assert.equal(todos.totalPaginas, 2)
  const ultima = await (await c.consultar(request(undefined, 'GET', '?pagina=2'))).json()
  assert.equal(ultima.registros.length, 10)
  assert.deepEqual(ultima.registros.map((r: { idAsistencia: number }) => r.idAsistencia), Array.from({ length: 10 }, (_, i) => i + 31))
})

test('menos de 30 jornadas se muestran completas sin inventar registros', async () => {
  const e = escenario()
  cargarHistorial(e, 13)
  const inicial = await (await e.controlador(2).consultar(request())).json()
  assert.equal(inicial.totalRegistros, 13); assert.equal(inicial.registros.length, 13)
  assert.equal(inicial.porPagina, 30); assert.equal(inicial.totalPaginas, 1)
  assert.equal(e.estado.escrituras, 0)
})


test('valida estados de puntualidad y jornada sin aceptar parámetros repetidos o desconocidos', async () => {
  const ahora = new Date('2026-10-23T12:00:00Z')
  const filtro = rangoAsistencia(new URLSearchParams('puntualidad=tarde&jornada=completo'), ahora)
  assert.equal(filtro.puntualidad, 'tarde'); assert.equal(filtro.jornada, 'completo'); assert.equal(filtro.desde, null)
  const e = escenario()
  for (const query of ['puntualidad=otro', 'jornada=otro', 'puntualidad=todas', 'jornada=todas', 'puntualidad=', 'jornada=', 'puntualidad=puntual&puntualidad=tarde', 'jornada=en_curso&jornada=completo']) {
    assert.throws(() => rangoAsistencia(new URLSearchParams(query), ahora), error400)
    assert.equal((await e.controlador(2).consultar(request(undefined, 'GET', '?' + query))).status, 400)
  }
})

test('filtros por estado se combinan con fechas y paginan todos los resultados, sin alterar el turno', async () => {
  const e = escenario(), c = e.controlador(2)
  cargarHistorial(e, 85)
  e.marcas.forEach((m, i) => {
    if (i === 84) { m.entrada = new Date(+m.entradaPrevista + 20 * 60000); m.salida = null }
    else if (i % 4 === 1) { m.entrada = new Date(+m.entradaPrevista + 20 * 60000); m.salida = new Date(+m.salidaPrevista + 20 * 60000) }
    else if (i % 4 === 2) m.salida = new Date(+m.salidaPrevista - 60000)
    else if (i % 4 === 3) m.entrada = new Date(+m.entradaPrevista + 5 * 60000)
  })
  const consultar = async (query: string) => {
    const respuesta = await c.consultar(request(undefined, 'GET', query))
    assert.equal(respuesta.status, 200)
    return respuesta.json()
  }
  const primera = await consultar('?puntualidad=puntual')
  const segunda = await consultar('?puntualidad=puntual&pagina=2')
  const tercera = await consultar('?puntualidad=puntual&pagina=3')
  assert.equal(primera.totalRegistros, 63); assert.equal(primera.totalPaginas, 3)
  assert.equal(primera.registros.length, 30); assert.equal(segunda.registros.length, 30); assert.equal(tercera.registros.length, 3)
  assert.ok([...primera.registros, ...segunda.registros, ...tercera.registros].every(r => r.puntualidad === 'puntual'))
  assert.equal(new Set([...primera.registros, ...segunda.registros, ...tercera.registros].map(r => r.idAsistencia)).size, 63)
  const completa = await consultar('?jornada=completo')
  assert.equal(completa.totalRegistros, 42); assert.equal(completa.totalPaginas, 2)
  const tardeCompleta = await consultar('?puntualidad=tarde&jornada=completo')
  assert.equal(tardeCompleta.totalRegistros, 21)
  assert.ok(tardeCompleta.registros.every((r: { puntualidad: string; cumplimiento: string }) => r.puntualidad === 'tarde' && r.cumplimiento === 'completo'))
  const anticipada = await consultar('?jornada=salida_anticipada')
  assert.equal(anticipada.totalRegistros, 21); assert.ok(anticipada.registros.every((r: { salidaAnticipada: boolean }) => r.salidaAnticipada))
  const incompleta = await consultar('?jornada=incompleto&puntualidad=puntual')
  assert.equal(incompleta.totalRegistros, 21); assert.ok(incompleta.registros.every((r: { salidaAnticipada: boolean; cumplimiento: string }) => !r.salidaAnticipada && r.cumplimiento === 'incompleto'))
  const abierto = await consultar('?jornada=en_curso')
  assert.equal(abierto.totalRegistros, 1); assert.equal(abierto.registros[0].salida, null)
  const porFecha = await consultar('?puntualidad=tarde&jornada=completo&desde=2026-10-20&hasta=2026-10-23')
  assert.equal(porFecha.totalRegistros, 1); assert.equal(porFecha.registros[0].idAsistencia, 2)
  const vacio = await consultar('?puntualidad=puntual&jornada=en_curso&pagina=8')
  assert.equal(vacio.totalRegistros, 0); assert.equal(vacio.pagina, 1); assert.equal(vacio.totalPaginas, 1)
  assert.equal(vacio.abierto.idAsistencia, 85, 'Los filtros del historial no ocultan el control del turno abierto')
  assert.equal(e.estado.escrituras, 0)
})

test('los filtros de estado y sus totales conservan el aislamiento por usuario y sucursal', async () => {
  const e = escenario()
  cargarHistorial(e, 85)
  e.marcas.forEach((m, i) => { if (i % 2) { m.idSucursal = 2; m.sucursalNombre = 'Quilmes' } })
  e.marcas.push({ ...e.marcas[0], idAsistencia: 999, idUsuario: 4, idSucursal: 2, sucursalNombre: 'Quilmes' })
  const primera = await (await e.controlador(3).consultar(request(undefined, 'GET', '?puntualidad=puntual&jornada=completo'), '2')).json()
  const segunda = await (await e.controlador(3).consultar(request(undefined, 'GET', '?puntualidad=puntual&jornada=completo&pagina=2'), '2')).json()
  assert.equal(primera.totalRegistros, 43); assert.equal(primera.totalPaginas, 2)
  assert.equal(segunda.registros.length, 13)
  assert.ok([...primera.registros, ...segunda.registros].every(r => r.sucursal === 'Avellaneda' && r.idAsistencia !== 999))
  assert.equal((await e.controlador(2).consultar(request(undefined, 'GET', '?jornada=completo'), '4')).status, 404)
  assert.equal((await e.controlador(3).consultar(request(undefined, 'GET', '?jornada=completo'), '4')).status, 404)
})

function solicitudReanudar(marca: Marca) {
  return { accion: 'reanudar', idAsistencia: marca.idAsistencia, salidaRegistrada: marca.salida!.toISOString() }
}
for (const idUsuario of [2, 3]) {
  test(`usuario ${idUsuario} reanuda el cierre accidental conservando entrada, horario, sucursal y una sola asistencia`, async () => {
    const e = escenario(), c = e.controlador(idUsuario)
    await c.marcar(request({ accion: 'iniciar' }))
    const original = structuredClone(e.marcas[0])
    e.mover('2026-10-23T13:00:00Z'); await c.marcar(request({ accion: 'finalizar', idAsistencia: original.idAsistencia }))
    const cerrado = structuredClone(e.marcas[0])
    assert.equal((await (await c.consultar(request())).json()).puedeReanudarTurno, true)
    assert.equal(turnoHabilitaPedidos(e.marcas[0], 1, new Date('2026-10-23T13:00:00Z')), false)
    const respuesta = await c.marcar(request(solicitudReanudar(cerrado)))
    assert.equal(respuesta.status, 200); assert.equal((await respuesta.json()).registro.salida, null)
    assert.deepEqual(e.marcas, [original], 'Solo se revierte la salida; se conservan todos los datos originales')
    assert.equal((await (await c.consultar(request())).json()).puedeReanudarTurno, false)
    assert.equal(turnoHabilitaPedidos(e.marcas[0], 1, new Date('2026-10-23T13:00:00Z')), true)
  })
}
test('reanudar respeta los límites exactos del horario original y la hora del servidor', async () => {
  for (const momento of ['2026-10-23T11:59:59Z', '2026-10-23T20:00:00Z', '2026-10-24T12:00:00Z']) {
    const e = escenario(), c = e.controlador(2)
    await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
    const cerrado = structuredClone(e.marcas[0]); e.mover(momento)
    assert.equal((await c.marcar(request(solicitudReanudar(cerrado)))).status, 409)
    assert.deepEqual(e.marcas[0], cerrado)
    assert.equal((await (await c.consultar(request())).json()).puedeReanudarTurno, false)
  }
})
test('un cierre previo al horario solo puede reanudarse cuando llegue la entrada prevista', async () => {
  const e = escenario(), c = e.controlador(2); e.mover('2026-10-23T11:00:00Z')
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const cerrado = structuredClone(e.marcas[0]); assert.equal((await c.marcar(request(solicitudReanudar(cerrado)))).status, 409)
  e.mover('2026-10-23T12:00:00Z'); assert.equal((await c.marcar(request(solicitudReanudar(cerrado)))).status, 200)
})
test('la reanudación nocturna conserva la jornada anterior y vence a su salida prevista', async () => {
  const e = escenario(), c = e.controlador(2)
  e.horario(2, [{ ...viernes, entrada: '19:00', salida: '02:00' }]); e.mover('2026-10-23T22:00:00Z')
  await c.marcar(request({ accion: 'iniciar' })); e.mover('2026-10-24T04:00:00Z'); await c.marcar(request({ accion: 'finalizar' }))
  assert.equal((await (await c.consultar(request())).json()).puedeReanudarTurno, true)
  assert.equal((await c.marcar(request(solicitudReanudar(e.marcas[0])))).status, 200)
  assert.equal(e.marcas[0].fechaJornada.toISOString(), '2026-10-23T00:00:00.000Z')
  e.mover('2026-10-24T05:00:00Z'); await c.marcar(request({ accion: 'finalizar' }))
  assert.equal((await c.marcar(request(solicitudReanudar(e.marcas[0])))).status, 409)
})
test('una pantalla desactualizada no puede reabrir un cierre posterior ni cerrar otro turno', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const vieja = solicitudReanudar(e.marcas[0]); await c.marcar(request(vieja))
  assert.equal((await c.marcar(request({ accion: 'finalizar', idAsistencia: 99 }))).status, 409)
  assert.equal(e.marcas[0].salida, null)
  e.mover('2026-10-23T13:00:00Z'); await c.marcar(request({ accion: 'finalizar' }))
  const cerrado = structuredClone(e.marcas[0])
  assert.equal((await c.marcar(request(vieja))).status, 409); assert.deepEqual(e.marcas[0], cerrado)
})
test('dos pestañas no pueden reanudar dos veces ni abrir otra asistencia', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const datos = solicitudReanudar(e.marcas[0])
  const respuestas = await Promise.all([c.marcar(request(datos)), c.marcar(request(datos))])
  assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]); assert.equal(e.marcas.length, 1)
})
test('no se reanuda el turno de otra persona ni el de una sucursal anterior', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const datos = solicitudReanudar(e.marcas[0]), cerrado = structuredClone(e.marcas[0])
  for (const otro of [1, 3, 4]) {
    assert.equal((await e.controlador(otro).marcar(request(datos))).status, 409)
    assert.equal((await (await e.controlador(otro).consultar(request(), '2')).json()).puedeReanudarTurno ?? false, false)
  }
  e.personas[1].idSucursal = 2; assert.equal((await c.marcar(request(datos))).status, 409)
  e.personas[1].idSucursal = 1; e.personas[1].sucursal!.activa = false; assert.equal((await c.marcar(request(datos))).status, 409)
  assert.deepEqual(e.marcas[0], cerrado)
})
test('la API rechaza reanudaciones sin sesión, cuenta activa u origen válido', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const datos = solicitudReanudar(e.marcas[0]), cerrado = structuredClone(e.marcas[0])
  assert.equal((await e.controlador(null).marcar(request(datos))).status, 401)
  e.personas[1].activo = false; assert.equal((await c.marcar(request(datos))).status, 403)
  e.personas[1].activo = true; e.personas[1].debeCambiarContrasena = true; assert.equal((await c.marcar(request(datos))).status, 403)
  e.personas[1].debeCambiarContrasena = false
  const ajena = new Request('http://localhost:3000/api/asistencia', { method: 'POST', headers: { origin: 'https://otro.test', 'content-type': 'application/json' }, body: JSON.stringify(datos) })
  assert.equal((await c.marcar(ajena)).status, 403); assert.deepEqual(e.marcas[0], cerrado)
})
test('reanudar no acepta identificadores ni versiones ausentes, horas elegidas o acciones malformadas', async () => {
  const e = escenario(), c = e.controlador(2)
  for (const datos of [
    { accion: 'reanudar' }, { accion: 'reanudar', idAsistencia: 1 }, { accion: 'reanudar', idAsistencia: '1', salidaRegistrada: '2026-10-23T12:00:00Z' },
    { accion: 'reanudar', idAsistencia: 0, salidaRegistrada: '2026-10-23T12:00:00Z' }, { accion: 'reanudar', idAsistencia: 1, salidaRegistrada: 'inválida' },
    { accion: ['iniciar'] }, { accion: 'iniciar', idAsistencia: 1 }, { accion: 'finalizar', salidaRegistrada: '2026-10-23T12:00:00Z' },
    { accion: 'reanudar', idAsistencia: 1, salidaRegistrada: '2026-10-23T12:00:00Z', idUsuario: 4 },
  ]) assert.equal((await c.marcar(request(datos))).status, 400)
  assert.equal(e.estado.escrituras, 0)
})
test('cambiar el horario semanal no amplía el plazo para reanudar una asistencia anterior', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const datos = solicitudReanudar(e.marcas[0]); e.horario(2, [{ ...viernes, salida: '22:00' }]); e.mover('2026-10-23T20:00:00Z')
  assert.equal((await c.marcar(request(datos))).status, 409)
  assert.equal(e.marcas[0].salidaPrevista.toISOString(), '2026-10-23T20:00:00.000Z')
})
test('la hora se vuelve a comprobar tras consultar el turno y las actualizaciones concurrentes se rechazan', async () => {
  const e = escenario(), c = e.controlador(2)
  await c.marcar(request({ accion: 'iniciar' })); await c.marcar(request({ accion: 'finalizar' }))
  const datos = solicitudReanudar(e.marcas[0]), cerrado = structuredClone(e.marcas[0])
  e.estado.alLeerMarca = () => e.mover('2026-10-23T20:00:00Z')
  assert.equal((await c.marcar(request(datos))).status, 409)
  e.estado.alLeerMarca = null; e.mover('2026-10-23T13:00:00Z'); e.estado.cerrarCount = 0
  assert.equal((await c.marcar(request(datos))).status, 409); assert.deepEqual(e.marcas[0], cerrado)
})


test('se aceptan todas las horas y minutos válidos del reloj de 24 horas', () => {
  for (let hora = 0; hora < 24; hora++) for (let minuto = 0; minuto < 60; minuto++) {
    const texto = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
    assert.equal(minutosHora(texto), hora * 60 + minuto)
  }
  for (const invalida of ['24:00', '25:30', '12:60', '00:00 p. m.', '']) assert.throws(() => minutosHora(invalida), error400)
})
test('el administrador puede guardar cualquier horario válido, aunque no coincida con la hora actual', async () => {
  const e = escenario(), c = e.controlador(1)
  let anterior = [viernes]
  for (const [entrada, salida] of [['00:00', '12:00'], ['22:17', '00:43'], ['23:59', '00:00'], ['04:23', '18:47']]) {
    const nuevo = [{ ...viernes, entrada, salida }]
    const respuesta = await c.guardarHorario(request({ horario: nuevo, versionHorario: JSON.stringify(anterior) }, 'PUT'), '2')
    assert.equal(respuesta.status, 200)
    const ficha = await (await e.controlador(2).consultar(request())).json()
    assert.deepEqual(ficha.horario, nuevo)
    anterior = nuevo
  }
})


test('exportación incluye más de 30 jornadas, ignora la página y no escribe en la base', async () => {
  const e = escenario()
  cargarHistorial(e, 75)
  const respuesta = await e.controlador(2).exportar(request(undefined, 'GET', '?pagina=3'))
  assert.equal(respuesta.status, 200)
  assert.equal(respuesta.headers.get('cache-control'), 'no-store')
  const datos = await respuesta.json()
  assert.equal(datos.registros.length, 75)
  assert.equal(datos.registros[0].idAsistencia, 1)
  assert.equal(datos.registros.at(-1).idAsistencia, 75)
  assert.deepEqual(Object.keys(datos).sort(), ['desde', 'generado', 'hasta', 'registros', 'usuario'])
  assert.equal(e.estado.escrituras, 0)
})

test('exportación conserva filtros combinados, fechas y resultados vacíos', async () => {
  const e = escenario()
  cargarHistorial(e, 90)
  e.marcas.forEach((m, i) => { if (i % 2 === 0) { m.entrada = new Date(+m.entrada + 20 * 60000); m.salida = new Date(+m.salida! + 20 * 60000) } })
  const consultar = async (query: string) => {
    const respuesta = await e.controlador(2).exportar(request(undefined, 'GET', query))
    assert.equal(respuesta.status, 200)
    return respuesta.json()
  }
  const completo = await consultar('?puntualidad=tarde&jornada=completo')
  assert.equal(completo.registros.length, 45)
  assert.ok(completo.registros.every((r: { puntualidad: string; cumplimiento: string }) => r.puntualidad === 'tarde' && r.cumplimiento === 'completo'))
  const periodo = await consultar('?desde=2026-10-01&hasta=2026-10-23&puntualidad=tarde&jornada=completo')
  assert.equal(periodo.registros.length, 12)
  assert.ok(periodo.registros.every((r: { fechaJornada: string }) => r.fechaJornada >= '2026-10-01' && r.fechaJornada <= '2026-10-23'))
  assert.equal((await consultar('?jornada=en_curso')).registros.length, 0)
  assert.equal((await e.controlador(2).exportar(request(undefined, 'GET', '?jornada=inventado'))).status, 400)
  assert.equal(e.estado.escrituras, 0)
})

test('exportación aplica sesión, rol, cuenta activa y alcance histórico de sucursal', async () => {
  const e = escenario()
  cargarHistorial(e, 75)
  e.marcas.forEach((m, i) => { if (i % 2) { m.idSucursal = 2; m.sucursalNombre = 'Quilmes' } })
  e.marcas.push({ ...e.marcas[0], idUsuario: 4, idAsistencia: 999, idSucursal: 2 })
  const supervisor = await (await e.controlador(3).exportar(request(), '2')).json()
  assert.equal(supervisor.registros.length, 38)
  assert.ok(supervisor.registros.every((r: { sucursal: string }) => r.sucursal === 'Avellaneda'))
  assert.equal((await (await e.controlador(1).exportar(request(), '2')).json()).registros.length, 75)
  assert.equal((await e.controlador(2).exportar(request(), '4')).status, 404)
  assert.equal((await e.controlador(3).exportar(request(), '4')).status, 404)
  assert.equal((await e.controlador(null).exportar(request())).status, 401)
  assert.equal((await e.controlador(5).exportar(request())).status, 403)
  e.personas[1].debeCambiarContrasena = true
  assert.equal((await e.controlador(2).exportar(request())).status, 403)
  assert.equal(e.estado.escrituras, 0)
})

test('archivos conservan fechas de Argentina, cruce de medianoche, minutos numéricos y turno abierto', async () => {
  const e = escenario()
  cargarHistorial(e, 1)
  const m = e.marcas[0]
  m.entradaPrevista = instanteArgentina('2026-10-22', '23:00')
  m.salidaPrevista = instanteArgentina('2026-10-23', '02:00')
  m.entrada = m.entradaPrevista; m.salida = null
  const datos = await (await e.controlador(2).exportar(request())).json()
  const [fila] = filasAsistencia(datos.registros)
  assert.match(String(fila[2]), /22\/10\/2026.*23:00/)
  assert.match(String(fila[3]), /23\/10\/2026.*02:00/)
  assert.equal(fila[4], 10); assert.equal(fila[6], 'Sin registrar')
  assert.equal(fila[7], 180); assert.equal(fila[8], 'En curso')
  assert.equal(fila[9], 'Puntual'); assert.equal(fila[10], 'Turno abierto')
})


test('errores internos de la base no se exponen y una configuración incompleta tiene indicación específica', async t => {
  const e = escenario()
  const lectura = t.mock.method(e.db.asistenciaUsuario, 'count', async () => { throw { code: 'P2021', message: 'Ruta y tabla privada' } })
  const configuracion = await e.controlador(2).consultar(request())
  assert.equal(configuracion.status, 503)
  const datos = await configuracion.json()
  assert.equal(datos.codigo, 'ASISTENCIA_NO_CONFIGURADA')
  assert.match(datos.error, /configuración.*administrador/)
  assert.doesNotMatch(JSON.stringify(datos), /P2021|privada|migración/)
  lectura.mock.mockImplementation(async () => { throw new Error('postgresql://contraseña-privada') })
  const desconocido = await e.controlador(2).consultar(request())
  assert.equal(desconocido.status, 500)
  assert.doesNotMatch(JSON.stringify(await desconocido.json()), /postgresql|contraseña-privada/)
})
