import { Prisma, type PrismaClient } from '@prisma/client'
import { fechaParaBase, REGISTROS_POR_PAGINA_ASISTENCIA, type FiltroJornadaAsistencia, type FiltroPuntualidadAsistencia } from './reglas'

type Base = PrismaClient | Prisma.TransactionClient
type Marca = Prisma.AsistenciaUsuarioGetPayload<Record<string, never>>
type Filtros = {
  idUsuario: number; idSucursal?: number | null; desde: string | null; hasta: string; pagina: number
  puntualidad: FiltroPuntualidadAsistencia | null; jornada: FiltroJornadaAsistencia | null
}

// Las comparaciones usan los instantes exactos, igual que resultadoTurno.
// La tolerancia afecta la puntualidad, pero no reduce la duración de la jornada.
export function condicionesEstadoHistorial(puntualidad: FiltroPuntualidadAsistencia | null, jornada: FiltroJornadaAsistencia | null): Prisma.Sql[] {
  const condiciones: Prisma.Sql[] = []
  if (puntualidad === 'puntual') condiciones.push(Prisma.sql`"entrada" <= "entradaPrevista" + "toleranciaMinutos" * INTERVAL '1 minute'`)
  if (puntualidad === 'tarde') condiciones.push(Prisma.sql`"entrada" > "entradaPrevista" + "toleranciaMinutos" * INTERVAL '1 minute'`)
  if (jornada === 'en_curso') condiciones.push(Prisma.sql`"salida" IS NULL`)
  if (jornada === 'salida_anticipada') condiciones.push(Prisma.sql`"salida" IS NOT NULL AND "salida" < "salidaPrevista"`)
  if (jornada === 'completo') condiciones.push(Prisma.sql`"salida" IS NOT NULL AND "salida" >= "salidaPrevista" AND "salida" - "entrada" >= "salidaPrevista" - "entradaPrevista"`)
  if (jornada === 'incompleto') condiciones.push(Prisma.sql`"salida" IS NOT NULL AND "salida" >= "salidaPrevista" AND "salida" - "entrada" < "salidaPrevista" - "entradaPrevista"`)
  return condiciones
}

export async function consultarHistorialAsistencia(db: Base, filtros: Filtros, exportacion = false) {
  const { idUsuario, idSucursal, desde, hasta, puntualidad, jornada } = filtros
  const porPagina = REGISTROS_POR_PAGINA_ASISTENCIA
  const where: Prisma.AsistenciaUsuarioWhereInput = {
    idUsuario, ...(idSucursal !== undefined ? { idSucursal } : {}),
    fechaJornada: { ...(desde ? { gte: fechaParaBase(desde) } : {}), lte: fechaParaBase(hasta) },
  }
  const estados = condicionesEstadoHistorial(puntualidad, jornada)
  // Prisma no expresa la suma de tolerancia ni las diferencias entre columnas de fecha.
  // Solo esa consulta usa SQL parametrizado; el alcance del usuario se incluye siempre.
  const condiciones = [Prisma.sql`"idUsuario" = ${idUsuario}`, Prisma.sql`"fechaJornada" <= ${fechaParaBase(hasta)}`]
  if (idSucursal !== undefined) condiciones.push(idSucursal === null ? Prisma.sql`"idSucursal" IS NULL` : Prisma.sql`"idSucursal" = ${idSucursal}`)
  if (desde) condiciones.push(Prisma.sql`"fechaJornada" >= ${fechaParaBase(desde)}`)
  condiciones.push(...estados)
  const filtroSql = Prisma.join(condiciones, ' AND ')
  const totalRegistros = estados.length
    ? (await db.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total FROM "AsistenciaUsuario" WHERE ${filtroSql}`))[0].total
    : await db.asistenciaUsuario.count({ where })
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / porPagina))
  const pagina = exportacion ? 1 : Math.min(filtros.pagina, totalPaginas)
  // La exportación usa el mismo alcance y filtros, dentro de la misma instantánea.
  const cantidad = exportacion ? totalRegistros : porPagina
  const skip = (pagina - 1) * porPagina
  const registros = estados.length
    ? await db.$queryRaw<Marca[]>(Prisma.sql`SELECT * FROM "AsistenciaUsuario" WHERE ${filtroSql} ORDER BY "fechaJornada" DESC, "idAsistencia" DESC LIMIT ${cantidad} OFFSET ${skip}`)
    : await db.asistenciaUsuario.findMany({ where, orderBy: [{ fechaJornada: 'desc' }, { idAsistencia: 'desc' }], take: cantidad, skip })
  return { registros, pagina, porPagina, totalRegistros, totalPaginas }
}
