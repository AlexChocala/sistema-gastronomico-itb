'use client'

// Contexto con la sucursal activa (la resuelve el servidor con obtenerSucursalActiva) y
// las piezas visuales que la muestran: el selector del sidebar y la pastilla de Caja/Cocina.

import { createContext, useContext, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { elegirSucursal } from '@/app/(panel)/acciones-sucursal'
import { ChevronDown, Store } from '@/components/icons'
import type { SucursalActiva } from '@/lib/sucursal-activa'

const ContextoSucursal = createContext<SucursalActiva | null>(null)

export function SucursalActivaProvider({ valor, children }: { valor: SucursalActiva; children: ReactNode }) {
  return <ContextoSucursal.Provider value={valor}>{children}</ContextoSucursal.Provider>
}

export function useSucursalActiva(): SucursalActiva {
  const valor = useContext(ContextoSucursal)
  if (!valor) throw new Error('useSucursalActiva necesita un SucursalActivaProvider')
  return valor
}

const clasePastilla =
  'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-text shadow-sm'

// Pastilla de solo lectura: "🏪 Quilmes". Caja y Cocina la muestran junto al título.
export function PastillaSucursal({ className = '' }: { className?: string }) {
  const { sucursal } = useSucursalActiva()
  return (
    <span className={`${clasePastilla} ${className}`} title="Sucursal en la que estás trabajando">
      <Store className="size-4 shrink-0 text-accent" />
      <span className="truncate">{sucursal?.nombre ?? 'Sin sucursal asignada'}</span>
    </span>
  )
}

// Sidebar: empleado y supervisor ven su sucursal fija; el admin puede cambiarla y la
// elección vale para todo el panel (Dashboard, Pedidos, Productos, pantallas).
export function SelectorSucursal() {
  const { sucursal, puedeElegir, opciones } = useSucursalActiva()
  const router = useRouter()
  const [cambiando, iniciarCambio] = useTransition()

  if (!puedeElegir) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="section-label px-4">Sucursal</p>
        <PastillaSucursal className="w-full bg-bg shadow-none" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="selector-sucursal" className="section-label px-4">
        Sucursal
      </label>
      <div className="relative">
        <Store className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-accent" />
        <select
          id="selector-sucursal"
          value={sucursal?.idSucursal ?? ''}
          disabled={cambiando || opciones.length === 0}
          onChange={(evento) => {
            const idSucursal = Number(evento.target.value)
            iniciarCambio(async () => {
              await elegirSucursal(idSucursal)
              router.refresh()
            })
          }}
          className="w-full cursor-pointer appearance-none truncate rounded-full border border-border bg-surface py-2 pr-10 pl-11 text-sm outline-none transition-colors hover:bg-bg focus:border-accent disabled:cursor-wait disabled:opacity-60"
        >
          {opciones.length === 0 && <option value="">Sin sucursales activas</option>}
          {opciones.map((opcion) => (
            <option key={opcion.idSucursal} value={opcion.idSucursal}>
              {opcion.nombre}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  )
}
