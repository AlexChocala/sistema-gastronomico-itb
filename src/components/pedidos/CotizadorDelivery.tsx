'use client'

import { useRef, useState } from 'react'
import { recargoDeliveryValido, type CotizacionDelivery } from '@/lib/sucursales/radio-delivery'

// La clave evita usar el costo de una dirección anterior cuando se edita el formulario.
export function useCotizacionDelivery(direccion: string, slug?: string) {
  const clave = (texto: string) => JSON.stringify([slug ?? null, texto.trim()])
  const [resultado, setResultado] = useState<{ clave: string; cotizacion: CotizacionDelivery | null; error: string | null } | null>(null)
  const [consultando, setConsultando] = useState(false)
  const generacion = useRef(0)
  const vigente = resultado?.clave === clave(direccion) ? resultado : null
  // Ubicación firmada de la última sugerencia elegida; vale solo mientras no se edite el texto.
  const [elegida, setElegida] = useState<{ direccion: string; ubicacion: string } | null>(null)
  const ubicacion = elegida && elegida.direccion.trim() === direccion.trim() ? elegida.ubicacion : null

  function invalidar() {
    generacion.current++
    setResultado(null)
    setConsultando(false)
  }

  // Se llama con la dirección recién elegida: el estado todavía no se actualizó.
  async function calcular(direccionElegida = direccion, ubicacionElegida: string | null = direccionElegida === direccion ? ubicacion : null) {
    const actual = ++generacion.current
    const claveActual = clave(direccionElegida)
    setElegida(ubicacionElegida ? { direccion: direccionElegida, ubicacion: ubicacionElegida } : null)
    setConsultando(true)
    setResultado(null)
    try {
      const respuesta = await fetch(slug ? '/api/pedidos/cotizacion-delivery' : '/api/pedidos/caja/cotizacion-delivery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({
          direccion: direccionElegida.trim(),
          ...(ubicacionElegida ? { ubicacion: ubicacionElegida } : {}),
          ...(slug ? { slugSucursal: slug } : {}),
        }),
      })
      const datos = await respuesta.json().catch(() => null)
      if (!respuesta.ok || !datos?.cotizacion || !recargoDeliveryValido(datos.cotizacion.recargoDelivery)) {
        throw new Error(datos?.error ?? 'No pudimos calcular el envío. Intentá nuevamente.')
      }
      if (generacion.current === actual) setResultado({ clave: claveActual, cotizacion: datos.cotizacion, error: null })
    } catch (error) {
      if (generacion.current === actual) setResultado({ clave: claveActual, cotizacion: null, error: error instanceof Error ? error.message : 'No pudimos calcular el envío.' })
    } finally {
      if (generacion.current === actual) setConsultando(false)
    }
  }

  return { cotizacion: vigente?.cotizacion ?? null, error: vigente?.error ?? null, consultando, ubicacion, calcular, invalidar }
}

// El costo aparece solo al elegir una dirección de la lista. "Calcular envío" queda como
// respaldo por si las sugerencias no cargan y la dirección se escribe completa a mano.
export function CotizadorDelivery({ cotizador, disabled = false }: {
  cotizador: ReturnType<typeof useCotizacionDelivery>
  disabled?: boolean
}) {
  const { cotizacion, error, consultando } = cotizador
  // Sin dirección escrita todavía no hay nada que mostrar.
  if (!consultando && !error && !cotizacion && disabled) return null
  return (
    <div aria-live="polite" className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3 text-sm">
      {consultando ? <p className="text-muted">Calculando envío…</p>
        : error ? <p role="alert" className="text-danger">{error}</p>
        // El precio ya se ve en la lista de localidades y en el total: acá solo se confirma.
        : cotizacion ? <p className="font-semibold text-success">✓ Llegamos a tu dirección</p>
        : <p className="text-muted">Elegí tu dirección de la lista.</p>}
      {!consultando && !cotizacion && (
        <button type="button" onClick={() => void cotizador.calcular()} disabled={disabled}
          className="shrink-0 text-sm font-medium text-accent underline disabled:opacity-50">
          {error ? 'Reintentar' : 'Calcular envío'}
        </button>
      )}
    </div>
  )
}
