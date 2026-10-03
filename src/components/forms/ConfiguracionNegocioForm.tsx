'use client'

// Formulario de Configuración: datos del negocio, logo, redes sociales y datos para
// transferencias. Guarda con
// PATCH /api/negocio; el logo va por /api/negocio/logo. El chequeo previo usa la misma
// validación que la API, solo para avisar antes; la que decide es la API.

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import { AvisoError } from '@/components/acceso/ElementosAcceso'
import { CircleCheck, ImagePlus, Trash2 } from '@/components/icons'
import {
  MAX_DESCRIPCION_NEGOCIO,
  MAX_LINK_RED_SOCIAL,
  MAX_NOMBRE_NEGOCIO,
  MAX_TITULAR_TRANSFERENCIA,
  REDES_SOCIALES,
  cuitValido,
  formatearCuit,
  validarNegocio,
  type RedSocial,
} from '@/lib/negocio/negocio-validacion'

type CampoTransferencia = 'transferenciaAlias' | 'transferenciaCuit' | 'transferenciaTitular'

type ValoresNegocio = { nombre: string; descripcion: string } & Record<RedSocial | CampoTransferencia, string>

// Forma del negocio que devuelve la API.
type NegocioApi = {
  nombre: string
  descripcion: string | null
  logoUrl: string | null
  tieneLogo: boolean
} & Record<RedSocial | CampoTransferencia, string | null>

const redes = Object.keys(REDES_SOCIALES) as RedSocial[]

const claseInput =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent'

const claseBotonPrimario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted'

const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('')
}

function valoresDe(negocio: NegocioApi): ValoresNegocio {
  return {
    nombre: negocio.nombre,
    descripcion: negocio.descripcion ?? '',
    instagram: negocio.instagram ?? '',
    tiktok: negocio.tiktok ?? '',
    facebook: negocio.facebook ?? '',
    transferenciaAlias: negocio.transferenciaAlias ?? '',
    transferenciaCuit: negocio.transferenciaCuit ?? '',
    transferenciaTitular: negocio.transferenciaTitular ?? '',
  }
}

function Seccion({ id, titulo, descripcion, children }: { id: string; titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-3xl bg-surface p-6 shadow-sm">
      <div>
        <h2 id={id} className="font-semibold">{titulo}</h2>
        <p className="mt-1 text-sm text-muted">{descripcion}</p>
      </div>
      {children}
    </section>
  )
}

// Debajo del CUIT: la indicación mientras se escribe y, con los 11 números, cómo lo va a
// ver el cliente (o el aviso si el número no existe).
function AyudaCuit({ id, cuit }: { id: string; cuit: string }) {
  if (cuit.length < 11) {
    return <p id={id} className="text-xs text-muted">Solo números, sin guiones ni espacios (11 dígitos).</p>
  }
  if (!cuitValido(cuit)) {
    return <p id={id} className="text-xs text-danger">Ese CUIT/CUIL no es válido. Revisá que esté bien escrito.</p>
  }
  return <p id={id} className="text-xs text-muted">Así lo ve el cliente: <span className="text-text">{formatearCuit(cuit)}</span></p>
}

function Contador({ id, actual, maximo }: { id: string; actual: number; maximo: number }) {
  return <span id={id} className="text-xs text-muted">{actual}/{maximo}</span>
}

interface ConfiguracionNegocioFormProps {
  inicial: ValoresNegocio
  logoUrl: string | null
  tieneLogo: boolean
}

export function ConfiguracionNegocioForm({ inicial, logoUrl: logoUrlInicial, tieneLogo: tieneLogoInicial }: ConfiguracionNegocioFormProps) {
  const router = useRouter()
  const [valores, setValores] = useState(inicial)
  const [logo, setLogo] = useState({ logoUrl: logoUrlInicial, tieneLogo: tieneLogoInicial })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [quitandoLogo, setQuitandoLogo] = useState(false)

  function cambiar(campo: keyof ValoresNegocio, valor: string) {
    setExito('')
    setValores((actuales) => ({ ...actuales, [campo]: valor }))
  }

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setError('')
    setExito('')
    try {
      validarNegocio(valores, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revisá los datos cargados.')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/negocio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No se pudieron guardar los cambios. Intentá nuevamente.')
        return
      }
      // Se muestran los valores tal como quedaron guardados (ej: links con https://).
      setValores(valoresDe(data.negocio))
      setExito('Cambios guardados.')
      // Vuelve a pedir los datos del servidor: así el sidebar muestra el nombre nuevo al
      // instante, sin perder lo que hay en este formulario.
      router.refresh()
    } catch {
      setError('No se pudo conectar con el sistema. Intentá nuevamente más tarde.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitarLogo() {
    setError('')
    setExito('')
    setQuitandoLogo(true)
    try {
      const res = await fetch('/api/negocio/logo', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No se pudo quitar el logo. Intentá nuevamente.')
        return
      }
      setLogo({ logoUrl: data.negocio.logoUrl, tieneLogo: data.negocio.tieneLogo })
    } catch {
      setError('No se pudo conectar con el sistema. Intentá nuevamente más tarde.')
    } finally {
      setQuitandoLogo(false)
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="flex max-w-2xl flex-col gap-6">
      <Seccion
        id="seccion-restaurante"
        titulo="Tu restaurante"
        descripcion="El nombre y la descripción se muestran en el panel y en el menú digital que ven tus clientes."
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="negocio-nombre" className="text-sm">Nombre del restaurante</label>
            <Contador id="negocio-nombre-contador" actual={valores.nombre.length} maximo={MAX_NOMBRE_NEGOCIO} />
          </div>
          <input
            id="negocio-nombre" value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)}
            required maxLength={MAX_NOMBRE_NEGOCIO} autoComplete="organization"
            aria-describedby="negocio-nombre-contador"
            className={claseInput}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="negocio-descripcion" className="text-sm">Descripción (opcional)</label>
            <Contador id="negocio-descripcion-contador" actual={valores.descripcion.length} maximo={MAX_DESCRIPCION_NEGOCIO} />
          </div>
          <textarea
            id="negocio-descripcion" value={valores.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)}
            maxLength={MAX_DESCRIPCION_NEGOCIO} rows={2} placeholder="Ej: Parrilla y algo más"
            aria-describedby="negocio-descripcion-contador"
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
      </Seccion>

      <Seccion id="seccion-logo" titulo="Logo" descripcion="Solo se muestra en el menú digital para tus clientes.">
        <div className="flex flex-wrap items-center gap-4">
          {logo.logoUrl ? (
            // URL externa del bucket: no pasa por next/image (no hay remotePatterns configurados).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.logoUrl} alt="Logo actual del restaurante" className="size-20 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-label="Sin logo: se muestran las iniciales del restaurante"
              role="img"
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-on-accent ring-4 ring-accent-soft"
            >
              {iniciales(valores.nombre)}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {/* La subida se habilita cuando se conecte Supabase Storage (igual que la foto de perfil). */}
              <button type="button" disabled aria-describedby="logo-ayuda" className={claseBotonSecundario}>
                <ImagePlus className="size-4" />
                Subir logo
              </button>
              {logo.tieneLogo && (
                <button
                  type="button" onClick={quitarLogo} disabled={quitandoLogo || guardando}
                  className={`${claseBotonSecundario} text-danger hover:bg-danger/10`}
                >
                  <Trash2 className="size-4" />
                  {quitandoLogo ? 'Quitando...' : 'Quitar logo'}
                </button>
              )}
            </div>
            <p id="logo-ayuda" className="text-xs text-muted">
              Pronto vas a poder subir el logo desde acá. Mientras tanto se muestran las iniciales.
            </p>
          </div>
        </div>
      </Seccion>

      <Seccion
        id="seccion-redes"
        titulo="Redes sociales"
        descripcion="Solo aparecen en el menú digital las redes que cargues."
      >
        {redes.map((red) => (
          <div key={red} className="flex flex-col gap-1.5">
            <label htmlFor={`negocio-${red}`} className="text-sm">{REDES_SOCIALES[red].etiqueta} (opcional)</label>
            <input
              id={`negocio-${red}`} value={valores[red]} onChange={(e) => cambiar(red, e.target.value)}
              type="text" inputMode="url" autoComplete="url" spellCheck={false}
              maxLength={MAX_LINK_RED_SOCIAL} placeholder={REDES_SOCIALES[red].ejemplo}
              className={claseInput}
            />
          </div>
        ))}
      </Seccion>

      <Seccion
        id="seccion-transferencias"
        titulo="Datos para transferencias"
        descripcion="Se muestran al cliente solo si elige pagar por transferencia. Si no los cargás, el menú no ofrece esa opción."
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="negocio-transferencia-titular" className="text-sm">Titular de la cuenta</label>
          <input
            id="negocio-transferencia-titular" value={valores.transferenciaTitular}
            onChange={(e) => cambiar('transferenciaTitular', e.target.value)}
            maxLength={MAX_TITULAR_TRANSFERENCIA} autoComplete="off" placeholder="Ej: Juan Pérez"
            className={claseInput}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="negocio-transferencia-alias" className="text-sm">Alias</label>
            <input
              id="negocio-transferencia-alias" value={valores.transferenciaAlias}
              onChange={(e) => cambiar('transferenciaAlias', e.target.value)}
              maxLength={20} autoComplete="off" spellCheck={false} placeholder="Ej: mi.local.mp"
              className={claseInput}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="negocio-transferencia-cuit" className="text-sm">CUIT o CUIL del titular</label>
            <input
              id="negocio-transferencia-cuit" value={valores.transferenciaCuit}
              // Solo dígitos: lo demás (letras, guiones, espacios) se descarta al escribir o pegar.
              onChange={(e) => cambiar('transferenciaCuit', e.target.value.replace(/\D/g, ''))}
              maxLength={11} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="Ej: 20123456786"
              aria-describedby="ayuda-cuit"
              className={claseInput}
            />
            <AyudaCuit id="ayuda-cuit" cuit={valores.transferenciaCuit} />
          </div>
        </div>
        <p className="text-xs text-muted">
          Hacen falta los tres datos. El CUIT/CUIL le permite al cliente comprobar que el titular que le muestra su banco es el correcto.
        </p>
      </Seccion>

      {error && <AvisoError>{error}</AvisoError>}
      {exito && (
        <p role="status" className="inline-flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          <CircleCheck className="size-4" />
          {exito}
        </p>
      )}

      <button type="submit" disabled={guardando || quitandoLogo} className={`${claseBotonPrimario} self-start`}>
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
