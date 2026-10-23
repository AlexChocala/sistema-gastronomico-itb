'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { DIAS_ASISTENCIA } from '@/lib/asistencia/reglas'
import type { RegistroAsistencia } from '@/lib/asistencia/tipos'
import { EditorHorario } from './EditorHorario'
import { ControlTurno, fechaAsistencia, horaAsistencia } from './MiTurno'
import { useAsistencia } from './useAsistencia'

function duracion(minutos: number | null) { return minutos === null ? 'En curso' : `${Math.floor(minutos / 60)} h ${minutos % 60} min` }
function Etiquetas({ registro }: { registro: RegistroAsistencia }) {
  return <div className="flex flex-col gap-1 text-xs">
    <span className={registro.puntualidad === 'puntual' ? 'text-success' : 'text-warning'}>{registro.puntualidad === 'puntual' ? 'Puntual' : `Llegada tarde (${registro.minutosTarde} min)`}</span>
    <span className={registro.cumplimiento === 'completo' ? 'text-success' : registro.cumplimiento === 'en_curso' ? 'text-info' : 'text-warning'}>
      {registro.cumplimiento === 'completo' ? 'Jornada completa' : registro.cumplimiento === 'en_curso' ? 'Turno abierto' : registro.salidaAnticipada ? 'Salida anticipada' : 'Tiempo trabajado incompleto'}
    </span>
  </div>
}

export function FichaAsistencia({ idUsuario }: { idUsuario?: number }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [editando, setEditando] = useState(false)
  const filtros = new URLSearchParams({ ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) })
  const endpoint = `${idUsuario ? `/api/asistencia/usuarios/${idUsuario}` : '/api/asistencia'}${filtros.size ? `?${filtros}` : ''}`
  const { datos, error, recargar } = useAsistencia(endpoint)
  return (
    <main className="flex min-w-0 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link href={idUsuario ? '/usuarios/asistencia' : '/perfil'} className="self-start rounded-full py-1 text-sm text-accent hover:underline">{idUsuario ? 'Volver al personal' : 'Volver a mi perfil'}</Link>
        <h1 className="page-title">{datos ? `Asistencia de ${datos.usuario.nombre} ${datos.usuario.apellido}` : 'Historial de asistencia'}</h1>
        <p className="text-sm text-muted">Entrada, salida y cumplimiento del horario. Las horas se muestran en hora de Argentina.</p>
      </header>
      <section aria-label="Filtrar historial" className="flex flex-wrap items-end justify-between gap-3 rounded-3xl bg-surface p-4 shadow-sm">
        <p className="text-sm font-medium">Filtrar historial</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">Desde<input type="date" aria-label="Desde" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className="min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text" /></label>
              <label className="flex flex-col gap-1 text-xs text-muted">Hasta<input type="date" aria-label="Hasta" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className="min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text" /></label>
              {(desde || hasta) && <button type="button" onClick={() => { setDesde(''); setHasta('') }} className="cursor-pointer rounded-full px-3 py-2 text-sm text-accent hover:underline">Últimos 30 días</button>}
            </div>
      </section>
      {error && <Aviso tipo="error" accion={{ texto: 'Reintentar', onClick: recargar }}>{error}</Aviso>}
      {!datos && !error && <p className="text-sm text-muted">Cargando asistencia…</p>}
      {datos && <>
        {!datos.usuario.activo && <Aviso tipo="info">Usuario archivado. Su historial permanece disponible.</Aviso>}
        {datos.esPropia && <ControlTurno datos={datos} onActualizar={recargar} />}
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm" aria-labelledby="titulo-horario">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="titulo-horario" className="text-lg font-semibold">Horario semanal</h2>{datos.puedeEditarHorario && !editando && <Button variant="secundario" className="w-auto! rounded-full!" onClick={() => setEditando(true)}>Editar horario</Button>}</div>
          <p className="text-sm text-muted">Sucursal actual: {datos.usuario.sucursal ?? 'Sin sucursal fija'}. Se admite un turno por día; una salida menor a la entrada corresponde al día siguiente.</p>
          {datos.horario.length ? <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{datos.horario.map(d => <li key={d.diaSemana} className="rounded-2xl bg-bg px-4 py-3 text-sm"><p className="font-medium">{DIAS_ASISTENCIA[d.diaSemana]}</p><p>{d.entrada} a {d.salida}{d.salida < d.entrada ? ' (+1 día)' : ''}</p><p className="text-xs text-muted">Tolerancia: {d.toleranciaMinutos} min</p></li>)}</ul> : <p className="text-sm text-muted">No tiene un horario asignado. El administrador puede configurarlo desde esta ficha.</p>}
          {datos.puedeEditarHorario && editando && <EditorHorario idUsuario={datos.usuario.idUsuario} horario={datos.horario} versionHorario={datos.versionHorario} onCerrar={() => setEditando(false)} onGuardado={recargar} />}
        </section>
        <section className="flex min-w-0 flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm" aria-labelledby="titulo-historial">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="titulo-historial" className="text-lg font-semibold">Historial de asistencia</h2><p className="text-xs text-muted">{fechaAsistencia(datos.desde)} al {fechaAsistencia(datos.hasta)} · {datos.registros.length} registros</p></div>

          </div>
          <p className="text-xs text-muted">Puntualidad y cumplimiento se evalúan por separado. La tolerancia permite llegar a tiempo, pero no descuenta minutos de la jornada. Se muestran las jornadas registradas, sin generar ausencias automáticamente.</p>
          {datos.registros.length === 0 ? <p className="text-sm text-muted">No hay asistencias registradas en este período.</p> : <div className="overflow-x-auto rounded-2xl border border-border"><table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-muted"><tr>{['Fecha', 'Sucursal', 'Horario asignado', 'Entrada', 'Salida', 'Trabajado / previsto', 'Resultado'].map(t => <th key={t} className="whitespace-nowrap px-3 py-3 font-medium">{t}</th>)}</tr></thead>
            <tbody>{datos.registros.map(r => <tr key={r.idAsistencia} className="border-t border-border">
              <td className="whitespace-nowrap px-3 py-3">{fechaAsistencia(r.fechaJornada)}</td><td className="px-3 py-3">{r.sucursal ?? 'Sin sucursal fija'}</td>
              <td className="whitespace-nowrap px-3 py-3"><p>{horaAsistencia(r.entradaPrevista)} a {horaAsistencia(r.salidaPrevista)}</p><p className="text-xs text-muted">Tolerancia {r.toleranciaMinutos} min</p></td>
              <td className="whitespace-nowrap px-3 py-3">{horaAsistencia(r.entrada)}</td><td className="whitespace-nowrap px-3 py-3">{r.salida ? horaAsistencia(r.salida) : 'Pendiente'}</td>
              <td className="whitespace-nowrap px-3 py-3"><p>{duracion(r.minutosTrabajados)}</p><p className="text-xs text-muted">Previsto: {duracion(r.minutosPrevistos)}</p></td><td className="px-3 py-3"><Etiquetas registro={r} /></td>
            </tr>)}</tbody>
          </table></div>}
        </section>
      </>}
    </main>
  )
}
