'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, CircleCheck } from '@/components/icons'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Desplegable } from '@/components/ui/Desplegable'
import { SelectorRangoFechas } from '@/components/ui/SelectorRangoFechas'
import { DIAS_ASISTENCIA, fechaArgentina, sumarDias, OPCIONES_PUNTUALIDAD_ASISTENCIA, OPCIONES_JORNADA_ASISTENCIA, type FiltroPuntualidadAsistencia, type FiltroJornadaAsistencia } from '@/lib/asistencia/reglas'
import type { RegistroAsistencia } from '@/lib/asistencia/tipos'
import { rolSinSucursal } from '@/lib/usuarios/roles'
import { EditorHorario } from './EditorHorario'
import { ExportarAsistencia } from './ExportarAsistencia'
import { ControlTurno, fechaAsistencia, horaAsistencia } from './MiTurno'
import { useAsistencia } from './useAsistencia'

function duracion(minutos: number | null) {
  return minutos === null ? 'En curso' : `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

function EstadoJornada({ registro }: { registro: RegistroAsistencia }) {
  const texto = registro.cumplimiento === 'completo' ? 'Jornada completa'
    : registro.cumplimiento === 'en_curso' ? 'Turno abierto'
      : registro.salidaAnticipada ? 'Salida anticipada' : 'Horas incompletas'
  const color = registro.cumplimiento === 'completo' ? 'text-success'
    : registro.cumplimiento === 'en_curso' ? 'text-info' : 'text-warning'
  return <span className={color}>{texto}</span>
}

export function FichaAsistencia({ idUsuario }: { idUsuario?: number }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const [puntualidad, setPuntualidad] = useState<FiltroPuntualidadAsistencia | 'todas'>('todas')
  const [jornada, setJornada] = useState<FiltroJornadaAsistencia | 'todas'>('todas')
  const hayFiltros = Boolean(desde || hasta || puntualidad !== 'todas' || jornada !== 'todas')
  const filtros = new URLSearchParams({
    ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}),
    ...(pagina > 1 ? { pagina: String(pagina) } : {}),
    ...(puntualidad !== 'todas' ? { puntualidad } : {}), ...(jornada !== 'todas' ? { jornada } : {}),
  })
  const endpoint = `${idUsuario ? `/api/asistencia/usuarios/${idUsuario}` : '/api/asistencia'}${filtros.size ? `?${filtros}` : ''}`
  const { datos, error, recargar, cargando } = useAsistencia(endpoint, true)
  const propia = datos?.esPropia ?? !idUsuario
  const hoy = fechaArgentina(datos ? new Date(datos.ahora) : new Date())
  const hastaCalendario = hasta || datos?.hasta || hoy
  const desdeCalendario = desde || datos?.desde || sumarDias(hastaCalendario, -29)

  return (
    <main className="flex min-w-0 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">{propia ? 'Mi asistencia' : datos ? `Asistencia de ${datos.usuario.nombre} ${datos.usuario.apellido}` : 'Asistencia del personal'}</h1>
        <p className="text-sm text-muted">{propia ? 'Registrá tu entrada y salida, y consultá tus horarios.' : 'Consultá los horarios y las entradas y salidas de esta persona.'}</p>
      </header>

      {!datos && !error && <p className="text-sm text-muted" role="status">Cargando asistencia…</p>}
      {datos && <>
        {!datos.usuario.activo && <Aviso tipo="info">Usuario archivado. Su historial permanece disponible.</Aviso>}
        <div className={datos.esPropia ? 'grid min-w-0 items-start gap-6 xl:min-h-144 xl:items-stretch xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)]' : 'min-w-0'}>
          {datos.esPropia && <ControlTurno datos={datos} onActualizar={recargar} mostrarHistorial={false} compacto />}
          <section aria-labelledby="titulo-horario" className="min-w-0 xl:flex">
            <Card className="max-w-none! rounded-3xl! border-0! flex min-w-0 flex-col gap-4">
              <div>
                <h2 id="titulo-horario" className="text-lg font-semibold">Horario semanal</h2>
                {!rolSinSucursal(datos.usuario.rol) && <p className="mt-1 text-sm text-muted">Sucursal: {datos.usuario.sucursal ?? 'Sin sucursal fija'}</p>}
              </div>
              {datos.puedeEditarHorario ? (
                <EditorHorario key={datos.usuario.idUsuario} idUsuario={datos.usuario.idUsuario} horario={datos.horario} versionHorario={datos.versionHorario} onGuardado={recargar} />
              ) : datos.horario.length ? (
                <div className="flex-1 overflow-x-auto">
                  <table className="h-full w-full min-w-xl table-fixed text-center text-sm">
                    <caption className="sr-only">Días y horarios de trabajo asignados</caption>
                    <thead><tr className="text-xs text-muted">
                      {['Día', 'Entrada', 'Salida', 'Tolerancia de entrada'].map((t, i) => <th key={t} scope="col" className="w-1/4 px-3 py-3 font-medium"><span className={`mx-auto block w-full max-w-48 ${i === 0 ? 'text-left' : 'text-center'}`}>{t}</span></th>)}
                    </tr></thead>
                    <tbody>{datos.horario.map(d => (
                      <tr key={d.diaSemana} className="border-t border-bg transition-colors hover:bg-bg/60">
                        <th scope="row" className="px-3 py-3 font-medium"><span className="mx-auto block w-full max-w-48 text-left">{DIAS_ASISTENCIA[d.diaSemana]}</span></th>
                        <td className="px-3 py-3 tabular-nums"><span className="mx-auto block w-full max-w-48 text-center">{d.entrada}</span></td>
                        <td className="px-3 py-3 tabular-nums"><span className="mx-auto block w-full max-w-48 text-center">{d.salida}{d.salida < d.entrada && <span className="block text-xs text-muted">del día siguiente</span>}</span></td>
                        <td className="px-3 py-3 tabular-nums"><span className="mx-auto block w-full max-w-48 text-center">{d.toleranciaMinutos} min</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted">{propia ? 'Todavía no tenés un horario asignado.' : 'Sin horario asignado.'} El administrador debe configurar el horario.</p>}
            </Card>
          </section>
        </div>
      </>}

      <section aria-labelledby="titulo-historial">
        <Card className="max-w-none! rounded-3xl! border-0! flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="titulo-historial" className="text-lg font-semibold">Historial de asistencia</h2>
              <p className="mt-1 text-sm text-muted">{hayFiltros ? 'Jornadas que coinciden con los filtros seleccionados.' : 'Todo el historial, ordenado por fecha.'}</p>
            </div>
            <div className="ml-auto">
              <ExportarAsistencia key={endpoint} endpoint={endpoint} deshabilitado={!datos || cargando || Boolean(error) || datos.totalRegistros === 0} />
            </div>
          </div>
          <div aria-label="Filtrar historial" className="flex flex-wrap items-end gap-3">
            <SelectorRangoFechas
              etiqueta="Fechas del historial"
              textoBoton={!desde && !hasta ? 'Elegir fechas' : undefined}
              desde={desdeCalendario}
              hasta={hastaCalendario}
              maximo={hoy}
              onCambiar={rango => { setDesde(rango.desde); setHasta(rango.hasta); setPagina(1) }}
            />
            <div className="w-full sm:w-60">
              <Desplegable etiqueta="Puntualidad" icono={Clock} opciones={OPCIONES_PUNTUALIDAD_ASISTENCIA} valor={puntualidad} textoVacio="Todas las llegadas" onElegir={valor => { setPuntualidad(valor); setPagina(1) }} />
            </div>
            <div className="w-full sm:w-60">
              <Desplegable etiqueta="Jornada" icono={CircleCheck} opciones={OPCIONES_JORNADA_ASISTENCIA} valor={jornada} textoVacio="Todas las jornadas" onElegir={valor => { setJornada(valor); setPagina(1) }} />
            </div>
            {hayFiltros && <Button variant="secundario" className="w-auto! rounded-full!" onClick={() => { setDesde(''); setHasta(''); setPuntualidad('todas'); setJornada('todas'); setPagina(1) }}>Quitar filtro</Button>}
          </div>
          {error && <Aviso tipo="error" accion={{ texto: 'Reintentar', onClick: recargar }}>{error}</Aviso>}
          {cargando && <p role="status" className="text-sm text-muted">Cargando historial…</p>}
          {datos && !error && <>
            <p className="text-xs text-muted">{datos.desde ? `${fechaAsistencia(datos.desde)} al ${fechaAsistencia(datos.hasta)}` : `Historial completo hasta el ${fechaAsistencia(datos.hasta)}`} · {datos.totalRegistros} {datos.totalRegistros === 1 ? 'jornada registrada' : 'jornadas registradas'} · Hora de Argentina</p>
            {datos.registros.length === 0 ? (
              <p className="text-sm text-muted">No hay jornadas que coincidan con los filtros.</p>
            ) : (
              <div aria-busy={cargando} className="overflow-x-auto rounded-3xl bg-surface p-2">
                <table className="w-full text-center text-sm">
                  <caption className="sr-only">Entradas, salidas y cumplimiento de las jornadas registradas</caption>
                  <thead><tr className="text-xs text-muted">{['Fecha', 'Sucursal', 'Horario asignado', 'Entrada registrada', 'Salida registrada', 'Horas trabajadas', 'Puntualidad', 'Jornada'].map(t => <th key={t} scope="col" className="whitespace-nowrap px-4 py-3 text-center font-medium">{t}</th>)}</tr></thead>
                  <tbody>{datos.registros.map(r => (
                    <tr key={r.idAsistencia} className="border-t border-bg transition-colors hover:bg-bg/60">
                      <td className="whitespace-nowrap px-4 py-3">{fechaAsistencia(r.fechaJornada)}</td>
                      <td className="px-4 py-3">{r.sucursal ?? 'Sin sucursal fija'}</td>
                      <td className="whitespace-nowrap px-4 py-3"><p>{horaAsistencia(r.entradaPrevista)} a {horaAsistencia(r.salidaPrevista)}</p><p className="text-xs text-muted">Tolerancia: {r.toleranciaMinutos} min</p></td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{horaAsistencia(r.entrada)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.salida ? horaAsistencia(r.salida) : 'Sin registrar'}</td>
                      <td className="whitespace-nowrap px-4 py-3"><p>{duracion(r.minutosTrabajados)}</p><p className="text-xs text-muted">Asignadas: {duracion(r.minutosPrevistos)}</p></td>
                      <td className={`px-4 py-3 ${r.puntualidad === 'puntual' ? 'text-success' : 'text-warning'}`}>{r.puntualidad === 'puntual' ? 'Puntual' : `Llegada tarde (${r.minutosTarde} min)`}</td>
                      <td className="px-4 py-3"><EstadoJornada registro={r} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <nav aria-label="Páginas del historial" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted" aria-live="polite">{datos.totalRegistros ? `${(datos.pagina - 1) * datos.porPagina + 1}–${(datos.pagina - 1) * datos.porPagina + datos.registros.length} de ${datos.totalRegistros} jornadas` : '0 jornadas'}</p>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <Button variant="secundario" className="w-auto! rounded-full!" aria-label="Página anterior del historial" disabled={cargando || datos.pagina <= 1} onClick={() => setPagina(datos.pagina - 1)}><ChevronLeft className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Anterior</span></Button>
                <span className="text-sm" aria-live="polite">Página {datos.pagina} de {datos.totalPaginas}</span>
                <Button variant="secundario" className="w-auto! rounded-full!" aria-label="Página siguiente del historial" disabled={cargando || datos.pagina >= datos.totalPaginas} onClick={() => setPagina(datos.pagina + 1)}><span className="hidden sm:inline">Siguiente</span><ChevronRight className="size-4" aria-hidden="true" /></Button>
              </div>
            </nav>
          </>}
        </Card>
      </section>
    </main>
  )
}
