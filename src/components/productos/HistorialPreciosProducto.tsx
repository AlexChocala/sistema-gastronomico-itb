'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from '@/components/icons'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { solicitarJson } from '@/lib/utils/solicitud-json'
import type { HistorialPrecios } from '@/lib/productos/historial-precios'

const precio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const fecha = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

export function HistorialPreciosProducto({ producto, onCerrar }: {
  producto: { idProducto: number; nombre: string }; onCerrar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const titulo = useId()
  const [pagina, setPagina] = useState(1)
  const [idVariacion, setIdVariacion] = useState<number | null>(null)
  const [intento, setIntento] = useState(0)
  const clave = `${producto.idProducto}/${idVariacion ?? 'base'}/${pagina}/${intento}`
  const [resultado, setResultado] = useState<{ clave: string; datos: HistorialPrecios | null; error: string | null } | null>(null)
  const cargando = resultado?.clave !== clave
  const datos = resultado?.datos ?? null
  const error = !cargando ? resultado?.error : null

  useEffect(() => {
    const elemento = dialogo.current
    elemento?.showModal()
    return () => { if (elemento?.open) elemento.close() }
  }, [])

  useEffect(() => {
    let vigente = true
    const control = new AbortController()
    const parametros = new URLSearchParams({ pagina: String(pagina) })
    if (idVariacion !== null) parametros.set('variacion', String(idVariacion))
    solicitarJson<HistorialPrecios>(`/api/productos/gestion/${producto.idProducto}/historial-precios?${parametros}`,
      { signal: control.signal }, { accion: 'cargar el historial de precios', mensajeNoEncontrado: 'El producto no está disponible o no tenés permiso para consultar su historial. Actualizá la lista de productos.' })
      .then(datos => { if (vigente) setResultado({ clave, datos, error: null }) })
      .catch(error => { if (vigente) setResultado({ clave, datos: null, error: error instanceof Error ? error.message : 'No pudimos cargar el historial de precios.' }) })
    return () => { vigente = false; control.abort() }
  }, [producto.idProducto, idVariacion, pagina, clave])

  function elegirHistorial(siguiente: number | null) {
    setIdVariacion(siguiente)
    setPagina(1)
  }

  function cerrar() { dialogo.current?.close(); onCerrar() }

  return <dialog ref={dialogo} aria-labelledby={titulo} onCancel={e => { e.preventDefault(); cerrar() }}
    onClick={e => { if (e.target === e.currentTarget) cerrar() }}
    className="m-auto w-full max-w-3xl overflow-visible border-0 bg-transparent p-4 text-text backdrop:bg-overlay/40">
    <Card className="max-w-none! rounded-3xl! border-0! flex max-h-[calc(100dvh-4rem)] min-w-0 flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titulo} className="text-lg font-semibold">Historial de precios</h2>
          <p className="mt-1 break-words text-sm text-muted">{producto.nombre}</p>
        </div>
        <Button variant="secundario" aria-label="Cerrar historial de precios" className="w-auto! shrink-0 rounded-full! px-3!" onClick={cerrar}><X className="size-4" aria-hidden="true" /></Button>
      </header>
      {cargando && <p role="status" className="text-sm text-muted">Cargando historial…</p>}
      {error && <Aviso tipo="error" accion={{ texto: 'Reintentar', onClick: () => setIntento(n => n + 1) }}>{error}</Aviso>}
      {datos && !error && !cargando && <>
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Precio a consultar">
          <Button variant={datos.historial.tipo === 'base' ? 'acento' : 'secundario'} className="w-auto! shrink-0 rounded-full!" role="tab" aria-selected={datos.historial.tipo === 'base'} onClick={() => elegirHistorial(null)}>Precio base</Button>
          {datos.variaciones.map(variacion => <Button key={variacion.idVariacion}
            variant={datos.historial.idVariacion === variacion.idVariacion ? 'acento' : 'secundario'}
            className="w-auto! shrink-0 rounded-full!" role="tab"
            aria-selected={datos.historial.idVariacion === variacion.idVariacion}
            onClick={() => elegirHistorial(variacion.idVariacion)}>
            {variacion.nombre} · {precio.format(variacion.precio)}{variacion.disponible ? '' : ' (inactiva)'}
          </Button>)}
        </div>
        <p className="text-sm">{datos.historial.nombre} actual: <strong>{precio.format(datos.historial.precioActual)}</strong></p>
        {datos.registros.length ? <div className="min-h-0 overflow-auto rounded-2xl border border-border" aria-busy={cargando}>
          <table className="w-full min-w-lg text-center text-sm">
            <caption className="sr-only">Cambios de {datos.historial.nombre.toLowerCase()} de {producto.nombre}</caption>
            <thead className="sticky top-0 bg-surface-muted text-muted"><tr>
              {['Fecha y hora', 'Precio anterior', 'Precio nuevo'].map(t => <th scope="col" key={t} className="px-4 py-3 text-center font-medium">{t}</th>)}
            </tr></thead>
            <tbody>{datos.registros.map(r => <tr key={r.idHistorial} className="border-t border-border">
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fecha.format(new Date(r.fechaCambio))}</td>
              <td className="px-4 py-3 tabular-nums">{r.precioAnterior === null ? 'Precio inicial' : precio.format(r.precioAnterior)}</td>
              <td className="px-4 py-3 tabular-nums">{precio.format(r.precioNuevo)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="text-sm text-muted">Todavía no hay cambios registrados para {datos.historial.tipo === 'base' ? 'el precio base' : `la variación ${datos.historial.nombre}`}. Los próximos cambios se guardarán automáticamente.</p>}
        <nav aria-label="Páginas del historial de precios" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{datos.totalRegistros} registros · Página {datos.pagina} de {datos.totalPaginas}</p>
          <div className="flex gap-2">
            <Button variant="secundario" className="w-auto! rounded-full!" aria-label="Página anterior de precios" disabled={cargando || datos.pagina <= 1} onClick={() => setPagina(datos.pagina - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
            <Button variant="secundario" className="w-auto! rounded-full!" aria-label="Página siguiente de precios" disabled={cargando || datos.pagina >= datos.totalPaginas} onClick={() => setPagina(datos.pagina + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
          </div>
        </nav>
      </>}
    </Card>
  </dialog>
}
