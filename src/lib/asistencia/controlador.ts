import type { Prisma, PrismaClient } from '@prisma/client'
import {
  ErrorAsistencia, fechaArgentina, fechaParaBase, horaDeMinutos, minutosHora, rangoAsistencia, resultadoTurno, turnoProgramado, validarHorario,
  type HorarioDia,
} from './reglas'
import type { DatosAsistencia, PersonaAsistencia, RegistroAsistencia } from './tipos'

type Sesion = { user: { idUsuario: number } } | null
type Base = PrismaClient | Prisma.TransactionClient
const camposPersona = {
  idUsuario: true, nombre: true, apellido: true, activo: true, debeCambiarContrasena: true, idSucursal: true,
  rol: { select: { nombre: true } }, sucursal: { select: { nombre: true, activa: true } },
} satisfies Prisma.UsuarioSelect
type Persona = Prisma.UsuarioGetPayload<{ select: typeof camposPersona }>
type Marca = Prisma.AsistenciaUsuarioGetPayload<Record<string, never>>

const personaPublica = (p: Persona): PersonaAsistencia => ({ idUsuario: p.idUsuario, nombre: p.nombre, apellido: p.apellido, activo: p.activo, rol: p.rol.nombre, sucursal: p.sucursal?.nombre ?? null })
const responder = (datos: unknown, estado = 200) => Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })

function responderError(error: unknown) {
  if (error instanceof ErrorAsistencia) return responder({ error: error.message }, error.estado)
  const codigo = error && typeof error === 'object' && 'code' in error ? error.code : null
  if (codigo === 'P2002' || codigo === 'P2034') return responder({ error: 'Los datos cambiaron o el turno ya se registró. Actualizá antes de intentar nuevamente.' }, 409)
  if (codigo === 'P2021' || codigo === 'P2022') return responder({ error: 'La asistencia todavía no está habilitada en esta base. Falta aplicar su migración.' }, 503)
  return responder({ error: 'No se pudo completar la operación de asistencia. Intentá nuevamente.' }, 500)
}

function idValido(valor: number) { return Number.isSafeInteger(valor) && valor > 0 }
function leerId(texto: string) {
  const numero = Number(texto)
  if (!/^[1-9]\d*$/.test(texto) || !idValido(numero)) throw new ErrorAsistencia(400, 'Indicá un usuario válido.')
  return numero
}
function comprobarPersonal(p: Persona | null): asserts p is Persona {
  if (!p?.activo || !['admin', 'supervisor', 'empleado'].includes(p.rol.nombre)) throw new ErrorAsistencia(403, 'El usuario no está habilitado para consultar asistencia.')
  if (p.debeCambiarContrasena) throw new ErrorAsistencia(403, 'Primero tenés que cambiar tu contraseña.')
}
function mismoOrigen(request: Request) {
  const origen = request.headers.get('origin')
  if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ErrorAsistencia(403, 'La solicitud debe realizarse desde esta aplicación.')
}
async function leerObjeto(request: Request, permitidos: string[]) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ErrorAsistencia(415, 'Enviá los datos como application/json.')
  let datos: unknown
  try { datos = await request.json() } catch { throw new ErrorAsistencia(400, 'El JSON no es válido.') }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).some(k => !permitidos.includes(k))) throw new ErrorAsistencia(400, 'La solicitud tiene campos inválidos.')
  return datos as Record<string, unknown>
}

export function puedeVerAsistencia(actor: Pick<Persona, 'idUsuario' | 'idSucursal' | 'rol'>, destino: Pick<Persona, 'idUsuario' | 'idSucursal'>) {
  return actor.idUsuario === destino.idUsuario || actor.rol.nombre === 'admin'
    || (actor.rol.nombre === 'supervisor' && actor.idSucursal !== null && actor.idSucursal === destino.idSucursal)
}
async function buscarDestino(db: Base, actor: Persona, idUsuario: number) {
  const destino = await db.usuario.findUnique({ where: { idUsuario }, select: camposPersona })
  if (!destino || !puedeVerAsistencia(actor, destino)) throw new ErrorAsistencia(404, 'No se encontró ese usuario dentro de tus permisos.')
  return destino
}
async function leerHorario(db: Base, idUsuario: number): Promise<HorarioDia[]> {
  const filas = await db.horarioUsuario.findMany({ where: { idUsuario }, orderBy: { diaSemana: 'asc' } })
  return filas.map(h => ({ diaSemana: h.diaSemana, entrada: horaDeMinutos(h.entradaMinutos), salida: horaDeMinutos(h.salidaMinutos), toleranciaMinutos: h.toleranciaMinutos }))
}
function marcaPublica(m: Marca): RegistroAsistencia {
  return {
    idAsistencia: m.idAsistencia, fechaJornada: m.fechaJornada.toISOString().slice(0, 10),
    sucursal: m.sucursalNombre, entradaPrevista: m.entradaPrevista.toISOString(), salidaPrevista: m.salidaPrevista.toISOString(),
    toleranciaMinutos: m.toleranciaMinutos, entrada: m.entrada.toISOString(), salida: m.salida?.toISOString() ?? null,
    ...resultadoTurno({ ...m, fechaJornada: m.fechaJornada.toISOString().slice(0, 10) }),
  }
}

async function consultar(db: Base, actor: Persona, idUsuario: number, request: Request, ahora: Date): Promise<DatosAsistencia> {
  const destino = await buscarDestino(db, actor, idUsuario)
  const { desde, hasta } = rangoAsistencia(new URL(request.url).searchParams, ahora)
  const horario = await leerHorario(db, idUsuario)
  const programado = turnoProgramado(horario, ahora)
  // Un supervisor no ve marcas históricas hechas en otra sucursal tras un traslado.
  const alcance = actor.rol.nombre === 'supervisor' && actor.idUsuario !== idUsuario ? { idSucursal: actor.idSucursal } : {}
  const registros = await db.asistenciaUsuario.findMany({
    where: { idUsuario, ...alcance, fechaJornada: { gte: fechaParaBase(desde), lte: fechaParaBase(hasta) } },
    orderBy: { fechaJornada: 'desc' }, take: 366,
  })
  const abierto = await db.asistenciaUsuario.findFirst({ where: { idUsuario, ...alcance, salida: null } })
  const registroDelDia = await db.asistenciaUsuario.findFirst({ where: { idUsuario, ...alcance, fechaJornada: fechaParaBase(programado?.fechaJornada ?? fechaArgentina(ahora)) } })
  return {
    usuario: personaPublica(destino), esPropia: actor.idUsuario === idUsuario, puedeEditarHorario: actor.rol.nombre === 'admin',
    horario, versionHorario: JSON.stringify(horario), ahora: ahora.toISOString(), desde, hasta,
    programado: programado ? { ...programado, entradaPrevista: programado.entradaPrevista.toISOString(), salidaPrevista: programado.salidaPrevista.toISOString() } : null,
    abierto: abierto ? marcaPublica(abierto) : null, registroDelDia: registroDelDia ? marcaPublica(registroDelDia) : null,
    registros: registros.map(marcaPublica),
  }
}

export function crearControladorAsistencia(db: PrismaClient, leerSesion: () => Promise<Sesion>, reloj: () => Date = () => new Date()) {
  async function proteger(request: Request, escritura: boolean, accion: (actor: Persona) => Promise<Response>) {
    try {
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) throw new ErrorAsistencia(401, 'Iniciá sesión para consultar tu asistencia.')
      const actor = await db.usuario.findUnique({ where: { idUsuario: sesion.user.idUsuario }, select: camposPersona })
      comprobarPersonal(actor)
      if (escritura) mismoOrigen(request)
      return await accion(actor)
    } catch (error) { return responderError(error) }
  }
  return {
    consultar: (request: Request, id?: string) => proteger(request, false, async actor => {
      const datos = await db.$transaction(tx => consultar(tx, actor, id ? leerId(id) : actor.idUsuario, request, reloj()), { isolationLevel: 'RepeatableRead' })
      return responder(datos)
    }),
    listarPersonal: (request: Request) => proteger(request, false, async actor => {
      if (!['admin', 'supervisor'].includes(actor.rol.nombre)) throw new ErrorAsistencia(403, 'No tenés permiso para ver la asistencia del personal.')
      if (new URL(request.url).search) throw new ErrorAsistencia(400, 'Este listado no admite parámetros.')
      if (actor.rol.nombre === 'supervisor' && actor.idSucursal === null) throw new ErrorAsistencia(403, 'Tu usuario no tiene sucursal asignada.')
      const personas = await db.usuario.findMany({
        where: actor.rol.nombre === 'admin' ? {} : { idSucursal: actor.idSucursal }, select: camposPersona,
        orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
      })
      return responder({ usuarios: personas.map(personaPublica), esAdmin: actor.rol.nombre === 'admin' })
    }),
    guardarHorario: (request: Request, id: string) => proteger(request, true, async actor => {
      if (actor.rol.nombre !== 'admin') throw new ErrorAsistencia(403, 'Solo el administrador puede asignar horarios.')
      const idUsuario = leerId(id)
      const datos = await leerObjeto(request, ['horario', 'versionHorario'])
      const horario = validarHorario(datos.horario)
      if (typeof datos.versionHorario !== 'string' || datos.versionHorario.length > 2000) throw new ErrorAsistencia(400, 'Actualizá la ficha antes de guardar el horario.')
      await db.$transaction(async tx => {
        const actual = await tx.usuario.findUnique({ where: { idUsuario: actor.idUsuario }, select: camposPersona })
        comprobarPersonal(actual)
        if (actual.rol.nombre !== 'admin') throw new ErrorAsistencia(403, 'Solo el administrador puede asignar horarios.')
        await buscarDestino(tx, actual, idUsuario)
        if (JSON.stringify(await leerHorario(tx, idUsuario)) !== datos.versionHorario) throw new ErrorAsistencia(409, 'El horario cambió mientras lo editabas. Cerrá el formulario y actualizá la ficha.')
        await tx.horarioUsuario.deleteMany({ where: { idUsuario } })
        if (horario.length) await tx.horarioUsuario.createMany({ data: horario.map(h => ({ idUsuario, diaSemana: h.diaSemana, entradaMinutos: minutosHora(h.entrada), salidaMinutos: minutosHora(h.salida), toleranciaMinutos: h.toleranciaMinutos })) })
      }, { isolationLevel: 'Serializable' })
      return responder({ mensaje: 'Horario guardado. Las asistencias anteriores conservan su horario original.' })
    }),
    marcar: (request: Request) => proteger(request, true, async actor => {
      const datos = await leerObjeto(request, ['accion'])
      if (datos.accion !== 'iniciar' && datos.accion !== 'finalizar') throw new ErrorAsistencia(400, 'Elegí iniciar o finalizar el turno.')
      const ahora = reloj()
      const registro = await db.$transaction(async tx => {
        const persona = await tx.usuario.findUnique({ where: { idUsuario: actor.idUsuario }, select: camposPersona })
        comprobarPersonal(persona)
        const abierto = await tx.asistenciaUsuario.findFirst({ where: { idUsuario: actor.idUsuario, salida: null } })
        if (datos.accion === 'finalizar') {
          if (!abierto) throw new ErrorAsistencia(409, 'No tenés un turno abierto para finalizar.')
          if (ahora < abierto.entrada) throw new ErrorAsistencia(409, 'La hora del servidor es anterior a la entrada registrada. Intentá nuevamente.')
          const cerrado = await tx.asistenciaUsuario.updateMany({ where: { idAsistencia: abierto.idAsistencia, idUsuario: actor.idUsuario, salida: null }, data: { salida: ahora } })
          if (cerrado.count !== 1) throw new ErrorAsistencia(409, 'El turno ya fue finalizado. Actualizá la pantalla.')
          return { ...abierto, salida: ahora }
        }
        if (abierto) throw new ErrorAsistencia(409, 'Ya tenés un turno abierto. Finalizalo antes de iniciar otro.')
        if (persona.rol.nombre !== 'admin' && (!persona.idSucursal || !persona.sucursal?.activa)) throw new ErrorAsistencia(403, 'Necesitás una sucursal activa asignada para iniciar el turno.')
        const plan = turnoProgramado(await leerHorario(tx, actor.idUsuario), ahora)
        if (!plan) throw new ErrorAsistencia(409, 'No tenés un horario asignado para esta jornada. Consultá al administrador.')
        if (ahora >= plan.salidaPrevista) throw new ErrorAsistencia(409, 'El horario de esta jornada ya finalizó. Consultá al administrador.')
        const existente = await tx.asistenciaUsuario.findUnique({ where: { idUsuario_fechaJornada: { idUsuario: actor.idUsuario, fechaJornada: fechaParaBase(plan.fechaJornada) } } })
        if (existente) throw new ErrorAsistencia(409, 'Ya registraste un turno para esta jornada.')
        return tx.asistenciaUsuario.create({ data: {
          idUsuario: actor.idUsuario, idSucursal: persona.idSucursal, sucursalNombre: persona.sucursal?.nombre ?? null,
          fechaJornada: fechaParaBase(plan.fechaJornada), entradaPrevista: plan.entradaPrevista, salidaPrevista: plan.salidaPrevista,
          toleranciaMinutos: plan.toleranciaMinutos, entrada: ahora,
        } })
      }, { isolationLevel: 'Serializable' })
      return responder({ mensaje: datos.accion === 'iniciar' ? 'Entrada registrada.' : 'Salida registrada.', registro: marcaPublica(registro) }, datos.accion === 'iniciar' ? 201 : 200)
    }),
  }
}
