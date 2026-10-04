'use client'

import { useRef, useState } from 'react'
import { Plus } from '@/components/icons'

type Entidad = 'productos' | 'usuarios'
type ErrorFila = { fila: number; campo: string; mensaje: string }

export function BotonImportar({ entidad, onImportado }: { entidad: Entidad; onImportado: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState('')
  const [errores, setErrores] = useState<ErrorFila[]>([])
  const filasDuplicadas = new Set(errores
    .filter((error) => error.campo === 'Nombre' && error.mensaje.toLocaleLowerCase('es-AR').includes('ya existe un producto'))
    .map((error) => error.fila))
  const erroresDuplicados = errores.filter((error) => error.campo === 'Nombre' && error.mensaje.toLocaleLowerCase('es-AR').includes('ya existe un producto'))
  const otrosErrores = errores.filter((error) => !erroresDuplicados.includes(error))

  async function importar(archivo?: File) {
    if (!archivo) return
    setCargando(true)
    setResultado('')
    setErrores([])
    try {
      const datos = new FormData()
      datos.append('archivo', archivo)
      const respuesta = await fetch(`/api/${entidad}/importar`, { method: 'POST', body: datos })
      const cuerpo = await respuesta.json() as { creados?: number; errores?: ErrorFila[]; error?: string }
      if (!respuesta.ok) {
        setErrores(cuerpo.errores ?? [])
        setResultado(cuerpo.error ?? (cuerpo.errores?.length ? 'No se importó ningún registro. Corregí los errores e intentá nuevamente.' : 'No se pudo importar el archivo.'))
        return
      }
      setResultado(`Se importaron ${cuerpo.creados ?? 0} ${entidad === 'productos' ? 'productos' : 'usuarios'}.`)
      onImportado()
    } catch {
      setResultado('No se pudo conectar con el sistema. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setCargando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only"
        aria-label={`Seleccionar archivo para importar ${entidad}`} disabled={cargando}
        onChange={(evento) => void importar(evento.currentTarget.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={cargando}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50">
        <Plus className="size-4" />
        {cargando ? 'Importando…' : 'Importar'}
      </button>
      {resultado && <div role="status" aria-live="polite"
        className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-surface p-4 text-sm shadow-lg ${errores.length ? 'border-danger text-danger' : 'border-border text-text'}`}>
        {filasDuplicadas.size > 0 ? <p>Hay productos repetidos en {filasDuplicadas.size} {filasDuplicadas.size === 1 ? 'fila' : 'filas'}. No se importó ningún registro.</p>
          : <p>{resultado}</p>}
        {otrosErrores.length > 0 && <div className="mt-1">
          <p>{otrosErrores.length === 1 ? 'Además, otra fila tiene un problema:' : `Además, ${otrosErrores.length} filas tienen otros problemas:`}</p>
          <p>Fila {otrosErrores[0].fila}, {otrosErrores[0].campo}: {otrosErrores[0].mensaje}</p>
        </div>}
      </div>}
    </div>
  )
}
