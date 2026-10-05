'use client'

// Crear un extra de la categoría elegida sin salir del formulario de producto. Cerrado es
// un chip "Nuevo extra" al lado de los demás; abierto pide nombre y precio. El extra queda
// guardado en la categoría (aparece en sus próximos productos) y tildado en este. Editarlo
// o desactivarlo sigue en Productos → Extras. Va dentro de un <form>: Enter crea el extra.

import { useState, type KeyboardEvent } from 'react'
import { Plus } from '@/components/icons'
import { crearExtra } from '@/lib/productos/extras-api'
import type { ExtraDisponible } from '@/lib/productos/extras-tipos'

interface CrearExtraRapidoProps {
  idCategoria: number
  nombreCategoria: string
  onCreado: (extra: ExtraDisponible) => void
  deshabilitado?: boolean
}

export function CrearExtraRapido({ idCategoria, nombreCategoria, onCreado, deshabilitado = false }: CrearExtraRapidoProps) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  // Precio vacío = sin cargo (0), igual que en la pantalla de Extras.
  const precioAdicional = precio === '' ? 0 : Number(precio)
  const valido = nombre.trim() !== '' && Number.isFinite(precioAdicional) && precioAdicional >= 0

  function cerrar() {
    setAbierto(false)
    setNombre('')
    setPrecio('')
    setError('')
  }

  async function crear() {
    if (!valido || creando) return
    setCreando(true)
    setError('')
    try {
      // idProductos vacío: el producto todavía no existe; queda asignado al guardarlo.
      const extra = await crearExtra({ idCategoria, nombre: nombre.trim(), precioAdicional, idProductos: [] })
      onCreado({ idExtra: extra.idExtra, idCategoria: extra.idCategoria, nombre: extra.nombre, precioAdicional: extra.precioAdicional })
      cerrar()
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo crear el extra.')
    } finally {
      setCreando(false)
    }
  }

  function crearConEnter(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    void crear()
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} disabled={deshabilitado}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-dashed border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
        <Plus className="size-4" />
        Nuevo extra
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-bg p-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <input
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          onKeyDown={crearConEnter}
          placeholder="Nombre (ej: Cheddar)"
          aria-label="Nombre del nuevo extra"
          maxLength={80}
          autoFocus
          disabled={creando}
          className="min-w-0 flex-1 basis-40 rounded-full border border-border bg-surface px-4 py-2 outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="relative w-32">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">+$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={precio}
            onChange={(evento) => setPrecio(evento.target.value)}
            onKeyDown={crearConEnter}
            placeholder="0"
            aria-label="Precio adicional del extra (vacío = sin cargo)"
            disabled={creando}
            className="w-full rounded-full border border-border bg-surface py-2 pr-3 pl-9 outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button type="button" onClick={() => void crear()} disabled={!valido || creando}
          className="shrink-0 cursor-pointer rounded-full bg-accent px-4 py-2 font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted">
          {creando ? 'Creando…' : 'Crear'}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Queda para todos los productos de {nombreCategoria}. Sin precio = sin cargo.</p>
        <button type="button" onClick={cerrar} disabled={creando}
          className="shrink-0 cursor-pointer text-xs font-medium text-muted underline underline-offset-2 hover:text-text">
          Cancelar
        </button>
      </div>
    </div>
  )
}
