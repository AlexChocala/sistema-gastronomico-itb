'use client'

// Dirección de un delivery (menú digital, Caja y "Pasar a delivery"). Primero se elige la
// localidad entre las que tiene el local (con su costo a la vista) y después la dirección:
// las sugerencias son solo de esa localidad. Al elegir una, onElegir recibe también su
// ubicación firmada, así el servidor no vuelve a buscar ese texto para cotizar.

import { useEffect, useState } from 'react'
import { MapPin } from '@/components/icons'
import { CampoConSugerencias, type OpcionSugerida } from '@/components/ui/CampoConSugerencias'
import { Desplegable } from '@/components/ui/Desplegable'
import { claveLugar, type ZonaDelivery } from '@/lib/sucursales/radio-delivery'
import { formatearPrecio } from '@/lib/utils/precio'

const claseCampo =
  'w-full min-h-12 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-accent aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60'

type OpcionDireccion = OpcionSugerida & { direccion: string; ubicacion?: string }

export function CampoDireccionDelivery({ id, slug, valor, error, maxLength, onCambiar, onElegir }: {
  id: string
  // Con slug consulta el menú público; sin slug, con la sesión de Caja.
  slug?: string
  valor: string
  error?: string
  maxLength: number
  onCambiar: (texto: string) => void
  onElegir: (direccion: string, ubicacion: string | null) => void
}) {
  const [zonas, setZonas] = useState<ZonaDelivery[] | null>(null)
  const [errorZonas, setErrorZonas] = useState('')
  const [claveZona, setClaveZona] = useState<string | null>(null)
  const zona = zonas?.find((z) => claveLugar(z.nombre, z.provincia) === claveZona) ?? null

  useEffect(() => {
    const controlador = new AbortController()
    fetch(slug ? '/api/pedidos/zonas-delivery' : '/api/pedidos/caja/zonas-delivery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controlador.signal,
      body: JSON.stringify(slug ? { slugSucursal: slug } : {}),
    })
      .then(async (respuesta) => {
        const datos = await respuesta.json().catch(() => null)
        if (!respuesta.ok || !Array.isArray(datos?.zonas)) throw new Error(datos?.error ?? 'No pudimos cargar las localidades de delivery.')
        setZonas(datos.zonas as ZonaDelivery[])
      })
      .catch((e) => {
        if (!controlador.signal.aborted) setErrorZonas(e instanceof Error ? e.message : 'No pudimos cargar las localidades de delivery.')
      })
    return () => controlador.abort()
  }, [slug])

  async function buscar(texto: string, signal: AbortSignal): Promise<OpcionDireccion[]> {
    if (!zona) return []
    const respuesta = await fetch(slug ? '/api/pedidos/sugerencias-direccion' : '/api/pedidos/caja/sugerencias-direccion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal,
      body: JSON.stringify({ texto, localidad: { nombre: zona.nombre, provincia: zona.provincia }, ...(slug ? { slugSucursal: slug } : {}) }),
    })
    const datos = await respuesta.json().catch(() => null)
    if (!respuesta.ok || !Array.isArray(datos?.sugerencias)) throw new Error('Sin sugerencias')
    // Se muestra solo "calle y número": la localidad ya está elegida arriba.
    return (datos.sugerencias as { direccion: string; ubicacion?: string }[]).map((s) => ({
      clave: s.direccion, texto: s.direccion.split(',')[0], direccion: s.direccion, ubicacion: s.ubicacion,
    }))
  }

  // Con la localidad elegida, el texto viaja completo ("Calle 123, Localidad, Provincia"),
  // así "Calcular envío" funciona aunque no se elija una sugerencia.
  function cambiarTexto(texto: string) {
    onCambiar(zona && texto.trim() ? `${texto}, ${zona.nombre}, ${zona.provincia}` : texto)
  }

  function elegirZona(clave: string) {
    if (clave === claveZona) return
    setClaveZona(clave)
    // La dirección escrita era de otra localidad.
    onCambiar('')
  }

  if (zonas !== null && zonas.length === 0) {
    return <p className="text-sm text-muted">Este local todavía no configuró a qué localidades hace delivery. Podés elegir retiro en el local.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">¿En qué localidad estás?</span>
        {errorZonas ? <span className="text-sm text-danger">{errorZonas}</span> : (
          <Desplegable
            etiqueta="Localidad de entrega"
            icono={MapPin}
            opciones={(zonas ?? []).map((z) => ({
              valor: claveLugar(z.nombre, z.provincia),
              texto: `${z.nombre} · ${z.costo === 0 ? 'envío gratis' : formatearPrecio(z.costo)}`,
            }))}
            valor={claveZona}
            onElegir={elegirZona}
            textoVacio={zonas === null ? 'Cargando localidades…' : 'Elegí tu localidad'}
            deshabilitado={zonas === null}
          />
        )}
      </div>
      <div className="flex flex-col gap-1" data-campo="direccion">
        <label htmlFor={id} className="text-sm font-medium text-text">Dirección de entrega</label>
        <CampoConSugerencias<OpcionDireccion>
          id={id}
          valor={zona ? valor.split(',')[0] : valor}
          onCambiar={cambiarTexto}
          buscar={zona ? buscar : undefined}
          onElegir={(opcion) => {
            onCambiar(opcion.direccion)
            onElegir(opcion.direccion, opcion.ubicacion ?? null)
          }}
          textoSinResultados={zona ? `No encontramos esa dirección en ${zona.nombre}. Revisá la calle y el número.` : ''}
          placeholder={zona ? 'Calle y número. Ej: Mitre 750' : 'Primero elegí tu localidad'}
          deshabilitado={!zona}
          maxLength={maxLength}
          className={claseCampo}
        />
        {error
          ? <span className="text-sm text-danger">{error}</span>
          : zona && <span className="text-xs text-muted">Escribí calle y número y elegí tu dirección de la lista.</span>}
      </div>
    </div>
  )
}
