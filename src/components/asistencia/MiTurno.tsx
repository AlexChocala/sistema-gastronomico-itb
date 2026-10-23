'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Clock } from '@/components/icons'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { fechaArgentina, ZONA_ASISTENCIA } from '@/lib/asistencia/reglas'
import type { DatosAsistencia } from '@/lib/asistencia/tipos'
import { EVENTO_ASISTENCIA, pedirAsistencia, useAsistencia } from './useAsistencia'

export function horaAsistencia(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA_ASISTENCIA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}
export function fechaAsistencia(fecha: string) { return fecha.split('-').reverse().join('/') }

export function ControlTurno({ datos, onActualizar }: { datos: DatosAsistencia; onActualizar: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const referencia = datos.abierto ?? datos.registroDelDia ?? datos.programado
  const registro = datos.abierto ?? datos.registroDelDia
  const puedeIniciar = !datos.abierto && !datos.registroDelDia && datos.programado !== null
    && new Date(datos.ahora) < new Date(datos.programado.salidaPrevista) && datos.usuario.activo

  async function marcar() {
    if (ocupado) return
    setOcupado(true); setError(''); setMensaje('')
    try {
      const respuesta = await pedirAsistencia<{ mensaje: string }>('/api/asistencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: datos.abierto ? 'finalizar' : 'iniciar' }),
      })
      setMensaje(respuesta.mensaje)
      window.dispatchEvent(new Event(EVENTO_ASISTENCIA))
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo registrar la marca.') }
    finally { setOcupado(false); onActualizar() }
  }

  return (
    <section aria-label="Mi turno" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Clock className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Mi turno</h2>
            <p className="text-sm text-muted">
              {datos.abierto ? `En curso · Entrada ${horaAsistencia(datos.abierto.entrada)} del ${fechaAsistencia(datos.abierto.fechaJornada)}`
                : datos.registroDelDia ? 'Turno finalizado para esta jornada.'
                  : puedeIniciar ? 'Tenés un turno pendiente de iniciar.' : 'No hay un turno disponible para iniciar en esta jornada.'}
            </p>
            {referencia && <p className="mt-1 text-sm">Horario asignado: {horaAsistencia(referencia.entradaPrevista)} a {horaAsistencia(referencia.salidaPrevista)}{fechaArgentina(new Date(referencia.salidaPrevista)) !== fechaArgentina(new Date(referencia.entradaPrevista)) ? ' (+1 día)' : ''}</p>}
            {registro && <p className="mt-1 text-xs text-muted">{registro.puntualidad === 'puntual' ? 'Entrada puntual' : `Llegada tarde (${registro.minutosTarde} min)`}{registro.salida ? ` · ${registro.cumplimiento === 'completo' ? 'Jornada completa' : registro.salidaAnticipada ? 'Salida anticipada' : 'Jornada incompleta'}` : ''}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/perfil/asistencia" className="rounded-full px-3 py-2 text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Mi historial</Link>
          <Button variant="acento" className="w-auto! rounded-full!" disabled={ocupado || (!datos.abierto && !puedeIniciar)} onClick={() => void marcar()}>
            {ocupado ? 'Registrando…' : datos.abierto ? 'Finalizar turno' : 'Iniciar turno'}
          </Button>
        </div>
      </div>
      {datos.abierto && new Date(datos.ahora) < new Date(datos.abierto.salidaPrevista) && <p className="text-xs text-warning">Si finalizás ahora, quedará registrada una salida anticipada. La hora se toma del servidor.</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
    </section>
  )
}

export function MiTurno() {
  const { datos, error, recargar } = useAsistencia('/api/asistencia')
  if (!datos) return <section className="rounded-3xl bg-surface p-5 shadow-sm">{error ? <Aviso tipo="advertencia" accion={{ texto: 'Reintentar', onClick: recargar }}>{error}</Aviso> : <p className="text-sm text-muted">Cargando mi turno…</p>}</section>
  return <>{error && <Aviso tipo="advertencia">{error}</Aviso>}<ControlTurno datos={datos} onActualizar={recargar} /></>
}
