'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/utils/precio'
import { recargoDeliveryValido, type CotizacionDelivery } from '@/lib/sucursales/radio-delivery'

// La clave evita usar el costo de una dirección anterior cuando se edita el formulario.
export function useCotizacionDelivery(direccion: string, idLocalidad: string, slug?: string) {
  const clave = JSON.stringify([slug ?? null, direccion.trim(), idLocalidad])
  const [resultado, setResultado] = useState<{ clave: string; cotizacion: CotizacionDelivery | null; error: string | null } | null>(null)
  const [consultando, setConsultando] = useState(false)
  const generacion = useRef(0)
  const vigente = resultado?.clave === clave ? resultado : null

  function invalidar() {
    generacion.current++
    setResultado(null)
    setConsultando(false)
  }

  async function calcular() {
    const actual = ++generacion.current
    setConsultando(true)
    setResultado(null)
    try {
      const respuesta = await fetch(slug ? '/api/pedidos/cotizacion-delivery' : '/api/pedidos/caja/cotizacion-delivery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ direccion: direccion.trim(), idLocalidad: idLocalidad ? Number(idLocalidad) : null, ...(slug ? { slugSucursal: slug } : {}) }),
      })
      const datos = await respuesta.json().catch(() => null)
      if (!respuesta.ok || !datos?.cotizacion || !recargoDeliveryValido(datos.cotizacion.recargoDelivery)) {
        throw new Error(datos?.error ?? 'No pudimos calcular el envío. Intentá nuevamente.')
      }
      if (generacion.current === actual) setResultado({ clave, cotizacion: datos.cotizacion, error: null })
    } catch (error) {
      if (generacion.current === actual) setResultado({ clave, cotizacion: null, error: error instanceof Error ? error.message : 'No pudimos calcular el envío.' })
    } finally {
      if (generacion.current === actual) setConsultando(false)
    }
  }

  return { cotizacion: vigente?.cotizacion ?? null, error: vigente?.error ?? null, consultando, calcular, invalidar }
}

export function CotizadorDelivery({ cotizador, disabled = false }: {
  cotizador: ReturnType<typeof useCotizacionDelivery>
  disabled?: boolean
}) {
  const { cotizacion, error, consultando } = cotizador
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-3">
      <Button type="button" variant="secundario" onClick={() => void cotizador.calcular()} disabled={disabled || consultando}>
        {consultando ? 'Calculando envío…' : cotizacion ? 'Volver a calcular envío' : 'Calcular envío'}
      </Button>
      <div aria-live="polite" className="text-sm">
        {error ? <p role="alert" className="text-danger">{error}</p> : cotizacion ? (
          <>
            <p>Distancia aproximada: {cotizacion.distanciaKm.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km en línea recta.</p>
            <p className="font-semibold">{cotizacion.fueraDelRadio ? 'Recargo fuera del radio' : 'Adicional de envío'}: {formatearPrecio(cotizacion.recargoDelivery)}</p>
          </>
        ) : <p className="text-muted">Completá la dirección y calculá el envío para conocer el adicional antes de confirmar.</p>}
      </div>
    </div>
  )
}
