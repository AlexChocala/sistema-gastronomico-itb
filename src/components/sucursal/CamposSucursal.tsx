// Campos del formulario de una sucursal (nombre, WhatsApp, dirección, horario,
// localidad, elegida de la lista o cargada como nueva, y formas de entrega). Presentacional: el estado y el
// envío los maneja quien lo usa (página de Sucursales y configuración inicial).

import { MENSAJE_WHATSAPP } from '@/lib/sucursales/sucursales-validacion'

export interface LocalidadOpcion {
  idLocalidad: number
  nombre: string
  provincia: { nombre: string }
}

export interface ValoresSucursal {
  nombre: string
  direccion: string
  whatsapp: string
  horario: string
  idLocalidad: string
  ofreceRetiro: boolean
  ofreceDelivery: boolean
}

export interface ValoresLocalidadNueva {
  nombre: string
  nombreProvincia: string
}

export const valoresSucursalVacios: ValoresSucursal = {
  nombre: '',
  direccion: '',
  whatsapp: '',
  horario: '',
  idLocalidad: '',
  ofreceRetiro: true,
  ofreceDelivery: true,
}

// Formas de entrega que se ofrecen en el menú digital (la API exige al menos una).
const formasEntrega = [
  { campo: 'ofreceRetiro', etiqueta: 'Retiro en el local' },
  { campo: 'ofreceDelivery', etiqueta: 'Delivery' },
] as const

export const localidadNuevaVacia: ValoresLocalidadNueva = { nombre: '', nombreProvincia: '' }

const claseInput = 'rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent'

interface CamposSucursalProps {
  // Prefijo de los id de los inputs: tiene que ser único si hay varias sucursales en la misma pantalla.
  idPrefijo?: string
  valores: ValoresSucursal
  localidadNueva: ValoresLocalidadNueva
  usarLocalidadNueva: boolean
  localidades: LocalidadOpcion[]
  // Muestra textos de ayuda debajo de algunos campos (para quien carga por primera vez).
  conAyudas?: boolean
  onCambiar: <C extends keyof ValoresSucursal>(campo: C, valor: ValoresSucursal[C]) => void
  onCambiarLocalidadNueva: (campo: keyof ValoresLocalidadNueva, valor: string) => void
  onUsarLocalidadNueva: (usar: boolean) => void
}

export function CamposSucursal({
  idPrefijo = '',
  valores,
  localidadNueva,
  usarLocalidadNueva,
  localidades,
  conAyudas = false,
  onCambiar,
  onCambiarLocalidadNueva,
  onUsarLocalidadNueva,
}: CamposSucursalProps) {
  const id = (campo: string) => `${idPrefijo}${campo}`

  function cambiar(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const campo = e.target.name as Exclude<keyof ValoresSucursal, 'ofreceRetiro' | 'ofreceDelivery'>
    if (campo === 'idLocalidad' && e.target.value === '__nueva__') {
      onUsarLocalidadNueva(true)
      onCambiar('idLocalidad', '')
      return
    }
    onCambiar(campo, e.target.value)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id('nombre')} className="text-sm">Nombre</label>
        <input
          id={id('nombre')} name="nombre" value={valores.nombre} onChange={cambiar} required maxLength={100}
          placeholder={conAyudas ? 'Ej: Recoleta' : undefined}
          aria-describedby={conAyudas ? id('nombre-ayuda') : undefined}
          className={claseInput}
        />
        {conAyudas && (
          <p id={id('nombre-ayuda')} className="text-xs text-muted">El barrio o un identificador corto del local.</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id('whatsapp')} className="text-sm">WhatsApp</label>
        <input
          id={id('whatsapp')} name="whatsapp" type="tel" inputMode="numeric"
          placeholder="Ej: 1123493023"
          // 10 dígitos; se toleran espacios, guiones o paréntesis entre medio.
          pattern="[\s\-\(\)]*[1-9]([\s\-\(\)]*\d){9}[\s\-\(\)]*"
          title={MENSAJE_WHATSAPP}
          value={valores.whatsapp} onChange={cambiar}
          className={claseInput}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={id('direccion')} className="text-sm">Dirección</label>
        <input
          id={id('direccion')} name="direccion" value={valores.direccion} onChange={cambiar} required maxLength={200}
          className={claseInput}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id('horario')} className="text-sm">Horario</label>
        <input
          id={id('horario')} name="horario" value={valores.horario} onChange={cambiar} placeholder="Ej: 9 a 22hs"
          maxLength={100}
          className={claseInput}
        />
      </div>

      {!usarLocalidadNueva ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id('idLocalidad')} className="text-sm">Localidad</label>
          <select
            id={id('idLocalidad')} name="idLocalidad" value={valores.idLocalidad} onChange={cambiar} required
            className={claseInput}
          >
            <option value="" disabled hidden>Seleccionar localidad</option>
            {localidades.map((l) => (
              <option key={l.idLocalidad} value={l.idLocalidad}>
                {l.nombre}, {l.provincia.nombre}
              </option>
            ))}
            <option value="__nueva__">+ Agregar localidad nueva</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-bg p-4 sm:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm">Nueva localidad</p>
            <button
              type="button"
              onClick={() => onUsarLocalidadNueva(false)}
              className="cursor-pointer text-xs text-muted hover:text-text"
            >
              Elegir de la lista
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              id={id('localidad-nueva')}
              aria-label="Nombre de la localidad nueva"
              placeholder="Localidad (ej: Lanús)"
              value={localidadNueva.nombre}
              onChange={(e) => onCambiarLocalidadNueva('nombre', e.target.value)}
              required maxLength={100}
              className={claseInput}
            />
            <input
              id={id('provincia-nueva')}
              aria-label="Provincia de la localidad nueva"
              placeholder="Provincia (ej: Buenos Aires)"
              value={localidadNueva.nombreProvincia}
              onChange={(e) => onCambiarLocalidadNueva('nombreProvincia', e.target.value)}
              required maxLength={100}
              className={claseInput}
            />
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm">Formas de entrega</legend>
        <div className="flex flex-wrap gap-2">
          {formasEntrega.map(({ campo, etiqueta }) => (
            <label
              key={campo}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text has-checked:border-accent has-checked:bg-accent-soft has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                id={id(campo)} type="checkbox" className="sr-only"
                checked={valores[campo]}
                onChange={(e) => onCambiar(campo, e.target.checked)}
              />
              {etiqueta}
            </label>
          ))}
        </div>
        {conAyudas && (
          <p className="text-xs text-muted">Lo que elijas es lo que el cliente puede pedir desde el menú digital.</p>
        )}
      </fieldset>
    </div>
  )
}
