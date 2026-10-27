'use client'

import { useEffect, useState } from 'react'
import { Search } from '@/components/icons'
import { Aviso } from '@/components/ui/Aviso'
import type { PersonaAsistencia } from '@/lib/asistencia/tipos'
import { etiquetaRol } from '@/lib/usuarios/roles'
import { pedirAsistencia } from './useAsistencia'
import { BotonVerHistorial } from './BotonVerHistorial'

export function ListadoAsistencia() {
  const [usuarios, setUsuarios] = useState<PersonaAsistencia[] | null>(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    const abortar = new AbortController()
    pedirAsistencia<{ usuarios: PersonaAsistencia[] }>('/api/asistencia/usuarios', { signal: abortar.signal }, { accion: 'cargar el personal' })
      .then(datos => { if (vigente) { setUsuarios(datos.usuarios); setError('') } })
      .catch(error => { if (vigente) setError(error instanceof Error ? error.message : 'No se pudo consultar el personal.') })
    return () => { vigente = false; abortar.abort() }
  }, [intento])
  const texto = busqueda.trim().toLocaleLowerCase('es')
  const visibles = usuarios?.filter(u => `${u.nombre} ${u.apellido} ${u.sucursal ?? ''}`.toLocaleLowerCase('es').includes(texto)) ?? []
  return <main className="flex min-w-0 flex-col gap-6 p-6">
    <header><h1 className="page-title">Asistencia del personal</h1><p className="mt-1 text-sm text-muted">Usá Ver historial para consultar el horario y la asistencia de cada usuario. Se incluyen las cuentas archivadas.</p></header>
    {error && <Aviso tipo="error" accion={{ texto: 'Reintentar', onClick: () => setIntento(n => n + 1) }}>{error}</Aviso>}
    <label className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 sm:max-w-md"><Search className="size-4 shrink-0 text-muted" aria-hidden="true" /><input type="search" aria-label="Buscar personal" placeholder="Buscar por nombre o sucursal" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none" /></label>
    {!usuarios && !error && <p className="text-sm text-muted">Cargando personal…</p>}
    {usuarios && (visibles.length === 0 ? <p className="text-sm text-muted">No hay usuarios para mostrar.</p> : <div className="overflow-x-auto rounded-3xl bg-surface p-2 shadow-sm"><table className="w-full text-left text-sm"><thead className="text-muted"><tr>{['Usuario', 'Rol', 'Sucursal', 'Estado', 'Acciones'].map(t => <th key={t} className={`px-4 py-3 font-medium ${t === 'Acciones' ? 'text-center' : ''}`}>{t}</th>)}</tr></thead><tbody>{visibles.map(u => <tr key={u.idUsuario} className="border-t border-border"><td className="px-4 py-3"><span className="font-medium">{u.nombre} {u.apellido}</span></td><td className="px-4 py-3">{etiquetaRol(u.rol)}</td><td className="px-4 py-3">{u.sucursal ?? 'Sin sucursal fija'}</td><td className="px-4 py-3">{u.activo ? 'Activo' : 'Archivado'}</td><td className="px-4 py-3 text-center"><BotonVerHistorial idUsuario={u.idUsuario} nombre={`${u.nombre} ${u.apellido}`} /></td></tr>)}</tbody></table></div>)}
  </main>
}
