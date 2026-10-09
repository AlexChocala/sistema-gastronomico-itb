'use client'

// Campos del formulario de una sucursal (nombre, WhatsApp, localidad, horario, dirección y
// formas de entrega). La localidad arranca vacía: se busca en Georef (API del Estado) para que
// quede normalizada, y la dirección sugiere calles de esa localidad. Si Georef no responde o
// no la encuentra, se carga a mano. El estado de los valores y el envío los maneja quien lo usa
// (página de Sucursales y configuración inicial).

import { useState } from 'react'
import { Bike, Check, ExternalLink, MapPin, ShoppingBag, Store, type LucideIcon } from '@/components/icons'
import { CampoConSugerencias } from '@/components/ui/CampoConSugerencias'
import { buscarDirecciones, buscarLocalidades } from '@/lib/sucursales/georef'
import { MENSAJE_LINK_MAPS, MENSAJE_WHATSAPP, linkMapsValido } from '@/lib/sucursales/sucursales-validacion'

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
  linkMaps: string
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
  linkMaps: '',
  idLocalidad: '',
  ofreceRetiro: true,
  ofreceDelivery: true,
}

// Formas de entrega que se ofrecen en el menú digital (la API exige al menos una).
const formasEntrega = [
  { campo: 'ofreceRetiro', etiqueta: 'Retiro en el local', icono: ShoppingBag },
  { campo: 'ofreceDelivery', etiqueta: 'Delivery', icono: Bike },
] as const

export const localidadNuevaVacia: ValoresLocalidadNueva = { nombre: '', nombreProvincia: '' }

const claseInput = 'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-muted/50'
const claseEtiqueta = 'text-sm font-medium'
const claseAyuda = 'text-xs text-muted'

// Bloque con título del formulario: agrupa los campos por tema.
export function SeccionFormulario({ icono: Icono, titulo, children }: {
  icono: LucideIcon
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
      <h3 className="flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icono className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

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
  // Búsqueda de la localidad en Georef; "manual" habilita los dos campos libres.
  const [busquedaLocalidad, setBusquedaLocalidad] = useState('')
  const [manual, setManual] = useState(false)
  const [avisoGeoref, setAvisoGeoref] = useState(false)

  // Localidad elegida: la que ya tenía la sucursal o la que se eligió en Georef. De ahí salen
  // las sugerencias de calles.
  const localidadElegida = usarLocalidadNueva
    ? (localidadNueva.nombre.trim() && localidadNueva.nombreProvincia.trim()
        ? { nombre: localidadNueva.nombre.trim(), provincia: localidadNueva.nombreProvincia.trim() }
        : null)
    : (() => {
        const encontrada = localidades.find((l) => String(l.idLocalidad) === valores.idLocalidad)
        return encontrada ? { nombre: encontrada.nombre, provincia: encontrada.provincia.nombre } : null
      })()

  function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const campo = e.target.name as Exclude<keyof ValoresSucursal, 'ofreceRetiro' | 'ofreceDelivery' | 'idLocalidad'>
    onCambiar(campo, e.target.value)
  }

  // Toda localidad elegida o cargada a mano viaja como "localidad nueva" (nombre + provincia):
  // el servidor reutiliza la que ya existe en la base o la crea.
  function elegirLocalidad(nombre: string, provincia: string) {
    onUsarLocalidadNueva(true)
    onCambiar('idLocalidad', '')
    onCambiarLocalidadNueva('nombre', nombre)
    onCambiarLocalidadNueva('nombreProvincia', provincia)
  }

  function volverABuscar() {
    elegirLocalidad('', '')
    setBusquedaLocalidad('')
    setManual(false)
    setAvisoGeoref(false)
  }

  const linkMapsCargado = valores.linkMaps.trim()
  const linkMapsInvalido = linkMapsCargado !== '' && !linkMapsValido(linkMapsCargado)

  return (
    <div className="flex flex-col gap-4">
      <SeccionFormulario icono={Store} titulo="Datos del local">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id('nombre')} className={claseEtiqueta}>Nombre</label>
            <input
              id={id('nombre')} name="nombre" value={valores.nombre} onChange={cambiar} required maxLength={100}
              placeholder="Ej: Recoleta"
              aria-describedby={conAyudas ? id('nombre-ayuda') : undefined}
              className={claseInput}
            />
            {conAyudas && (
              <p id={id('nombre-ayuda')} className={claseAyuda}>El barrio o un identificador corto del local.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id('whatsapp')} className={claseEtiqueta}>WhatsApp</label>
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id('horario')} className={claseEtiqueta}>Horario</label>
            <input
              id={id('horario')} name="horario" value={valores.horario} onChange={cambiar}
              placeholder="Ej: 9 a 22hs"
              maxLength={100}
              className={claseInput}
            />
          </div>
        </div>
      </SeccionFormulario>

      <SeccionFormulario icono={MapPin} titulo="Ubicación">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Localidad: un solo campo que arranca vacío. Buscás, elegís una sugerencia y queda fija. */}
          <div className={`flex flex-col gap-1.5 ${manual ? 'sm:col-span-2' : ''}`}>
            <span className={claseEtiqueta}>Localidad</span>
            {manual ? (
              <>
                {avisoGeoref && (
                  <p className={claseAyuda}>No pudimos consultar el buscador de localidades. Cargala a mano.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    id={id('localidad-nueva')}
                    aria-label="Nombre de la localidad"
                    placeholder="Localidad (ej: Lanús)"
                    value={localidadNueva.nombre}
                    onChange={(e) => onCambiarLocalidadNueva('nombre', e.target.value)}
                    required maxLength={100}
                    className={claseInput}
                  />
                  <input
                    id={id('provincia-nueva')}
                    aria-label="Provincia de la localidad"
                    placeholder="Provincia (ej: Buenos Aires)"
                    value={localidadNueva.nombreProvincia}
                    onChange={(e) => onCambiarLocalidadNueva('nombreProvincia', e.target.value)}
                    required maxLength={100}
                    className={claseInput}
                  />
                </div>
                <button
                  type="button"
                  onClick={volverABuscar}
                  className="cursor-pointer self-start text-xs text-accent hover:underline"
                >
                  Buscar en el listado oficial
                </button>
              </>
            ) : localidadElegida ? (
              <div className="flex items-center gap-3 rounded-full border border-accent/40 bg-surface py-1.5 pr-1.5 pl-4 text-sm">
                <MapPin className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="flex-1 truncate font-medium">{localidadElegida.nombre}, {localidadElegida.provincia}</span>
                <button
                  type="button"
                  onClick={volverABuscar}
                  className="cursor-pointer rounded-full bg-bg px-3 py-1 text-xs text-muted transition-colors hover:text-text"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <CampoConSugerencias
                  id={id('localidad-buscar')}
                  ariaLabel="Localidad"
                  valor={busquedaLocalidad}
                  onCambiar={setBusquedaLocalidad}
                  buscar={buscarLocalidades}
                  onElegir={(localidad) => elegirLocalidad(localidad.nombre, localidad.provincia)}
                  onFalla={() => {
                    setAvisoGeoref(true)
                    onUsarLocalidadNueva(true)
                    setManual(true)
                  }}
                  textoSinResultados="No encontramos esa localidad."
                  placeholder="Escribí y elegí (ej: Avellaneda)"
                  required
                  maxLength={100}
                  className={claseInput}
                />
                <p className={claseAyuda}>
                  ¿No aparece?{' '}
                  <button
                    type="button"
                    onClick={() => { onUsarLocalidadNueva(true); setManual(true) }}
                    className="cursor-pointer text-accent hover:underline"
                  >
                    Cargarla a mano
                  </button>
                </p>
              </>
            )}
          </div>

          <div className={`flex flex-col gap-1.5 ${manual ? 'sm:col-span-2' : ''}`}>
            <label htmlFor={id('direccion')} className={claseEtiqueta}>Dirección</label>
            <CampoConSugerencias
              id={id('direccion')}
              name="direccion"
              valor={valores.direccion}
              onCambiar={(texto) => onCambiar('direccion', texto)}
              // Sin localidad elegida no hay dónde buscar calles: queda como input común.
              buscar={localidadElegida
                ? (texto, signal) => buscarDirecciones(texto, localidadElegida, signal)
                : undefined}
              onElegir={(direccion) => onCambiar('direccion', direccion.clave)}
              textoSinResultados="No encontramos esa calle. Podés escribirla igual."
              deshabilitado={!localidadElegida}
              placeholder={localidadElegida ? 'Ej: Olavarria 65' : 'Elegí primero la localidad'}
              required
              maxLength={200}
              className={claseInput}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center gap-2">
              <label htmlFor={id('linkMaps')} className={claseEtiqueta}>Link de Google Maps</label>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">Opcional</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={id('linkMaps')} name="linkMaps" type="url" value={valores.linkMaps} onChange={cambiar}
                maxLength={500} placeholder="https://maps.app.goo.gl/..."
                // Mismo control que hace el servidor: solo links de Google Maps.
                aria-invalid={linkMapsInvalido}
                className={claseInput}
              />
              {linkMapsCargado !== '' && !linkMapsInvalido && (
                <a
                  href={linkMapsCargado} target="_blank" rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-sm text-accent transition-colors hover:bg-accent-soft"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Probar
                </a>
              )}
            </div>
            {linkMapsInvalido ? (
              <p className="text-xs text-danger">{MENSAJE_LINK_MAPS}</p>
            ) : (
              <p className={claseAyuda}>En Google Maps: Compartir, Copiar link.</p>
            )}
          </div>
        </div>
      </SeccionFormulario>

      <SeccionFormulario icono={Bike} titulo="Formas de entrega">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Formas de entrega</legend>
          {formasEntrega.map(({ campo, etiqueta, icono: Icono }) => (
            <label
              key={campo}
              className="group flex cursor-pointer items-center gap-3 rounded-full border-2 border-border bg-surface px-3 py-2 transition-colors hover:border-accent/50 has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                id={id(campo)} type="checkbox" className="sr-only"
                checked={valores[campo]}
                onChange={(e) => onCambiar(campo, e.target.checked)}
              />
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg text-muted transition-colors group-has-checked:bg-accent group-has-checked:text-on-accent">
                <Icono className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{etiqueta}</span>
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border text-on-accent transition-colors group-has-checked:border-accent group-has-checked:bg-accent"
              >
                <Check className="size-3 opacity-0 group-has-checked:opacity-100" strokeWidth={3} />
              </span>
            </label>
          ))}
        </fieldset>
      </SeccionFormulario>
    </div>
  )
}
