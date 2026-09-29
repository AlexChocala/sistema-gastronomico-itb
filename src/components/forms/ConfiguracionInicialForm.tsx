'use client'

// Asistente de configuración inicial (primer ingreso de un admin). Contenedor: guarda
// el estado de todos los pasos y hace el envío único a /api/configuracion-inicial, que
// guarda todo junto o nada. Los chequeos de cada paso usan las mismas funciones de
// validación que la API, solo para avisar antes; la que decide es la API.
//
// Pasos: 1) datos del negocio, 2) primer local, 3) sucursales adicionales. Si ya hay
// sucursales activas cargadas, los pasos 2 y 3 se saltean.

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AvisoError } from '@/components/acceso/ElementosAcceso'
import {
  CamposSucursal,
  localidadNuevaVacia,
  valoresSucursalVacios,
  type LocalidadOpcion,
  type ValoresLocalidadNueva,
  type ValoresSucursal,
} from '@/components/sucursal/CamposSucursal'
import { ArrowLeft, ArrowRight, Plus, Store, X } from '@/components/icons'
import { MAX_DESCRIPCION_NEGOCIO, MAX_NOMBRE_NEGOCIO, validarNegocioInicial } from '@/lib/negocio/negocio-validacion'
import { validarLocalidadNueva } from '@/lib/sucursales/localidades-validacion'
import { MAX_SUCURSALES, validarSucursal } from '@/lib/sucursales/sucursales-validacion'

interface BloqueSucursal {
  // Identificador estable del bloque (para las key y los id de los inputs).
  clave: number
  valores: ValoresSucursal
  localidadNueva: ValoresLocalidadNueva
  usarLocalidadNueva: boolean
}

function bloqueVacio(clave: number): BloqueSucursal {
  return { clave, valores: valoresSucursalVacios, localidadNueva: localidadNuevaVacia, usarLocalidadNueva: false }
}

// Cuerpo de una sucursal tal como lo acepta la API de Sucursales.
function cuerpoSucursal(bloque: BloqueSucursal) {
  const { nombre, direccion, whatsapp, horario, idLocalidad, ofreceRetiro, ofreceDelivery } = bloque.valores
  return {
    nombre,
    direccion,
    whatsapp: whatsapp || null,
    horario: horario || null,
    ofreceRetiro,
    ofreceDelivery,
    ...(bloque.usarLocalidadNueva
      ? { localidadNueva: bloque.localidadNueva }
      : { idLocalidad: Number(idLocalidad) }),
  }
}

function mensajeDe(error: unknown) {
  return error instanceof Error ? error.message : 'Revisá los datos cargados.'
}

// Devuelve el primer error de la sucursal, o null si está bien.
function errorDeSucursal(bloque: BloqueSucursal): string | null {
  try {
    if (bloque.usarLocalidadNueva) validarLocalidadNueva(bloque.localidadNueva)
    const { nombre, direccion, whatsapp, horario, ofreceRetiro, ofreceDelivery } = cuerpoSucursal(bloque)
    // Con localidad nueva el id lo genera la API; acá el 1 solo sirve para validar el resto.
    const idLocalidad = bloque.usarLocalidadNueva ? 1 : Number(bloque.valores.idLocalidad)
    validarSucursal({ nombre, direccion, whatsapp, horario, idLocalidad, ofreceRetiro, ofreceDelivery }, false)
    return null
  } catch (error) {
    return mensajeDe(error)
  }
}

const claseInput = 'rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent'

const claseBotonPrimario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'

const titulosPasos = ['Tu restaurante', 'Tu local', '¿Tenés más sucursales?']

interface ConfiguracionInicialFormProps {
  localidades: LocalidadOpcion[]
  // Sucursales ya cargadas (activas o no): cuentan para el tope.
  totalSucursales: number
  sucursalesActivas: number
}

export function ConfiguracionInicialForm({ localidades, totalSucursales, sucursalesActivas }: ConfiguracionInicialFormProps) {
  const router = useRouter()
  const requiereSucursal = sucursalesActivas === 0
  const totalPasos = requiereSucursal ? 3 : 1

  const [paso, setPaso] = useState(1)
  const [negocio, setNegocio] = useState({ nombre: '', descripcion: '' })
  const [sucursales, setSucursales] = useState<BloqueSucursal[]>(() => (requiereSucursal ? [bloqueVacio(0)] : []))
  const siguienteClave = useRef(1)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cantidadFinal = totalSucursales + sucursales.length
  const puedeAgregar = cantidadFinal < MAX_SUCURSALES

  function actualizarSucursal(clave: number, cambio: (bloque: BloqueSucursal) => BloqueSucursal) {
    setSucursales((actuales) => actuales.map((bloque) => (bloque.clave === clave ? cambio(bloque) : bloque)))
  }

  function agregarSucursal() {
    if (!puedeAgregar) return
    const clave = siguienteClave.current++
    setSucursales((actuales) => [...actuales, bloqueVacio(clave)])
  }

  function quitarSucursal(clave: number) {
    setError('')
    setSucursales((actuales) => actuales.filter((bloque) => bloque.clave !== clave))
  }

  // Chequeo del paso actual; devuelve el mensaje de error o null.
  function errorDelPaso(): string | null {
    if (paso === 1) {
      try {
        validarNegocioInicial(negocio)
        return null
      } catch (error) {
        return mensajeDe(error)
      }
    }
    if (paso === 2) return errorDeSucursal(sucursales[0])
    for (const [indice, bloque] of sucursales.entries()) {
      if (indice === 0) continue
      const mensaje = errorDeSucursal(bloque)
      if (mensaje) return `Sucursal ${indice + 1}: ${mensaje}`
    }
    return null
  }

  async function enviar() {
    setEnviando(true)
    try {
      const res = await fetch('/api/configuracion-inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio, sucursales: sucursales.map(cuerpoSucursal) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No se pudo guardar la configuración. Intentá nuevamente.')
        setEnviando(false)
        return
      }
      // Queda "enviando" a propósito: evita un segundo envío mientras se navega.
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el sistema. Intentá nuevamente más tarde.')
      setEnviando(false)
    }
  }

  function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setError('')
    const mensaje = errorDelPaso()
    if (mensaje) {
      setError(mensaje)
      return
    }
    if (paso < totalPasos) {
      setPaso(paso + 1)
      return
    }
    enviar()
  }

  function volver() {
    setError('')
    setPaso(paso - 1)
  }

  const esUltimoPaso = paso === totalPasos

  return (
    <div className="w-full max-w-2xl rounded-3xl bg-surface p-6 shadow-sm md:p-8">
      <IndicadorPaso paso={paso} totalPasos={totalPasos} titulo={titulosPasos[paso - 1]} />

      {/* key: cada paso es un formulario nuevo, así el foco y la validación nativa arrancan de cero. */}
      <form key={paso} onSubmit={manejarSubmit} className="mt-6 flex flex-col gap-5">
        {paso === 1 && (
          <PasoNegocio
            valores={negocio}
            onCambiar={(campo, valor) => setNegocio((actual) => ({ ...actual, [campo]: valor }))}
            sucursalesExistentes={!requiereSucursal}
          />
        )}

        {paso === 2 && sucursales[0] && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Cargá el primer local. Es necesario para tomar pedidos; después podés editarlo desde Sucursales.
            </p>
            <CamposSucursal
              idPrefijo={`sucursal-${sucursales[0].clave}-`}
              conAyudas
              localidades={localidades}
              {...propsDeBloque(sucursales[0], actualizarSucursal)}
            />
          </div>
        )}

        {paso === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Si tenés otros locales, podés cargarlos ahora. Es opcional: también se pueden agregar después desde Sucursales.
            </p>

            {sucursales.slice(1).map((bloque, indice) => (
              <div
                key={bloque.clave}
                role="group"
                aria-labelledby={`sucursal-${bloque.clave}-titulo`}
                className="flex flex-col gap-4 rounded-2xl border border-border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p id={`sucursal-${bloque.clave}-titulo`} className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Store className="size-4 text-accent" />
                    Sucursal {indice + 2}
                  </p>
                  <button
                    type="button"
                    onClick={() => quitarSucursal(bloque.clave)}
                    aria-label={`Quitar sucursal ${indice + 2}`}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-danger"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <CamposSucursal
                  idPrefijo={`sucursal-${bloque.clave}-`}
                  localidades={localidades}
                  {...propsDeBloque(bloque, actualizarSucursal)}
                />
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={agregarSucursal}
                disabled={!puedeAgregar}
                title={!puedeAgregar ? `Llegaste al máximo de ${MAX_SUCURSALES} sucursales.` : undefined}
                className={claseBotonSecundario}
              >
                <Plus className="size-4" />
                Agregar otra sucursal
              </button>
              <p className="text-xs text-muted">{cantidadFinal} de {MAX_SUCURSALES} sucursales</p>
            </div>
          </div>
        )}

        {error && <AvisoError>{error}</AvisoError>}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          {paso > 1 ? (
            <button type="button" onClick={volver} disabled={enviando} className={claseBotonSecundario}>
              <ArrowLeft className="size-4" />
              Atrás
            </button>
          ) : <span />}
          <button type="submit" disabled={enviando} className={claseBotonPrimario}>
            {esUltimoPaso ? (enviando ? 'Guardando...' : 'Terminar configuración') : 'Siguiente'}
            {!esUltimoPaso && <ArrowRight className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}

// Conecta un bloque del estado con los callbacks de CamposSucursal.
function propsDeBloque(
  bloque: BloqueSucursal,
  actualizar: (clave: number, cambio: (bloque: BloqueSucursal) => BloqueSucursal) => void,
) {
  return {
    valores: bloque.valores,
    localidadNueva: bloque.localidadNueva,
    usarLocalidadNueva: bloque.usarLocalidadNueva,
    onCambiar: <C extends keyof ValoresSucursal>(campo: C, valor: ValoresSucursal[C]) =>
      actualizar(bloque.clave, (b) => ({ ...b, valores: { ...b.valores, [campo]: valor } })),
    onCambiarLocalidadNueva: (campo: keyof ValoresLocalidadNueva, valor: string) =>
      actualizar(bloque.clave, (b) => ({ ...b, localidadNueva: { ...b.localidadNueva, [campo]: valor } })),
    onUsarLocalidadNueva: (usar: boolean) =>
      actualizar(bloque.clave, (b) => ({ ...b, usarLocalidadNueva: usar })),
  }
}

function IndicadorPaso({ paso, totalPasos, titulo }: { paso: number; totalPasos: number; titulo: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Paso {paso} de {totalPasos}</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: totalPasos }, (_, indice) => (
          <span
            key={indice}
            className={`h-1.5 flex-1 rounded-full ${indice < paso ? 'bg-accent' : 'bg-surface-muted'}`}
          />
        ))}
      </div>
      <h1 className="page-title">{titulo}</h1>
    </div>
  )
}

function PasoNegocio({
  valores,
  onCambiar,
  sucursalesExistentes,
}: {
  valores: { nombre: string; descripcion: string }
  onCambiar: (campo: 'nombre' | 'descripcion', valor: string) => void
  sucursalesExistentes: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        El nombre se muestra en el panel y en el menú digital que ven tus clientes.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="negocio-nombre" className="text-sm">Nombre del restaurante</label>
        <input
          id="negocio-nombre" value={valores.nombre} onChange={(e) => onCambiar('nombre', e.target.value)}
          required maxLength={MAX_NOMBRE_NEGOCIO} autoComplete="organization"
          className={claseInput}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="negocio-descripcion" className="text-sm">Descripción (opcional)</label>
        <input
          id="negocio-descripcion" value={valores.descripcion} onChange={(e) => onCambiar('descripcion', e.target.value)}
          maxLength={MAX_DESCRIPCION_NEGOCIO} placeholder="Ej: Parrilla y algo más"
          aria-describedby="negocio-descripcion-ayuda"
          className={claseInput}
        />
        <p id="negocio-descripcion-ayuda" className="text-xs text-muted">
          Una frase corta, de hasta {MAX_DESCRIPCION_NEGOCIO} caracteres.
        </p>
      </div>
      {sucursalesExistentes && (
        <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-muted">
          Ya hay sucursales activas cargadas: se mantienen como están y podés administrarlas desde Sucursales.
        </p>
      )}
    </div>
  )
}
