'use client'

// Campo de dirección del delivery (menú digital, Caja y Pedidos). Mientras se escribe
// "calle y número" muestra direcciones cercanas al local (Georef) y, al elegir una, avisa
// con onElegir para calcular el envío sin apretar ningún botón.

import { CampoConSugerencias, type OpcionSugerida } from '@/components/ui/CampoConSugerencias'

const claseCampo =
  'w-full min-h-12 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-accent aria-invalid:border-danger'

export function CampoDireccionDelivery({ id, slug, valor, error, maxLength, onCambiar, onElegir }: {
  id: string
  // Con slug busca desde el menú público; sin slug, con la sesión de Caja.
  slug?: string
  valor: string
  error?: string
  maxLength: number
  onCambiar: (texto: string) => void
  onElegir: (direccion: string) => void
}) {
  async function buscar(texto: string, signal: AbortSignal): Promise<OpcionSugerida[]> {
    const respuesta = await fetch(slug ? '/api/pedidos/sugerencias-direccion' : '/api/pedidos/caja/sugerencias-direccion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal,
      body: JSON.stringify({ texto, ...(slug ? { slugSucursal: slug } : {}) }),
    })
    const datos = await respuesta.json().catch(() => null)
    if (!respuesta.ok || !Array.isArray(datos?.sugerencias)) throw new Error('Sin sugerencias')
    return (datos.sugerencias as { direccion: string }[]).map((s) => ({ clave: s.direccion, texto: s.direccion }))
  }

  return (
    <div className="flex flex-col gap-1" data-campo="direccion">
      <label htmlFor={id} className="text-sm font-medium text-text">Dirección de entrega</label>
      <CampoConSugerencias
        id={id}
        valor={valor}
        onCambiar={onCambiar}
        buscar={buscar}
        onElegir={(opcion) => { onCambiar(opcion.texto); onElegir(opcion.texto) }}
        textoSinResultados="No encontramos esa dirección cerca del local. Revisá la calle y el número."
        placeholder="Calle y número. Ej: Mitre 750"
        maxLength={maxLength}
        className={claseCampo}
      />
      {error
        ? <span className="text-sm text-danger">{error}</span>
        : <span className="text-xs text-muted">Escribí calle y número y elegí tu dirección de la lista.</span>}
    </div>
  )
}
