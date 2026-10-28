'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Clock } from '@/components/icons'
import { Aviso } from '@/components/ui/Aviso'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'
import { Button, estilosBoton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fechaArgentina, ZONA_ASISTENCIA } from '@/lib/asistencia/reglas'
import type { DatosAsistencia } from '@/lib/asistencia/tipos'
import { notificarCambioAsistencia, pedirAsistencia, useAsistencia } from './useAsistencia'

export function horaAsistencia(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA_ASISTENCIA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}
export function fechaAsistencia(fecha: string) { return fecha.split('-').reverse().join('/') }

export function ControlTurno({ datos, onActualizar, mostrarHistorial = true, compacto = false }: { datos: DatosAsistencia; onActualizar: () => void; mostrarHistorial?: boolean; compacto?: boolean }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [confirmarFin, setConfirmarFin] = useState<number | null>(null)
  const referencia = datos.abierto ?? datos.registroDelDia ?? datos.programado
  const registro = datos.abierto ?? datos.registroDelDia
  const puedeIniciar = !datos.abierto && !datos.registroDelDia && datos.programado !== null
    && new Date(datos.ahora) < new Date(datos.programado.salidaPrevista) && datos.usuario.activo

  const puedeReanudar = Boolean(datos.puedeReanudarTurno && datos.registroDelDia?.salida && datos.usuario.activo)
  const confirmandoSalida = confirmarFin !== null && datos.abierto?.idAsistencia === confirmarFin

  function solicitarMarca() {
    if (datos.abierto) { setError(''); setMensaje(''); setConfirmarFin(datos.abierto.idAsistencia); return }
    void marcar(puedeReanudar ? 'reanudar' : 'iniciar', puedeReanudar ? datos.registroDelDia?.idAsistencia : undefined)
  }
  async function marcar(accion: 'iniciar' | 'finalizar' | 'reanudar', idAsistencia?: number) {
    if (ocupado) return
    setOcupado(true); setError(''); setMensaje('')
    try {
      const respuesta = await pedirAsistencia<{ mensaje: string }>('/api/asistencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          accion, ...(idAsistencia !== undefined ? { idAsistencia } : {}),
          ...(accion === 'reanudar' ? { salidaRegistrada: datos.registroDelDia?.salida } : {}),
        }),
      }, { accion: accion === 'iniciar' ? 'registrar la entrada' : accion === 'finalizar' ? 'registrar la salida' : 'reanudar el turno' })
      setMensaje(respuesta.mensaje); setConfirmarFin(null)
      notificarCambioAsistencia()
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo registrar la marca.') }
    finally { setOcupado(false); onActualizar() }
  }

  const contenidoConfirmacion = (
    <div className={compacto ? 'h-full' : undefined} onKeyDown={e => { if (e.key === 'Escape' && !ocupado) setConfirmarFin(null) }}>
      <Aviso tipo="advertencia" titulo="¿Finalizar tu turno?" className={compacto ? 'h-full items-center! px-3! text-center [&>svg]:hidden' : undefined}>
        {!compacto && <p>Se registrará tu salida con la hora actual.</p>}
        <div className={`mt-3 flex gap-2 ${compacto ? '' : 'flex-wrap'}`}>
          <Button type="button" variant="secundario" className={`w-auto! rounded-full! ${compacto ? 'min-w-0 flex-1 px-3!' : ''}`} disabled={ocupado} onClick={() => setConfirmarFin(null)}>Cancelar</Button>
          <Button type="button" variant="acento" aria-label="Confirmar salida" className={`w-auto! rounded-full! ${compacto ? 'min-w-0 flex-1 px-3!' : ''}`} disabled={ocupado} onClick={() => { if (confirmarFin !== null) void marcar('finalizar', confirmarFin) }}>{compacto ? 'Confirmar' : 'Confirmar salida'}</Button>
        </div>
      </Aviso>
    </div>
  )

  const confirmacionSalida = confirmandoSalida && contenidoConfirmacion

  if (compacto) return (
    <section aria-label="Mi turno" className="min-w-0 xl:relative">
      <Card className="max-w-none! rounded-3xl! border-0! flex min-w-0 flex-col gap-4 xl:absolute xl:inset-0 xl:min-h-0">
        <div className="flex shrink-0 flex-col items-center gap-1 py-1 text-center">
          <div className="flex items-center justify-center gap-3">
            <Clock className="size-6 shrink-0 text-accent" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Mi turno</h2>
          </div>
          <p className="text-sm text-muted">{datos.abierto ? 'En curso' : datos.registroDelDia ? 'Finalizado' : puedeIniciar ? 'Sin iniciar' : 'Sin turno disponible'}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex shrink-0 flex-col rounded-2xl border border-border p-4 xl:flex-1">
            <h3 className="text-center text-base font-semibold">Horario de esta jornada</h3>
            {referencia ? <dl className="mt-3 flex flex-col gap-3 text-sm xl:flex-1 xl:justify-evenly">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1"><dt className="text-muted">Jornada</dt><dd className="text-right font-medium tabular-nums">{fechaAsistencia(referencia.fechaJornada)}</dd></div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1"><dt className="text-muted">Entrada</dt><dd className="text-right font-medium tabular-nums">{horaAsistencia(referencia.entradaPrevista)}</dd></div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1"><dt className="text-muted">Salida</dt><dd className="text-right font-medium tabular-nums">{horaAsistencia(referencia.salidaPrevista)}{fechaArgentina(new Date(referencia.salidaPrevista)) !== fechaArgentina(new Date(referencia.entradaPrevista)) && <span className="block text-xs font-normal text-muted">Día siguiente</span>}</dd></div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1"><dt className="text-muted">Tolerancia</dt><dd className="text-right font-medium tabular-nums">{referencia.toleranciaMinutos} min</dd></div>
            </dl> : <p className="mt-3 text-sm text-muted">{datos.horario.length ? 'Hoy no tenés un turno asignado.' : 'Todavía no tenés un horario asignado.'}</p>}
          </div>

          <div className="flex shrink-0 flex-col rounded-2xl border border-border p-4 xl:flex-1">
            <h3 className="text-center text-base font-semibold">Registro del turno</h3>
            <dl className="mt-3 flex flex-col gap-3 text-sm xl:flex-1 xl:justify-evenly">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1"><dt className="text-muted">Entrada</dt><dd className="text-right font-medium tabular-nums">{registro ? horaAsistencia(registro.entrada) : 'Sin registrar'}</dd></div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1"><dt className="text-muted">Salida</dt><dd className="text-right font-medium tabular-nums">{registro?.salida ? horaAsistencia(registro.salida) : 'Sin registrar'}</dd></div>
            </dl>
            {registro && <div className="mt-3 border-t border-bg pt-2 text-center text-sm">
              <p className={registro.puntualidad === 'puntual' ? 'text-success' : 'text-warning'}>{registro.puntualidad === 'puntual' ? 'Entrada puntual' : `Llegada tarde (${registro.minutosTarde} min)`}</p>
              {registro.salida && <p className="mt-1 text-muted">{registro.cumplimiento === 'completo' ? 'Jornada completa' : registro.salidaAnticipada ? 'Salida anticipada' : 'Horas incompletas'}</p>}
            </div>}
          </div>
        </div>

        <div className="mt-auto flex shrink-0 flex-col gap-3">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {mensaje && <AvisoFlotante mensaje={mensaje} onCerrar={() => setMensaje('')} />}
          {mostrarHistorial && <Link href="/perfil/asistencia" className={`${estilosBoton({ variant: 'secundario' })} rounded-full!`}><Clock className="size-4" aria-hidden="true" />Mi historial</Link>}
          {confirmacionSalida}
          {!confirmandoSalida && <Button type="button" variant="acento" className="rounded-full!" disabled={ocupado || (!datos.abierto && !puedeIniciar && !puedeReanudar)} onClick={solicitarMarca}>
            {ocupado ? 'Registrando…' : datos.abierto ? 'Finalizar turno' : puedeReanudar ? 'Reanudar turno' : datos.registroDelDia ? 'Turno finalizado' : 'Iniciar turno'}
          </Button>}
        </div>
      </Card>
    </section>
  )

  return (
    <section aria-label="Mi turno" className={compacto ? 'min-w-0 xl:flex' : 'min-w-0'}>
      <Card className="max-w-none! rounded-3xl! border-0! flex min-w-0 flex-col gap-3">
      <div className={compacto ? 'flex flex-col gap-5' : 'flex flex-wrap items-center justify-between gap-4'}>
        <div className="flex min-w-0 items-start gap-3">
          <Clock className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Mi turno</h2>
            <p className="mt-1 text-sm text-muted">
              {referencia ? <>Entrada: {horaAsistencia(referencia.entradaPrevista)} · Salida: {horaAsistencia(referencia.salidaPrevista)}{fechaArgentina(new Date(referencia.salidaPrevista)) !== fechaArgentina(new Date(referencia.entradaPrevista)) ? ' (día siguiente)' : ''}</>
                : datos.horario.length === 0 ? 'Sin horario asignado.' : 'Sin turno asignado para hoy.'}
            </p>
          </div>
        </div>
        <div className={compacto ? 'flex flex-col gap-3' : 'flex flex-wrap items-center gap-3'}>
          {mostrarHistorial && <Link href="/perfil/asistencia" className={`${estilosBoton({ variant: 'secundario' })} w-auto! rounded-full! whitespace-nowrap`}>
            <Clock className="size-4" aria-hidden="true" />
            Mi historial
          </Link>}
          <Button type="button" variant="acento" className="w-auto! rounded-full!" disabled={ocupado || confirmandoSalida || (!datos.abierto && !puedeIniciar && !puedeReanudar)} onClick={solicitarMarca}>
            {ocupado ? 'Registrando…' : datos.abierto ? 'Finalizar turno' : puedeReanudar ? 'Reanudar turno' : datos.registroDelDia ? 'Turno finalizado' : 'Iniciar turno'}
          </Button>
        </div>
      </div>
      {confirmacionSalida}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && <AvisoFlotante mensaje={mensaje} onCerrar={() => setMensaje('')} />}
      </Card>
    </section>
  )
}

export function MiTurno() {
  const { datos, error, recargar } = useAsistencia('/api/asistencia')
  if (!datos) return <section className="rounded-3xl bg-surface p-5 shadow-sm">{error ? <Aviso tipo="advertencia" accion={{ texto: 'Reintentar', onClick: recargar }}>{error}</Aviso> : <p className="text-sm text-muted">Cargando mi turno…</p>}</section>
  return <>{error && <Aviso tipo="advertencia">{error}</Aviso>}<ControlTurno datos={datos} onActualizar={recargar} /></>
}
