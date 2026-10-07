'use client'

// Botón "Exportar" con un menú de descargas agrupadas por para qué sirve el archivo. Lo usa
// Reportes (ver ExportarReporte); Productos y Usuarios usan el modal ExportarImportar.
// Mientras se arma un archivo la opción muestra "Generando…"; si falla, queda en "Reintentar"
// con el menú abierto. Se maneja con teclado: flechas, Inicio/Fin y Escape.

import { useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Download } from '@/components/icons'
import { MENSAJES } from '@/lib/utils/mensajes'
import { useCerrarAlSalir } from '@/lib/utils/useCerrarAlSalir'
import type { GrupoExportar, OpcionExportar } from '@/lib/utils/exportar'

// 'chico': junto a pestañas y tablas. 'normal': mismo alto que los botones de un encabezado.
type TamanoMenuExportar = 'chico' | 'normal'
type EstadoOpcion = 'generando' | 'error'

interface MenuExportarProps {
  grupos: GrupoExportar[]
  deshabilitado?: boolean
  tamano?: TamanoMenuExportar
}

export function MenuExportar({ grupos, deshabilitado = false, tamano = 'chico' }: MenuExportarProps) {
  const [abierto, setAbierto] = useState(false)
  // Clave "grupo-opción" → estado; las que no están, están listas.
  const [estados, setEstados] = useState<Record<string, EstadoOpcion>>({})
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useCerrarAlSalir(abierto, setAbierto, contenedor, boton)

  const generando = Object.values(estados).includes('generando')

  function opcionesDelMenu() {
    return Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
  }

  function abrir() {
    setAbierto(true)
    // El foco pasa a la primera opción cuando el menú ya está en pantalla.
    requestAnimationFrame(() => opcionesDelMenu()[0]?.focus())
  }

  async function elegir(clave: string, opcion: OpcionExportar) {
    setEstados((actuales) => ({ ...actuales, [clave]: 'generando' }))
    try {
      await opcion.generar()
      setEstados((actuales) => {
        const resto = { ...actuales }
        delete resto[clave]
        return resto
      })
      setAbierto(false)
      boton.current?.focus()
    } catch {
      setEstados((actuales) => ({ ...actuales, [clave]: 'error' }))
    }
  }

  function moverFoco(evento: KeyboardEvent<HTMLDivElement>) {
    const opciones = opcionesDelMenu()
    const actual = opciones.indexOf(document.activeElement as HTMLButtonElement)
    const destinos: Record<string, number> = {
      ArrowDown: (actual + 1) % opciones.length,
      ArrowUp: (actual - 1 + opciones.length) % opciones.length,
      Home: 0,
      End: opciones.length - 1,
    }
    if (!(evento.key in destinos)) return
    evento.preventDefault()
    opciones[destinos[evento.key]]?.focus()
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowDown' && !abierto) {
            evento.preventDefault()
            abrir()
          }
        }}
        disabled={deshabilitado}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${tamano === 'chico' ? 'py-1.5' : 'py-2.5'}`}
      >
        <Download aria-hidden className="size-4" />
        {generando ? 'Generando…' : 'Exportar'}
        <ChevronDown aria-hidden className={`size-4 text-muted transition-transform motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div
          ref={menu}
          role="menu"
          aria-label="Exportar"
          onKeyDown={moverFoco}
          className="absolute top-full right-0 z-40 mt-2 flex w-64 flex-col gap-1 rounded-2xl border border-border bg-surface p-2 text-sm text-text shadow-xl"
        >
          {grupos.map((grupo, indiceGrupo) => (
            <div key={grupo.titulo} role="group" aria-labelledby={`grupo-exportar-${indiceGrupo}`}
              className={indiceGrupo > 0 ? 'border-t border-border pt-1' : ''}>
              <p id={`grupo-exportar-${indiceGrupo}`} className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
                {grupo.titulo}
              </p>
              {grupo.opciones.map((opcion, indiceOpcion) => {
                const clave = `${indiceGrupo}-${indiceOpcion}`
                const estado = estados[clave]
                return (
                  <button
                    key={opcion.texto}
                    type="button"
                    role="menuitem"
                    onClick={() => void elegir(clave, opcion)}
                    disabled={estado === 'generando'}
                    title={estado === 'error' ? MENSAJES.panel.errorGenerico : undefined}
                    className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left font-medium transition-colors hover:bg-bg focus-visible:bg-bg focus-visible:outline-none disabled:cursor-wait ${estado === 'error' ? 'text-danger' : ''}`}
                  >
                    {estado === 'generando' ? 'Generando…' : estado === 'error' ? `Reintentar ${opcion.texto}` : opcion.texto}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
