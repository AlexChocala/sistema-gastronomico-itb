'use client'

// Datos de entrega de un delivery cargado por el personal: celular, dirección, localidad
// (solo si la sucursal tiene zonas de delivery) e indicaciones opcionales. Lo usan Caja
// (alta) y Pedidos ("Cambiar a delivery"). Los errores son los de erroresDatosDelivery
// (los mismos mensajes que la API) y se muestran recién cuando se sale del campo, para
// no retar mientras se escribe.

import { useState } from 'react'
import { MAX_DIRECCION, MAX_REFERENCIAS, type CampoDelivery } from '@/lib/pedidos/pedidos-validacion'
import type { ZonaDelivery } from '@/lib/pedidos/pedidos-pantallas'

export type ValoresDelivery = { telefono: string; direccion: string; idLocalidad: string; referencias: string }

export const VALORES_DELIVERY_VACIOS: ValoresDelivery = { telefono: '', direccion: '', idLocalidad: '', referencias: '' }

const claseCampo =
  'w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent aria-invalid:border-danger'

export function CamposDelivery({
  id,
  valores,
  errores,
  zonas,
  onCambiar,
}: {
  // Prefijo para los ids de los campos (puede haber varios formularios en la página).
  id: string
  valores: ValoresDelivery
  errores: Partial<Record<CampoDelivery, string>>
  zonas: ZonaDelivery[]
  onCambiar: (campo: keyof ValoresDelivery, valor: string) => void
}) {
  const [tocados, setTocados] = useState<Partial<Record<CampoDelivery, boolean>>>({})
  const tocar = (campo: CampoDelivery) => setTocados((previos) => ({ ...previos, [campo]: true }))
  const error = (campo: CampoDelivery) => (tocados[campo] ? errores[campo] : undefined)

  function mensaje(campo: CampoDelivery) {
    const texto = error(campo)
    return texto ? <span id={`${id}-${campo}-error`} className="text-xs text-danger">{texto}</span> : null
  }

  const atributos = (campo: CampoDelivery) => ({
    id: `${id}-${campo}`,
    onBlur: () => tocar(campo),
    'aria-invalid': error(campo) ? true : undefined,
    'aria-describedby': error(campo) ? `${id}-${campo}-error` : undefined,
    className: claseCampo,
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-telefono`} className="text-sm">Celular</label>
        <input
          {...atributos('telefono')}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej: 1123493023"
          maxLength={20}
          value={valores.telefono}
          onChange={(e) => onCambiar('telefono', e.target.value)}
        />
        {mensaje('telefono')}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-direccion`} className="text-sm">Dirección de entrega</label>
        <input
          {...atributos('direccion')}
          autoComplete="off"
          placeholder="Calle, número, piso/depto"
          maxLength={MAX_DIRECCION}
          value={valores.direccion}
          onChange={(e) => onCambiar('direccion', e.target.value)}
        />
        {mensaje('direccion')}
      </div>

      {zonas.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-idLocalidad`} className="text-sm">Localidad</label>
          <select
            {...atributos('idLocalidad')}
            value={valores.idLocalidad}
            onChange={(e) => { onCambiar('idLocalidad', e.target.value); tocar('idLocalidad') }}
            className={`${claseCampo} cursor-pointer`}
          >
            <option value="">Elegí la localidad</option>
            {zonas.map((zona) => (
              <option key={zona.idLocalidad} value={zona.idLocalidad}>{zona.nombre}</option>
            ))}
          </select>
          {mensaje('idLocalidad')}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-referencias`} className="text-sm">Indicaciones para el repartidor (opcional)</label>
        <textarea
          {...atributos('referencias')}
          rows={2}
          placeholder="Ej: casa de 2 pisos, puerta blanca y ventanas verdes"
          maxLength={MAX_REFERENCIAS}
          value={valores.referencias}
          onChange={(e) => onCambiar('referencias', e.target.value)}
          className={`${claseCampo} resize-none`}
        />
        {mensaje('referencias')}
      </div>
    </div>
  )
}
