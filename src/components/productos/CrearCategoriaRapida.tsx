'use client'

// Crear una categoría sin salir del formulario de producto. Cerrada es un chip "Nueva
// categoría" al lado de las demás; abierta pide el nombre y ofrece las sugeridas, que ya
// traen sus variaciones (Pizzas → Entera / Media). Mientras está abierta el formulario
// bloquea el resto: recién al crearla queda elegida y aparecen sus variaciones.
// Editar, ordenar o desactivar sigue en la pantalla Categorías.
// Va dentro de un <form>: Enter crea la categoría, no el producto.

import { useState } from 'react'
import { Plus } from '@/components/icons'
import { crearCategoriaAlFinal, type CategoriaCreada } from '@/lib/productos/categorias-api'
import { CATEGORIAS_SUGERIDAS } from '@/lib/productos/sugerencias-categorias'

interface CrearCategoriaRapidaProps {
  // Las que ya existen: no se ofrecen otra vez como sugeridas.
  nombresExistentes: string[]
  onCreada: (categoria: CategoriaCreada) => void
  // Abierta la controla el formulario: mientras está abierta, bloquea el resto de los
  // campos (todavía no hay categoría elegida para cargar precio ni extras).
  abierta: boolean
  onAbrir: () => void
  onCerrar: () => void
  // Sin categorías no hay nada que elegir: no se puede cancelar y lleva un texto de bienvenida.
  sinCategorias: boolean
  deshabilitado?: boolean
}

export function CrearCategoriaRapida({
  nombresExistentes, onCreada, abierta, onAbrir, onCerrar, sinCategorias, deshabilitado = false,
}: CrearCategoriaRapidaProps) {
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  const existentes = nombresExistentes.map((existente) => existente.toLowerCase())
  const sugeridas = CATEGORIAS_SUGERIDAS.filter((sugerida) => !existentes.includes(sugerida.nombre.toLowerCase()))
  // Si el nombre coincide con una sugerida, se crea con sus variaciones.
  const sugeridaElegida = sugeridas.find((sugerida) => sugerida.nombre.toLowerCase() === nombre.trim().toLowerCase())

  function cerrar() {
    setNombre('')
    setError('')
    onCerrar()
  }

  async function crear() {
    if (!nombre.trim() || creando) return
    setCreando(true)
    setError('')
    try {
      const categoria = await crearCategoriaAlFinal(nombre, sugeridaElegida?.nombresVariaciones ?? [])
      setNombre('')
      onCreada(categoria)
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : 'No se pudo crear la categoría.')
    } finally {
      setCreando(false)
    }
  }

  if (!abierta) {
    return (
      <button type="button" onClick={onAbrir} disabled={deshabilitado}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-dashed border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
        <Plus className="size-4" />
        Nueva categoría
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border-2 border-accent bg-accent-soft/40 p-4 text-sm">
      <p>
        <span className="font-medium">{sinCategorias ? 'Primero creá una categoría' : 'Nueva categoría'}</span>{' '}
        <span className="text-muted">
          {sinCategorias
            ? 'para ordenar tu carta: Hamburguesas, Pizzas, Bebidas…'
            : '· Creala para seguir cargando el producto.'}
        </span>
      </p>
      <div className="flex gap-2">
        <input
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key !== 'Enter') return
            evento.preventDefault()
            void crear()
          }}
          placeholder="Nombre de la categoría"
          aria-label="Nombre de la nueva categoría"
          maxLength={80}
          autoFocus
          disabled={creando}
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="button" onClick={() => void crear()} disabled={!nombre.trim() || creando}
          className="shrink-0 cursor-pointer rounded-full bg-accent px-4 py-2 font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted">
          {creando ? 'Creando…' : 'Crear'}
        </button>
      </div>

      {sugeridas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Sugeridas:</span>
          {sugeridas.map((sugerida) => (
            <button key={sugerida.nombre} type="button" onClick={() => setNombre(sugerida.nombre)} disabled={creando}
              aria-pressed={sugeridaElegida?.nombre === sugerida.nombre}
              className="cursor-pointer rounded-full bg-surface px-2.5 py-1 text-xs transition-colors hover:text-accent aria-pressed:bg-accent-soft aria-pressed:text-text">
              {sugerida.nombre}
            </button>
          ))}
        </div>
      )}

      {sugeridaElegida && sugeridaElegida.nombresVariaciones.length > 0 && (
        <p className="text-xs text-muted">Viene con las variaciones {sugeridaElegida.nombresVariaciones.join(' · ')}.</p>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Después podés editarla en Categorías.</p>
        {!sinCategorias && (
          <button type="button" onClick={cerrar} disabled={creando}
            className="cursor-pointer text-xs font-medium text-muted underline underline-offset-2 hover:text-text">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
