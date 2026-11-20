// src/app/(panel)/sucursales/page.tsx
// Activas y archivadas comparten pantalla; la URL elige qué lista mostrar.
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Bike, Clock, Globe, Info, MapPin, MonitorPlay, Pencil, Phone, Plus, Power, Search, ShoppingBag, Store } from '@/components/icons'
import { MAX_SUCURSALES, generarSlug, linkGoogleMaps } from '@/lib/sucursales/sucursales-validacion'
import {
  CamposSucursal, SeccionFormulario, localidadNuevaVacia, valoresSucursalVacios,
} from '@/components/sucursal/CamposSucursal'
import { zonasParaEditar, zonasParaEnviar } from '@/components/sucursal/ZonasDelivery'
import { formatearCelular } from '@/components/pedidos/DatosEntrega'
import { HorarioSucursalForm, horarioParaGuardar, useHorarioForm } from '@/components/sucursal/HorarioSucursalForm'
import { AccesosPantallas } from '@/components/sucursal/AccesosPantallas'

interface Localidad {
  idLocalidad: number
  nombre: string
  provincia: { idProvincia: number; nombre: string }
}

interface Sucursal {
  idSucursal: number
  nombre: string
  slug: string
  direccion: string
  whatsapp: string | null
  horario: string | null
  linkMaps: string | null
  activa: boolean
  ofreceRetiro: boolean
  ofreceDelivery: boolean
  localidadesDelivery: { costoEnvio: number; localidad: { nombre: string; provincia: { nombre: string } } }[]
  latitud: number | null
  longitud: number | null
  idLocalidad: number
  localidad: Localidad
}

const formVacio = valoresSucursalVacios

function limpiarNombre(nombre: string) {
  return nombre.replace('Prueba - ', '')
}

export default function SucursalesPage() {
  const router = useRouter()
  const vista = usePathname() === '/sucursales/archivadas' ? 'archivadas' : 'activas'
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const tituloFormulario = useRef<HTMLHeadingElement>(null)
  const [usarLocalidadNueva, setUsarLocalidadNueva] = useState(false)
  const [error, setError] = useState('')
  const limiteAlcanzado = sucursales.length >= MAX_SUCURSALES
  const [busqueda, setBusqueda] = useState('')
  // Horario de pedidos online del formulario (se guarda junto con la sucursal).
  const horario = useHorarioForm()
  // Sucursal cuyos links de acceso de pantallas se están manejando.
  const [pantallasDe, setPantallasDe] = useState<{ idSucursal: number; nombre: string } | null>(null)

  const [form, setForm] = useState(formVacio)
  const [localidadNueva, setLocalidadNueva] = useState(localidadNuevaVacia)

  // Link de la carta (solo al editar). Mientras el admin no lo toque a mano, sigue al nombre.
  // El link anterior queda redirigiendo al nuevo (ver cambiarSlug en el servidor).
  const [slug, setSlug] = useState('')
  const [slugOriginal, setSlugOriginal] = useState('')
  const [slugTocado, setSlugTocado] = useState(false)
  const slugNormalizado = generarSlug(slug)
  const slugCambio = editandoId !== null && slugNormalizado !== slugOriginal

  async function cargarDatos() {
    setLoading(true)
    const res = await fetch('/api/sucursales')
    const data = await res.json()
    setSucursales(data.sucursales ?? [])
    setLocalidades(data.localidades ?? [])
    setLoading(false)
    // El selector de la barra superior sale del layout (servidor): hay que volver a pedirlo.
    router.refresh()
  }

  // Carga inicial: `loading` ya arranca en true, así que el efecto solo setea estado
  // cuando llega la respuesta (no en el mismo render). Si la pantalla se desmonta
  // antes, se descarta la respuesta.
  useEffect(() => {
    let paginaActiva = true

    async function cargarInicial() {
      const res = await fetch('/api/sucursales')
      const data = await res.json()
      if (!paginaActiva) return
      setSucursales(data.sucursales ?? [])
      setLocalidades(data.localidades ?? [])
      setLoading(false)
    }

    void cargarInicial()
    return () => {
      paginaActiva = false
    }
  }, [])

  function reiniciarSlug(valor = '') {
    setSlug(valor)
    setSlugOriginal(valor)
    setSlugTocado(false)
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm(formVacio)
    setLocalidadNueva(localidadNuevaVacia)
    setUsarLocalidadNueva(false)
    reiniciarSlug()
    horario.reiniciar()
    setError('')
    setMostrarForm(true)
  }

  function abrirEditar(s: Sucursal) {
    setEditandoId(s.idSucursal)
    setForm({
      nombre: s.nombre,
      direccion: s.direccion,
      whatsapp: s.whatsapp ?? '',
      horario: s.horario ?? '',
      linkMaps: s.linkMaps ?? '',
      idLocalidad: String(s.idLocalidad),
      ofreceRetiro: s.ofreceRetiro,
      ofreceDelivery: s.ofreceDelivery,
      zonas: zonasParaEditar(s.localidadesDelivery),
      latitud: s.latitud === null ? '' : String(s.latitud),
      longitud: s.longitud === null ? '' : String(s.longitud),
    })
    setLocalidadNueva(localidadNuevaVacia)
    setUsarLocalidadNueva(false)
    reiniciarSlug(s.slug)
    horario.cargar(s.idSucursal)
    setError('')
    setMostrarForm(true)
    // Esperar a que se abra el formulario. También funciona al volver a editar la
    // misma sucursal cuando el formulario ya estaba abierto fuera de la vista.
    requestAnimationFrame(() => {
      const titulo = tituloFormulario.current
      titulo?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
      titulo?.focus({ preventScroll: true })
    })
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(formVacio)
    setLocalidadNueva(localidadNuevaVacia)
    setUsarLocalidadNueva(false)
    reiniciarSlug()
    horario.reiniciar()
    setError('')
  }

  function cambiarCampo(campo: string, valor: unknown) {
    setForm((actual) => ({ ...actual, [campo]: valor,
      ...((campo === 'direccion' || campo === 'idLocalidad') ? { latitud: '', longitud: '' } : {}),
    }))
    // Al renombrar, el link sigue al nombre nuevo, salvo que el admin ya lo haya editado a mano.
    if (campo === 'nombre' && editandoId !== null && !slugTocado && typeof valor === 'string') {
      setSlug(generarSlug(valor))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!usarLocalidadNueva && !form.idLocalidad) {
      setError('Elegí la localidad de las sugerencias, o cargala a mano.')
      return
    }

    const horarioListo = horarioParaGuardar(horario.estado)
    if ('error' in horarioListo) {
      setError(horarioListo.error)
      return
    }

    const esEdicion = editandoId !== null
    const url = esEdicion ? `/api/sucursales/${editandoId}` : '/api/sucursales'
    const method = esEdicion ? 'PUT' : 'POST'

    const body: Record<string, unknown> = {
      nombre: form.nombre,
      direccion: form.direccion,
      whatsapp: form.whatsapp || null,
      // El texto del horario sale del horario de pedidos online (se completa al guardarlo).
      horario: esEdicion ? form.horario || null : null,
      linkMaps: form.linkMaps || null,
      ofreceRetiro: form.ofreceRetiro,
      ofreceDelivery: form.ofreceDelivery,
      zonasDelivery: form.ofreceDelivery ? zonasParaEnviar(form.zonas) : [],
      latitud: form.ofreceDelivery && form.latitud.trim() ? Number(form.latitud) : null,
      longitud: form.ofreceDelivery && form.longitud.trim() ? Number(form.longitud) : null,
    }

    if (usarLocalidadNueva) {
      body.localidadNueva = localidadNueva
    } else {
      body.idLocalidad = Number(form.idLocalidad)
    }

    // El link solo se manda si cambió (en el alta lo genera el servidor).
    if (slugCambio) body.slug = slug

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al guardar la sucursal')
      return
    }

    // El horario solo se guarda si se cargó o se tocó: así una sucursal con el texto viejo no lo pierde.
    const idGuardado: number | undefined = esEdicion ? editandoId : data.sucursal?.idSucursal
    if (idGuardado !== undefined && (horario.estado.tocado || horarioListo.franjas.length > 0)) {
      const resHorario = await fetch(`/api/sucursales/${idGuardado}/horario-online`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pausaPedidosOnline: horarioListo.pausa, horarios: horarioListo.franjas }),
      })
      if (!resHorario.ok) {
        const datosHorario = await resHorario.json().catch(() => null)
        setError(`La sucursal se guardó, pero no el horario: ${datosHorario?.error ?? 'error al guardar.'}`)
        cargarDatos()
        return
      }
    }

    cerrarForm()
    cargarDatos()
  }

  async function toggleActiva(s: Sucursal) {
    setError('')
    const method = s.activa ? 'DELETE' : 'PATCH'
    const res = await fetch(`/api/sucursales/${s.idSucursal}`, { method })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo cambiar el estado de la sucursal')
      return
    }
    cargarDatos()
  }

  const activas = sucursales.filter((s) => s.activa)
  const archivadas = sucursales.filter((s) => !s.activa)
  const sucursalesVisibles = (vista === 'activas' ? activas : archivadas).filter((s) =>
    limpiarNombre(s.nombre).toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  return (
    <main className="p-6">
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Sucursales</h1>
            <p className="mt-1 text-sm text-muted">
              Gestioná los locales del sistema.{' '}
              {!loading && `${sucursales.length} de ${MAX_SUCURSALES} sucursales.`}
            </p>
          </div>
          <button
            type="button"
            onClick={mostrarForm ? cerrarForm : abrirNuevo}
            // La API también lo valida; esto solo evita abrir un formulario que va a fallar.
            disabled={!mostrarForm && limiteAlcanzado}
            title={!mostrarForm && limiteAlcanzado ? `Llegaste al máximo de ${MAX_SUCURSALES} sucursales.` : undefined}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mostrarForm ? 'border border-border bg-surface hover:bg-bg' : 'bg-brand text-on-brand hover:bg-brand-hover disabled:hover:bg-brand'}`}
          >
            {mostrarForm ? <ArrowLeft className="size-4" /> : <Plus className="size-4" />}
            {mostrarForm ? 'Volver a sucursales' : 'Nueva sucursal'}
          </button>
        </header>

        {mostrarForm && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <h2 ref={tituloFormulario} tabIndex={-1} className="scroll-mt-24 text-xl font-semibold outline-none">{editandoId !== null ? 'Editar sucursal' : 'Nueva sucursal'}</h2>

            <CamposSucursal
              dosColumnas
              valores={form}
              localidadNueva={localidadNueva}
              usarLocalidadNueva={usarLocalidadNueva}
              localidades={localidades}
              onCambiar={cambiarCampo}
              onCambiarLocalidadNueva={(campo, valor) => {
                setLocalidadNueva((actual) => ({ ...actual, [campo]: valor }))
                setForm((actual) => ({ ...actual, latitud: '', longitud: '' }))
              }}
              onUsarLocalidadNueva={setUsarLocalidadNueva}
              extraTrasDatos={
                <SeccionFormulario icono={Clock} titulo="Horario del local" tarjeta>
                  <HorarioSucursalForm estado={horario.estado} onCambiar={horario.setEstado} />
                </SeccionFormulario>
              }
              extraIzquierda={editandoId !== null && (
                <SeccionFormulario icono={Globe} titulo="Link de la carta" tarjeta>
                  <label className="flex flex-col gap-1.5">
                    <span className="sr-only">Link de la carta</span>
                    <span className="flex items-center gap-0.5 rounded-full border border-border bg-surface px-4 py-2.5 text-sm focus-within:border-accent">
                      <span className="text-muted">/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => {
                          setSlug(e.target.value)
                          setSlugTocado(true)
                        }}
                        onBlur={() => setSlug(slugNormalizado)}
                        maxLength={80}
                        aria-label="Link de la carta"
                        className="w-full bg-transparent outline-none"
                      />
                    </span>
                    {slugCambio && (
                      <span className="text-xs text-muted">
                        {`El link anterior (/${slugOriginal}) va a seguir funcionando: lleva a la carta nueva.`}
                      </span>
                    )}
                  </label>
                </SeccionFormulario>
              )}
            />

            {/* Barra fija: Guardar siempre a la vista, igual que en Configuración. */}
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3">
              {error && <p role="alert" className="min-w-0 flex-1 rounded-2xl bg-danger-surface px-4 py-3 text-sm text-danger shadow-lg">{error}</p>}
              <button
                type="button"
                onClick={cerrarForm}
                className="cursor-pointer rounded-full border border-border bg-surface px-5 py-2.5 text-sm shadow-lg transition-colors hover:bg-bg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-on-brand shadow-lg transition-colors hover:bg-brand-hover"
              >
                {editandoId !== null ? 'Guardar cambios' : 'Crear sucursal'}
              </button>
            </div>
          </form>
        )}

        {error && !mostrarForm && <p className="text-sm text-danger">{error}</p>}

        {!mostrarForm && (<>
        <nav aria-label="Estado de las sucursales" className="grid w-fit grid-cols-2 gap-1 rounded-full bg-surface-muted/60 p-1 text-sm">
          {([
            { valor: 'activas', texto: 'Activas', href: '/sucursales', cantidad: activas.length },
            { valor: 'archivadas', texto: 'Archivadas', href: '/sucursales/archivadas', cantidad: archivadas.length },
          ] as const).map((opcion) => (
            <Link
              key={opcion.valor}
              href={opcion.href}
              aria-current={vista === opcion.valor ? 'page' : undefined}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 transition-colors ${vista === opcion.valor ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {opcion.texto}
              <span className="rounded-full bg-bg px-2 text-xs tabular-nums text-muted">{opcion.cantidad}</span>
            </Link>
          ))}
        </nav>

        <label className="flex w-full max-w-sm items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm">
          <Search className="size-4 text-muted" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar sucursal"
            aria-label="Buscar sucursal"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>

        {loading ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando...</p>
        ) : sucursalesVisibles.length === 0 ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-muted">
            {busqueda.trim()
              ? 'No se encontraron sucursales con esa búsqueda.'
              : vista === 'archivadas' ? 'No hay sucursales archivadas.' : 'No hay sucursales activas.'}
          </p>
        ) : (
          <div className="grid-cards [--card-min:18rem]">
            {sucursalesVisibles.map((s) => (
              <article key={s.idSucursal} className="panel-card flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Store className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">{limpiarNombre(s.nombre)}</h3>
                    {/* Solo se marca la archivada: en la lista de activas, "Activa" no informa. */}
                    {!s.activa && <span className="text-xs text-muted">Archivada</span>}
                  </div>
                </div>

                {/* Toda la dirección es el link a Google Maps. */}
                <a
                  href={linkGoogleMaps(s.direccion, s.localidad.nombre, s.localidad.provincia.nombre, s.linkMaps)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-start gap-2 text-sm hover:text-accent hover:underline"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                  {s.direccion}, {s.localidad.nombre}
                </a>

                {(s.horario || s.whatsapp) && (
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    {s.horario && (
                      <span className="inline-flex items-center gap-1.5"><Clock className="size-4 shrink-0" />{s.horario}</span>
                    )}
                    {s.whatsapp && (
                      <span className="inline-flex items-center gap-1.5"><Phone className="size-4 shrink-0" />{formatearCelular(s.whatsapp)}</span>
                    )}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {s.ofreceRetiro && (
                    <span className="chip bg-bg text-text"><ShoppingBag className="size-4" strokeWidth={2} />Retiro</span>
                  )}
                  {s.ofreceDelivery && (
                    <span className="chip bg-bg text-text">
                      <Bike className="size-4" strokeWidth={2} />
                      {s.localidadesDelivery.length > 0
                        ? `Delivery · ${s.localidadesDelivery.length} ${s.localidadesDelivery.length === 1 ? 'localidad' : 'localidades'}`
                        : 'Delivery'}
                    </span>
                  )}
                  {s.ofreceDelivery && s.localidadesDelivery.length === 0 && (
                    <span className="chip bg-warning-surface text-text"><Info className="size-4 text-warning" strokeWidth={2} />Falta configurar delivery</span>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                  {/* URL pública del menú. Se edita desde el formulario; los links viejos redirigen a este. */}
                  <a
                    href={`/${s.slug}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm text-accent hover:underline"
                  >
                    <Globe className="size-4 shrink-0" />
                    /{s.slug}
                  </a>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPantallasDe(s)}
                      aria-label={`Pantallas de ${limpiarNombre(s.nombre)}`}
                      title="Pantallas"
                      className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
                    >
                      <MonitorPlay className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEditar(s)}
                      aria-label={`Editar ${limpiarNombre(s.nombre)}`}
                      title="Editar"
                      className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActiva(s)}
                      aria-label={`${s.activa ? 'Desactivar' : 'Reactivar'} ${limpiarNombre(s.nombre)}`}
                      title={s.activa ? 'Desactivar' : 'Reactivar'}
                      className={`flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors ${s.activa ? 'text-muted hover:bg-danger/10 hover:text-danger' : 'text-success hover:bg-success/10'}`}
                    >
                      <Power className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        </>)}
      </div>
      {pantallasDe && <AccesosPantallas idSucursal={pantallasDe.idSucursal} nombre={limpiarNombre(pantallasDe.nombre)} onCerrar={() => setPantallasDe(null)} />}
    </main>
  )
}

