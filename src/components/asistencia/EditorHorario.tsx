'use client'

import { useId, useState, type FormEvent } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { DIAS_ASISTENCIA, validarHorario, type HorarioDia } from '@/lib/asistencia/reglas'
import { EVENTO_ASISTENCIA, pedirAsistencia } from './useAsistencia'

type DiaFormulario = HorarioDia & { habilitado: boolean }

export function EditorHorario({ idUsuario, horario, versionHorario, onCerrar, onGuardado }: {
  idUsuario: number; horario: HorarioDia[]; versionHorario: string; onCerrar: () => void; onGuardado: () => void
}) {
  const id = useId()
  const [versionInicial] = useState(versionHorario)
  const [dias, setDias] = useState<DiaFormulario[]>(() => [1, 2, 3, 4, 5, 6, 0].map(diaSemana => ({
    diaSemana, entrada: '09:00', salida: '17:00', toleranciaMinutos: 10,
    ...horario.find(h => h.diaSemana === diaSemana), habilitado: horario.some(h => h.diaSemana === diaSemana),
  })))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  function cambiar(diaSemana: number, cambios: Partial<DiaFormulario>) { setDias(previos => previos.map(d => d.diaSemana === diaSemana ? { ...d, ...cambios } : d)) }
  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    setError('')
    const horario = dias.filter(d => d.habilitado).map(({ diaSemana, entrada, salida, toleranciaMinutos }) => ({ diaSemana, entrada, salida, toleranciaMinutos }))
    try { validarHorario(horario) } catch (error) { setError(error instanceof Error ? error.message : 'Revisá los horarios.'); return }
    setOcupado(true)
    try {
      await pedirAsistencia(`/api/asistencia/usuarios/${idUsuario}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horario, versionHorario: versionInicial }) })
      window.dispatchEvent(new Event(EVENTO_ASISTENCIA)); onGuardado(); onCerrar()
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar el horario.') }
    finally { setOcupado(false) }
  }
  const clase = 'min-w-0 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50'
  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-2xl border border-border p-4" aria-label="Editar horario semanal">
      <p className="text-sm text-muted">Marcá los días de trabajo. Si la salida es anterior a la entrada, el turno termina al día siguiente. Sin días seleccionados, queda sin horario asignado.</p>
      {dias.map(d => (
        <fieldset key={d.diaSemana} disabled={ocupado} className="grid min-w-0 gap-3 rounded-2xl bg-bg p-3 sm:grid-cols-[8rem_1fr_1fr_1fr] sm:items-end">
          <legend className="sr-only">{DIAS_ASISTENCIA[d.diaSemana]}</legend>
          <label className="flex items-center gap-2 py-2 text-sm font-medium"><input type="checkbox" checked={d.habilitado} onChange={e => cambiar(d.diaSemana, { habilitado: e.target.checked })} className="size-4 accent-accent" />{DIAS_ASISTENCIA[d.diaSemana]}</label>
          <div><label htmlFor={`${id}-${d.diaSemana}-entrada`} className="text-xs text-muted">Entrada</label><input id={`${id}-${d.diaSemana}-entrada`} aria-label={`Entrada ${DIAS_ASISTENCIA[d.diaSemana]}`} type="time" step="60" required disabled={!d.habilitado} value={d.entrada} onChange={e => cambiar(d.diaSemana, { entrada: e.target.value })} className={clase} /></div>
          <div><label htmlFor={`${id}-${d.diaSemana}-salida`} className="text-xs text-muted">Salida</label><input id={`${id}-${d.diaSemana}-salida`} aria-label={`Salida ${DIAS_ASISTENCIA[d.diaSemana]}`} type="time" step="60" required disabled={!d.habilitado} value={d.salida} onChange={e => cambiar(d.diaSemana, { salida: e.target.value })} className={clase} /></div>
          <div><label htmlFor={`${id}-${d.diaSemana}-tolerancia`} className="text-xs text-muted">Tolerancia (min)</label><input id={`${id}-${d.diaSemana}-tolerancia`} aria-label={`Tolerancia ${DIAS_ASISTENCIA[d.diaSemana]}`} type="number" min="0" max="120" step="1" required disabled={!d.habilitado} value={Number.isNaN(d.toleranciaMinutos) ? '' : d.toleranciaMinutos} onChange={e => cambiar(d.diaSemana, { toleranciaMinutos: e.target.value === '' ? NaN : Number(e.target.value) })} className={clase} /></div>
        </fieldset>
      ))}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-3"><Button type="submit" variant="acento" disabled={ocupado} className="w-auto! rounded-full!">{ocupado ? 'Guardando…' : 'Guardar horario'}</Button><Button type="button" variant="secundario" disabled={ocupado} onClick={onCerrar} className="w-auto! rounded-full!">Cancelar</Button></div>
    </form>
  )
}
