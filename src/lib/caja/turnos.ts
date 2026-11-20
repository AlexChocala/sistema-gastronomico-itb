// Turnos de caja: abrir, cerrar con arqueo y consultar el estado. Solo servidor.
//
// Un turno va de la apertura al cierre de una caja (no es por día). El responsable es quien
// abrió; el cierre lo puede hacer otra persona, que también queda registrada. Cada cobro en
// efectivo entra al turno abierto: al cerrar, lo que el sistema espera es el monto inicial
// más ese efectivo, y se compara con lo que se contó.

import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorPedido } from '@/lib/pedidos/pedidos-validacion'

type Db = PrismaClient | Prisma.TransactionClient

export const MAX_MONTO_CAJA = 100_000_000

export type TurnoAbierto = {
  idTurno: number
  fechaApertura: string
  montoInicial: number
  abiertoPor: string
}
export type CajaConTurno = { idCaja: number; nombre: string; turno: TurnoAbierto | null }

export type ResumenCierre = { efectivoEsperado: number; efectivoContado: number; diferencia: number }

const redondear = (valor: number) => Math.round(valor * 100) / 100

export function montoValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= MAX_MONTO_CAJA
}

// Las cajas activas de la sucursal con su turno abierto (si lo hay).
export async function cajasDeSucursal(db: Db, idSucursal: number): Promise<CajaConTurno[]> {
  const cajas = await db.caja.findMany({
    where: { idSucursal, activa: true },
    orderBy: { idCaja: 'asc' },
    select: {
      idCaja: true, nombre: true,
      turnos: {
        where: { fechaCierre: null },
        take: 1,
        select: {
          idTurno: true, fechaApertura: true, montoInicial: true,
          usuarioApertura: { select: { nombre: true, apellido: true } },
        },
      },
    },
  })
  return cajas.map((caja) => {
    const turno = caja.turnos[0]
    return {
      idCaja: caja.idCaja,
      nombre: caja.nombre,
      turno: turno
        ? {
            idTurno: turno.idTurno,
            fechaApertura: turno.fechaApertura.toISOString(),
            montoInicial: turno.montoInicial,
            abiertoPor: `${turno.usuarioApertura.nombre} ${turno.usuarioApertura.apellido}`,
          }
        : null,
    }
  })
}

// Pedidos con efectivo por cobrar al entregar (los cancelados y los ya entregados no cuentan).
// Se avisa al cerrar la caja: esa plata va a entrar a un turno que se abra más tarde.
export async function pedidosPorCobrar(db: Db, idSucursal: number) {
  return db.pedido.count({ where: { idSucursal, estadoPago: 'pendiente', estadoPedido: { notIn: ['entregado', 'cancelado'] } } })
}

// Turno abierto de una caja de esta sucursal. Si la caja es de otra sucursal, responde como
// si no existiera.
export async function turnoAbiertoDe(db: Db, idSucursal: number, idCaja: number) {
  return db.turnoCaja.findFirst({
    where: { idCaja, fechaCierre: null, caja: { idSucursal, activa: true } },
    select: { idTurno: true, montoInicial: true },
  })
}

export async function exigirTurnoAbierto(db: Db, idSucursal: number, idCaja: number) {
  const turno = await turnoAbiertoDe(db, idSucursal, idCaja)
  if (!turno) throw new ErrorPedido(409, 'La caja está cerrada. Abrila para cobrar.')
  return turno
}

// Efectivo que entró al turno, sin contar los pedidos cancelados (esa plata se devolvió).
export async function efectivoCobradoEnTurno(db: Db, idTurno: number) {
  const { _sum } = await db.pago.aggregate({
    where: { idTurno, metodo: 'efectivo', pedido: { estadoPedido: { not: 'cancelado' } } },
    _sum: { monto: true },
  })
  return redondear(_sum.monto ?? 0)
}

export async function abrirTurno(
  db: PrismaClient,
  datos: { idSucursal: number; idCaja: number; montoInicial: unknown; idUsuario: number },
) {
  if (!montoValido(datos.montoInicial)) throw new ErrorPedido(400, 'Indicá con cuánto efectivo se abre la caja.')
  const caja = await db.caja.findFirst({ where: { idCaja: datos.idCaja, idSucursal: datos.idSucursal, activa: true }, select: { idCaja: true } })
  if (!caja) throw new ErrorPedido(404, 'No encontramos esa caja en esta sucursal.')
  try {
    await db.turnoCaja.create({
      data: { idCaja: caja.idCaja, montoInicial: redondear(datos.montoInicial), idUsuarioApertura: datos.idUsuario },
    })
  } catch (error) {
    // El índice único parcial impide dos turnos abiertos en la misma caja.
    const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
    if (codigo === 'P2002') throw new ErrorPedido(409, 'Esta caja ya está abierta.')
    throw error
  }
}

export async function cerrarTurno(
  db: PrismaClient,
  datos: { idSucursal: number; idCaja: number; efectivoContado: unknown; observacion?: unknown; idUsuario: number },
): Promise<ResumenCierre> {
  if (!montoValido(datos.efectivoContado)) throw new ErrorPedido(400, 'Indicá cuánto efectivo hay en la caja.')
  const observacion = typeof datos.observacion === 'string' && datos.observacion.trim() ? datos.observacion.trim().slice(0, 200) : null
  return db.$transaction(async (tx) => {
    const turno = await exigirTurnoAbierto(tx, datos.idSucursal, datos.idCaja)
    const efectivoEsperado = redondear(turno.montoInicial + (await efectivoCobradoEnTurno(tx, turno.idTurno)))
    const efectivoContado = redondear(datos.efectivoContado as number)
    // Condicional: si otra pantalla cerró en el medio, no cierra dos veces.
    const { count } = await tx.turnoCaja.updateMany({
      where: { idTurno: turno.idTurno, fechaCierre: null },
      data: { fechaCierre: new Date(), efectivoEsperado, efectivoContado, observacion, idUsuarioCierre: datos.idUsuario },
    })
    if (count === 0) throw new ErrorPedido(409, 'Esta caja ya se cerró.')
    return { efectivoEsperado, efectivoContado, diferencia: redondear(efectivoContado - efectivoEsperado) }
  })
}
