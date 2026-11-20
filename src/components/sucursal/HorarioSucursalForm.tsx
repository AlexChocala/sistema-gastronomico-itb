'use client'

// Horario de pedidos online dentro del formulario de la sucursal. Se carga por bloques:
// los días (chips) y "abre a cierra". Un local de corrido usa un bloque; con turno partido,
// dos bloques con los mismos días. El texto que ve el cliente en la carta se arma solo.
// Sin ningún horario cargado, la sucursal acepta pedidos siempre.

import { useState } from 'react'
import { Plus, Trash2 } from '@/components/icons'
import {
  DIAS_CORTOS, ORDEN_DIAS, bloqueVacio, bloquesAFranjas, franjasABloques, textoHorario, type Bloque,
} from '@/lib/sucursales/horario-bloques'
import type { Franja } from '@/lib/sucursales/horario-online'

export type EstadoHorario = { bloques: Bloque[]; pausa: boolean; tocado: boolean }

// Estado del editor, para quien lo usa (la página guarda al enviar el formulario).
export function useHorarioForm() {
  const [estado, setEstado] = useState<EstadoHorario>({ bloques: [bloqueVacio()], pausa: false, tocado: false })

  function reiniciar() {
    setEstado({ bloques: [bloqueVacio()], pausa: false, tocado: false })
  }

  // Trae el horario guardado de una sucursal (al editarla).
  function cargar(idSucursal: number) {
    reiniciar()
    fetch(`/api/sucursales/${idSucursal}/horario-online`, { cache: 'no-store' })
      .then(async (respuesta) => {
        const datos = await respuesta.json()
        if (!respuesta.ok) return
        const bloques = franjasABloques(datos.horarios as Franja[])
        setEstado({ bloques: bloques.length > 0 ? bloques : [bloqueVacio()], pausa: datos.pausaPedidosOnline, tocado: false })
      })
      .catch(() => { /* queda vacío: se puede cargar de nuevo */ })
  }

  return { estado, setEstado, reiniciar, cargar }
}

// Lo que se manda al servidor al guardar, o el error si hay algo mal cargado.
export function horarioParaGuardar(estado: EstadoHorario): { franjas: Franja[]; pausa: boolean } | { error: string } {
  const resultado = bloquesAFranjas(estado.bloques)
  return 'error' in resultado ? resultado : { franjas: resultado.franjas, pausa: estado.pausa }
}

const claseHora = 'w-28 rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent'

// Interruptor (en vez de una casilla): se entiende de un vistazo si está encendido.
function Interruptor({ activo, onCambiar, etiqueta }: { activo: boolean; onCambiar: (activo: boolean) => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambiar(!activo)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${activo ? 'bg-brand' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow transition-transform motion-reduce:transition-none ${activo ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function HorarioSucursalForm({ estado, onCambiar }: { estado: EstadoHorario; onCambiar: (estado: EstadoHorario) => void }) {
  const cambiar = (siguiente: Partial<EstadoHorario>) => onCambiar({ ...estado, ...siguiente, tocado: true })
  const cambiarBloque = (indice: number, cambio: Partial<Bloque>) =>
    cambiar({ bloques: estado.bloques.map((b, i) => (i === indice ? { ...b, ...cambio } : b)) })

  const resultado = bloquesAFranjas(estado.bloques)
  const texto = 'franjas' in resultado ? textoHorario(resultado.franjas) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {estado.bloques.map((bloque, indice) => {
          const alDiaSiguiente = bloque.abre !== '' && bloque.cierra !== '' && bloque.cierra <= bloque.abre
          return (
            <fieldset key={indice} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-bg p-3">
              <legend className="sr-only">Horario {indice + 1}</legend>
              <div className="flex gap-1" role="group" aria-label="Días">
                {ORDEN_DIAS.map((dia) => {
                  const activo = bloque.dias.includes(dia)
                  return (
                    <button
                      key={dia}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => cambiarBloque(indice, { dias: activo ? bloque.dias.filter((d) => d !== dia) : [...bloque.dias, dia] })}
                      className={`size-9 cursor-pointer rounded-full text-xs font-medium transition-colors ${activo ? 'bg-brand text-on-brand' : 'bg-surface text-muted hover:text-text'}`}
                    >
                      {DIAS_CORTOS[dia]}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">De</span>
                <input type="time" aria-label="Abre" value={bloque.abre} onChange={(e) => cambiarBloque(indice, { abre: e.target.value })} className={claseHora} />
                <span className="text-muted">a</span>
                <input type="time" aria-label="Cierra" value={bloque.cierra} onChange={(e) => cambiarBloque(indice, { cierra: e.target.value })} className={claseHora} />
                {alDiaSiguiente && <span className="text-xs text-muted">(al día siguiente)</span>}
              </div>
              {estado.bloques.length > 1 && (
                <button
                  type="button"
                  onClick={() => cambiar({ bloques: estado.bloques.filter((_, i) => i !== indice) })}
                  aria-label={`Quitar el horario ${indice + 1}`}
                  className="ml-auto cursor-pointer rounded-full p-2 text-muted hover:bg-surface hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </fieldset>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => cambiar({ bloques: [...estado.bloques, { dias: [1, 2, 3, 4, 5, 6], abre: '', cierra: '' }] })}
        className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent-soft"
      >
        <Plus className="size-4" />
        Agregar otro horario (turno partido)
      </button>

      <p className="text-sm text-muted">
        {texto
          ? `En la carta se ve: ${texto}. Los pedidos online se aceptan solo en este horario.`
          : 'Sin horario cargado no se muestra en la carta y los pedidos online se aceptan siempre.'}
      </p>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span>Pausar pedidos online ahora</span>
        <Interruptor activo={estado.pausa} onCambiar={(pausa) => cambiar({ pausa })} etiqueta="Pausar pedidos online" />
      </div>
    </div>
  )
}
