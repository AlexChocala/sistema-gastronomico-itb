'use client'

// Botón "Exportar e importar" de Productos y Usuarios: abre un modal con dos pestañas.
// - Exportar: cuántos registros salen y en qué formato (CSV para Excel, o CSV sin
//   encabezado / JSON para otro sistema; ver gruposDatosDelListado).
// - Importar: subir un CSV o JSON con las columnas esperadas. Si hay errores muestra la
//   lista completa por fila (no se guardó nada); si sale bien confirma con un aviso.
// Sin permiso para importar (supervisor) el botón dice "Exportar" y no hay pestañas.

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Download, FileUp, X } from '@/components/icons'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'
import { MENSAJES } from '@/lib/utils/mensajes'
import {
  descargarPlantillaCsv, gruposDatosDelListado, type DatosExportables,
} from '@/lib/utils/exportar'

type Entidad = 'productos' | 'usuarios'
type Pestana = 'exportar' | 'importar'
type ErrorFila = { fila: number; campo: string; mensaje: string }
type ErrorImportacion = { mensaje: string; filas: ErrorFila[] }

const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const claseBotonAcento =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

interface ExportarImportarProps {
  entidad: Entidad
  // Las mismas que se exportan: arman el CSV, el ejemplo y la lista de columnas esperadas.
  columnas: string[]
  // Sin extensión, ej. "productos_2026-10-04".
  nombreArchivo: string
  // Cuántos registros salen al exportar, y una aclaración opcional (ej. los filtros).
  cantidad: number
  aclaracionCantidad?: string
  obtenerDatos: () => Promise<DatosExportables> | DatosExportables
  puedeImportar: boolean
  onImportado: () => void
}

export function ExportarImportar({
  entidad, columnas, nombreArchivo, cantidad, aclaracionCantidad, obtenerDatos, puedeImportar, onImportado,
}: ExportarImportarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [pestana, setPestana] = useState<Pestana>('exportar')
  const [exito, setExito] = useState('')

  // Exportar
  const opciones = gruposDatosDelListado(nombreArchivo, columnas, obtenerDatos)
    .flatMap((grupo) => grupo.opciones.map((opcion) => ({ ...opcion, para: grupo.titulo })))
  const [formato, setFormato] = useState(opciones[0].texto)
  const [exportando, setExportando] = useState(false)
  const [errorExportar, setErrorExportar] = useState(false)

  // Importar
  const [archivo, setArchivo] = useState<File | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [errorImportar, setErrorImportar] = useState<ErrorImportacion | null>(null)

  const ocupado = exportando || importando
  // La columna ID se exporta pero no se importa: la base asigna los IDs nuevos.
  const columnasEsperadas = columnas.filter((columna) => columna !== 'ID')
  const titulo = puedeImportar ? `Exportar e importar ${entidad}` : `Exportar ${entidad}`

  // Escape cierra el modal, salvo mientras se exporta o importa.
  useEffect(() => {
    if (!abierto) return
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !ocupado) cerrar()
    }
    window.addEventListener('keydown', alPresionarTecla)
    return () => window.removeEventListener('keydown', alPresionarTecla)
  }, [abierto, ocupado])

  // Sin datos para exportar (un local que recién empieza), lo útil es importar.
  function abrir() {
    setExito('')
    setPestana(puedeImportar && cantidad === 0 ? 'importar' : 'exportar')
    setAbierto(true)
  }

  function cerrar() {
    setAbierto(false)
    setArchivo(null)
    setErrorImportar(null)
    setErrorExportar(false)
  }

  async function exportar() {
    const opcion = opciones.find((otra) => otra.texto === formato)
    if (!opcion) return
    setExportando(true)
    setErrorExportar(false)
    try {
      await opcion.generar()
      cerrar()
    } catch {
      setErrorExportar(true)
    } finally {
      setExportando(false)
    }
  }

  function elegirArchivo(seleccionado?: File) {
    if (inputRef.current) inputRef.current.value = ''
    if (seleccionado) setArchivo(seleccionado)
  }

  function soltarArchivo(evento: DragEvent<HTMLElement>) {
    evento.preventDefault()
    setArrastrando(false)
    elegirArchivo(evento.dataTransfer.files[0])
  }

  async function importar() {
    if (!archivo) return
    setImportando(true)
    try {
      const datos = new FormData()
      datos.append('archivo', archivo)
      const respuesta = await fetch(`/api/${entidad}/importar`, { method: 'POST', body: datos })
      const cuerpo = await respuesta.json() as { creados?: number; errores?: ErrorFila[]; error?: string }
      if (!respuesta.ok) {
        setErrorImportar({
          mensaje: cuerpo.error ?? 'Corregí estas filas en el archivo e importalo de nuevo.',
          filas: cuerpo.errores ?? [],
        })
        return
      }
      cerrar()
      setExito(`Se importaron ${cuerpo.creados ?? 0} ${entidad}.`)
      onImportado()
    } catch {
      setErrorImportar({ mensaje: 'No se pudo conectar con el sistema. Revisá tu conexión e intentá de nuevo.', filas: [] })
    } finally {
      setImportando(false)
    }
  }

  return (
    <>
      <button type="button" onClick={abrir} className={claseBotonSecundario}>
        <Download className="size-4" />
        {puedeImportar ? 'Exportar e importar' : 'Exportar'}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-exportar-importar"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-3xl bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="titulo-exportar-importar" className="text-lg">
                {errorImportar ? 'No se importó ningún registro' : titulo}
              </h2>
              <button type="button" onClick={cerrar} disabled={ocupado} aria-label="Cerrar"
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text disabled:cursor-not-allowed">
                <X className="size-4" />
              </button>
            </div>

            {puedeImportar && !errorImportar && (
              <div role="tablist" aria-label={titulo} className="grid grid-cols-2 border-b border-border">
                {(['exportar', 'importar'] as const).map((opcion) => (
                  <button key={opcion} type="button" role="tab" aria-selected={pestana === opcion}
                    onClick={() => setPestana(opcion)} disabled={ocupado}
                    className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${pestana === opcion ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'}`}>
                    {opcion === 'exportar' ? 'Exportar' : 'Importar'}
                  </button>
                ))}
              </div>
            )}

            {errorImportar ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-muted">{errorImportar.mensaje}</p>
                {errorImportar.filas.length > 0 && (
                  <div className="min-h-0 overflow-y-auto rounded-2xl border border-danger bg-danger-surface">
                    <p className="sticky top-0 border-b border-danger bg-danger-surface px-4 py-2 font-medium text-danger">
                      {errorImportar.filas.length === 1 ? '1 error' : `${errorImportar.filas.length} errores`}
                    </p>
                    <ul className="flex flex-col divide-y divide-danger/20">
                      {errorImportar.filas.map((fila, indice) => (
                        <li key={indice} className="flex gap-3 px-4 py-2">
                          <span className="shrink-0 font-medium tabular-nums text-danger">Fila {fila.fila}</span>
                          <span className="min-w-0"><span className="font-medium">{fila.campo}:</span> {fila.mensaje}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              // Los dos paneles comparten la misma celda de la grilla: el modal toma el alto
              // del más grande y no cambia de tamaño al pasar de una pestaña a otra. El que no
              // se ve queda `invisible` (no ocupa el foco ni lo leen los lectores de pantalla).
              <div className="grid">
              <div className={`col-start-1 row-start-1 flex flex-col gap-4 text-sm ${pestana === 'exportar' ? '' : 'invisible'}`}>
                <div>
                  <p className="text-muted">{entidad === 'productos' ? 'Productos' : 'Usuarios'} a exportar</p>
                  <p className="text-3xl font-semibold tabular-nums">{cantidad}</p>
                  {aclaracionCantidad && <p className="text-xs text-muted">{aclaracionCantidad}</p>}
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 font-medium">Formato</legend>
                  {opciones.map((opcion) => (
                    <label key={opcion.texto}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-border px-4 py-3 transition-colors hover:bg-bg has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
                      <span className="flex items-center gap-3">
                        <input type="radio" name={`formato-${entidad}`} className="sr-only" value={opcion.texto}
                          checked={formato === opcion.texto} onChange={() => setFormato(opcion.texto)} disabled={ocupado} />
                        <span className="font-medium">{opcion.texto}</span>
                      </span>
                      <span className="text-xs text-muted">{opcion.para}</span>
                    </label>
                  ))}
                </fieldset>
                {errorExportar && <p role="alert" className="text-xs text-danger">{MENSAJES.panel.errorGenerico}</p>}
              </div>
              {puedeImportar && (
              <div className={`col-start-1 row-start-1 flex flex-col gap-3 text-sm ${pestana === 'importar' ? '' : 'invisible'}`}>
                <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only"
                  id={`archivo-importar-${entidad}`} onChange={(evento) => elegirArchivo(evento.currentTarget.files?.[0])} />
                <label
                  htmlFor={`archivo-importar-${entidad}`}
                  onDragOver={(evento) => { evento.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={soltarArchivo}
                  className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent ${arrastrando ? 'border-accent bg-accent-soft' : 'border-border hover:bg-bg'}`}
                >
                  <FileUp className="size-6 text-muted" />
                  {archivo ? (
                    <>
                      <span className="font-medium break-all">{archivo.name}</span>
                      <span className="text-xs text-muted">Tocá para elegir otro</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Elegí un archivo o arrastralo acá</span>
                      <span className="text-xs text-muted">CSV o JSON</span>
                    </>
                  )}
                </label>
                {/* El backend solo lee estas columnas: sirve de referencia para quien arma el archivo. */}
                <p className="text-muted">
                  Columnas: {columnasEsperadas.join(' · ')}.{' '}
                  <button type="button" onClick={() => void descargarPlantillaCsv(`ejemplo_${entidad}.csv`, columnas)}
                    className="inline-flex cursor-pointer items-center gap-1 font-medium text-text underline underline-offset-2 hover:text-accent">
                    <Download className="size-3.5" />
                    Descargar ejemplo
                  </button>
                </p>
              </div>
              )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {errorImportar ? (
                <>
                  <button type="button" onClick={cerrar} className={claseBotonSecundario}>Cerrar</button>
                  <button type="button" onClick={() => { setErrorImportar(null); setArchivo(null) }} autoFocus className={claseBotonAcento}>
                    Elegir otro archivo
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={cerrar} disabled={ocupado} className={claseBotonSecundario}>Cancelar</button>
                  {pestana === 'exportar' ? (
                    <button type="button" onClick={() => void exportar()} disabled={cantidad === 0 || ocupado} className={claseBotonAcento}>
                      <Download className="size-4" />
                      {exportando ? 'Generando…' : 'Exportar'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => void importar()} disabled={!archivo || ocupado} className={claseBotonAcento}>
                      <FileUp className="size-4" />
                      {importando ? 'Importando…' : 'Importar'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {exito && <AvisoFlotante mensaje={exito} onCerrar={() => setExito('')} />}
    </>
  )
}
