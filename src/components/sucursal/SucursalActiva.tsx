'use client'

// Contexto con la sucursal activa (la resuelve el servidor con obtenerSucursalActiva) y
// las piezas visuales que la muestran: el selector de la barra superior y la pastilla de Caja/Cocina.

import { createContext, useContext, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { elegirSucursal } from '@/app/(panel)/acciones-sucursal'
import { Store } from '@/components/icons'
import { Desplegable } from '@/components/ui/Desplegable'
import type { SucursalActiva } from '@/lib/sucursales/sucursal-activa'

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

// Barra superior: empleado y supervisor ven su sucursal fija; el admin puede cambiarla y
// la elección vale para todo el panel (Dashboard, Pedidos, Productos, pantallas).
export function SelectorSucursal() {
  const { sucursal, puedeElegir, opciones } = useSucursalActiva()
  const router = useRouter()
  const [cambiando, iniciarCambio] = useTransition()

  // El ícono del local ya dice qué es: el título "Sucursal" queda solo para lectores de pantalla.
  if (!puedeElegir) {
    return (
      <div>
        <p className="sr-only">Sucursal</p>
        <PastillaSucursal className="w-full bg-bg shadow-none" />
      </div>
    )
  }

  return (
    <Desplegable
      etiqueta="Sucursal"
      icono={Store}
      opciones={opciones.map((opcion) => ({ valor: opcion.idSucursal, texto: opcion.nombre }))}
      valor={sucursal?.idSucursal ?? null}
      textoVacio="Sin sucursales activas"
      deshabilitado={opciones.length === 0}
      ocupado={cambiando}
      onElegir={(idSucursal) =>
        iniciarCambio(async () => {
          await elegirSucursal(idSucursal)
          router.refresh()
        })
      }
    />
  )
}
