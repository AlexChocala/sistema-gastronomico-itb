'use client'

import { useId, useState, type FormEvent } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CampoHora } from './CampoHora'
import { DIAS_ASISTENCIA, validarHorario, type HorarioDia } from '@/lib/asistencia/reglas'
import { notificarCambioAsistencia, pedirAsistencia } from './useAsistencia'
import { useCambiosSinGuardar } from '@/lib/utils/useCambiosSinGuardar'

type DiaFormulario = HorarioDia & { habilitado: boolean }
type Borrador = { dias: DiaFormulario[]; version: string }

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/
function normalizarHora(valor: string) {
  const hora = valor.trim()
  const partes = /^(\d{1,2}):(\d{1,2})$/.exec(hora)
  if (partes) return `${partes[1].padStart(2, '0')}:${partes[2].padStart(2, '0')}`
  if (/^\d{1,2}$/.test(hora)) return `${hora.padStart(2, '0')}:00`
  if (/^\d{3,4}$/.test(hora)) return `${hora.slice(0, -2).padStart(2, '0')}:${hora.slice(-2)}`
  return hora
}

function diasFormulario(horario: HorarioDia[]): DiaFormulario[] {
  return [1, 2, 3, 4, 5, 6, 0].map(diaSemana => ({
    diaSemana, entrada: '09:00', salida: '17:00', toleranciaMinutos: 10,
    ...horario.find(h => h.diaSemana === diaSemana), habilitado: horario.some(h => h.diaSemana === diaSemana),
  }))
}

export function EditorHorario({ idUsuario, horario, versionHorario, onGuardado }: {
  idUsuario: number; horario: HorarioDia[]; versionHorario: string; onGuardado: () => void
}) {
  const id = useId()
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [mostrarErrores, setMostrarErrores] = useState(false)
  const dias = borrador?.dias ?? diasFormulario(horario)
  const cambioExterno = borrador !== null && borrador.version !== versionHorario
  const hayCambios = borrador !== null && JSON.stringify(borrador.dias) !== JSON.stringify(diasFormulario(horario))

  useCambiosSinGuardar(hayCambios)

  function cambiar(diaSemana: number, cambios: Partial<DiaFormulario>) {
    setMensaje(''); setError('')
    setBorrador(previo => ({
      version: previo?.version ?? versionHorario,
      dias: (previo?.dias ?? diasFormulario(horario)).map(d => d.diaSemana === diaSemana ? { ...d, ...cambios } : d),
    }))
  }
  function descartar() {
    setBorrador(null); setError(''); setMensaje(''); setMostrarErrores(false); onGuardado()
  }
  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado || !hayCambios || cambioExterno) return
    setError(''); setMensaje(''); setMostrarErrores(true)
    let horarioNuevo: HorarioDia[]
    try {
      horarioNuevo = validarHorario(dias.filter(d => d.habilitado).map(({ diaSemana, entrada, salida, toleranciaMinutos }) => ({ diaSemana, entrada: normalizarHora(entrada), salida: normalizarHora(salida), toleranciaMinutos })))
    } catch (error) { setError(error instanceof Error ? error.message : 'Revisá los horarios.'); return }
    setOcupado(true)
    const control = new AbortController()
    const espera = setTimeout(() => control.abort(), 15000)
    try {
      await pedirAsistencia(`/api/asistencia/usuarios/${idUsuario}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: control.signal,
        body: JSON.stringify({ horario: horarioNuevo, versionHorario: borrador!.version }),
      }, { accion: 'guardar el horario' })
      setBorrador(null); setMostrarErrores(false); setMensaje('Horario guardado.')
      notificarCambioAsistencia(); onGuardado()
    } catch (error) {
      setError(control.signal.aborted ? 'Se agotó el tiempo de espera. No pudimos confirmar el guardado. Actualizá la ficha para comprobar si se guardó antes de reintentar.' : error instanceof Error ? error.message : 'No se pudo guardar el horario.')
      if (control.signal.aborted) onGuardado()
    } finally { clearTimeout(espera); setOcupado(false) }
  }
  const claseCampo = 'w-full min-w-0 text-center text-sm tabular-nums disabled:opacity-50'
  return (
    <form noValidate onSubmit={guardar} className="flex min-w-0 flex-col gap-4" aria-label="Editar horario semanal">
      <p className="text-sm text-muted">Escribí el horario o usá la rueda sobre las horas y los minutos.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-xl table-fixed text-center text-sm">
          <caption className="sr-only">Editar los días y horarios de trabajo asignados</caption>
          <thead><tr className="text-xs text-muted">
            {['Día laboral', 'Entrada', 'Salida', 'Tolerancia (min)'].map((t, i) => (
              <th key={t} scope="col" className="w-1/4 px-2 py-3 text-center font-medium">
                {i === 0 ? <span className="mx-auto block w-full max-w-48 text-center">{t}</span> : t}
              </th>
            ))}
          </tr></thead>
          <tbody>{dias.map(d => (
            <tr key={d.diaSemana} className="border-t border-bg transition-colors hover:bg-bg/60">
              <th scope="row" className="px-2 py-3 font-medium">
                <label className="relative mx-auto flex w-full max-w-48 cursor-pointer items-center justify-center text-center">
                  <input type="checkbox" aria-label={`Trabaja ${DIAS_ASISTENCIA[d.diaSemana]}`} checked={d.habilitado} disabled={ocupado}
                    onChange={e => cambiar(d.diaSemana, { habilitado: e.target.checked })} className="absolute top-1/2 left-0 size-4 -translate-y-1/2 accent-accent" />
                  <span>{DIAS_ASISTENCIA[d.diaSemana]}</span>
                </label>
              </th>
              <td className="px-2 py-3">
                <CampoHora id={`${id}-${d.diaSemana}-entrada`} label={`Entrada ${DIAS_ASISTENCIA[d.diaSemana]}`} inputMode="numeric" placeholder="HH:mm" maxLength={5} autoComplete="off" spellCheck={false} required disabled={ocupado || !d.habilitado}
                  value={d.entrada} onCambiar={valor => cambiar(d.diaSemana, { entrada: valor })}
                  onBlur={e => { const hora = normalizarHora(e.target.value); if (hora !== d.entrada) cambiar(d.diaSemana, { entrada: hora }) }}
                  error={d.habilitado && mostrarErrores && !HORA_VALIDA.test(normalizarHora(d.entrada)) ? 'Usá una hora entre 00:00 y 23:59.' : undefined} className={claseCampo} /></td>
              <td className="px-2 py-3">
                <CampoHora id={`${id}-${d.diaSemana}-salida`} label={`Salida ${DIAS_ASISTENCIA[d.diaSemana]}`} inputMode="numeric" placeholder="HH:mm" maxLength={5} autoComplete="off" spellCheck={false} required disabled={ocupado || !d.habilitado}
                  value={d.salida} onCambiar={valor => cambiar(d.diaSemana, { salida: valor })}
                  onBlur={e => { const hora = normalizarHora(e.target.value); if (hora !== d.salida) cambiar(d.diaSemana, { salida: hora }) }}
                  error={d.habilitado && mostrarErrores && !HORA_VALIDA.test(normalizarHora(d.salida)) ? 'Usá una hora entre 00:00 y 23:59.' : undefined} className={claseCampo} />{d.habilitado && HORA_VALIDA.test(normalizarHora(d.entrada)) && HORA_VALIDA.test(normalizarHora(d.salida)) && normalizarHora(d.salida) < normalizarHora(d.entrada) && <p className="mt-1 text-xs text-muted">Día siguiente</p>}</td>
              <td className="px-2 py-3"><div className="relative mx-auto w-full max-w-48 [&_label]:sr-only">
                <Input id={`${id}-${d.diaSemana}-tolerancia`} label={`Tolerancia ${DIAS_ASISTENCIA[d.diaSemana]}`} type="number" min="0" max="120" step="1" required disabled={ocupado || !d.habilitado}
                  value={Number.isNaN(d.toleranciaMinutos) ? '' : d.toleranciaMinutos}
                  onChange={e => cambiar(d.diaSemana, { toleranciaMinutos: e.target.value === '' ? NaN : Number(e.target.value) })} className={claseCampo} />
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {cambioExterno && <Aviso tipo="advertencia">El horario se actualizó mientras editabas. Descartá tus cambios para cargar la versión más reciente.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {borrador !== null && <Button type="button" variant="secundario" disabled={ocupado} onClick={descartar} className="w-auto! rounded-full!">Descartar cambios</Button>}
        <Button type="submit" variant="acento" disabled={ocupado || !hayCambios || cambioExterno} className="w-auto! rounded-full!">{ocupado ? 'Guardando…' : 'Guardar horario'}</Button>
      </div>
    </form>
  )
}
