'use client'

// Checkout del menú digital: datos de contacto, entrega y pago, y envío a POST /api/pedidos.
// Las reglas de los campos son las mismas que valida el servidor (lib/pedidos/pedidos-validacion),
// con los mismos mensajes; igual el servidor es el que decide. Al crearse el pedido, el
// formulario se reemplaza por la confirmación (PedidoConfirmado) en esta misma página.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Banknote, Bike, Info, Landmark, ShoppingBag } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { detalleLinea, useCarrito, useHidratado, type ItemCarrito, type ProductoCarrito } from '@/lib/pedidos/carrito'
import {
  ErrorPedido, MAX_DIRECCION, MAX_NOMBRE_CLIENTE, MAX_REFERENCIAS, MENSAJE_DIRECCION, MENSAJE_LOCALIDAD,
  MENSAJE_REFERENCIAS, MENSAJE_TELEFONO, MIN_DIRECCION, limpiarReferencias, validarPedidoOnline,
  type MetodoPagoOnline, type TipoEntregaOnline,
} from '@/lib/pedidos/pedidos-validacion'
import { formatearPrecio } from '@/lib/utils/precio'
import { whatsappValido } from '@/lib/sucursales/sucursales-validacion'
import { textoProductos } from '@/components/carta/compartidos/BarraCarrito'
import { PedidoConfirmado, type PedidoCreado } from './PedidoConfirmado'

export type SucursalCheckout = {
  nombre: string
  direccion: string
  localidad: string
  provincia: string
  whatsapp: string | null
  ofreceRetiro: boolean
  ofreceDelivery: boolean
  localidadesDelivery: { idLocalidad: number; nombre: string }[]
}

type Campo = 'nombre' | 'telefono' | 'tipoEntrega' | 'direccion' | 'idLocalidad' | 'referencias' | 'metodoPago'
type Errores = Partial<Record<Campo, string>>

const MENSAJE_SIN_CONEXION = 'No pudimos enviar tu pedido. Revisá tu conexión e intentá de nuevo.'

const soloDigitos = (texto: string) => texto.trim().replace(/[\s\-()]/g, '')

// `aceptaTransferencia` es solo un booleano: los datos de la cuenta no viajan a esta
// página, llegan en la respuesta del pedido ya creado.
export function CheckoutForm({ slug, sucursal, aceptaTransferencia, productos }: {
  slug: string
  sucursal: SucursalCheckout
  aceptaTransferencia: boolean
  productos: ProductoCarrito[]
}) {
  const router = useRouter()
  const carrito = useCarrito(slug)
  const { reconciliar } = carrito
  const hidratado = useHidratado()

  const entregasOfrecidas = [
    ...(sucursal.ofreceRetiro ? ['retiro' as const] : []),
    ...(sucursal.ofreceDelivery ? ['delivery' as const] : []),
  ]
  const hayZonas = sucursal.localidadesDelivery.length > 0
  // Dónde se retira: "Belgrano 123, Avellaneda, Buenos Aires".
  const direccionRetiro = [sucursal.direccion, sucursal.localidad, sucursal.provincia].filter(Boolean).join(', ')

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  // Con una sola forma de entrega (o de pago) no hay nada que elegir: queda fija.
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntregaOnline | null>(
    entregasOfrecidas.length === 1 ? entregasOfrecidas[0] : null,
  )
  const [direccion, setDireccion] = useState('')
  const [idLocalidad, setIdLocalidad] = useState('')
  const [referencias, setReferencias] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPagoOnline | null>(aceptaTransferencia ? null : 'efectivo')
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pedido, setPedido] = useState<PedidoCreado | null>(null)

  const refError = useRef<HTMLDivElement>(null)
  const refConfirmacion = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    reconciliar(productos)
  }, [reconciliar, productos])

  // Sin nada para pedir, de vuelta al carrito (que muestra el aviso si se sacó algo).
  // No aplica con el pedido ya confirmado: ahí el carrito se vacía a propósito.
  const sinItems = hidratado && carrito.items.length === 0 && !pedido
  useEffect(() => {
    if (sinItems) router.replace(`/${slug}/carrito`)
  }, [sinItems, router, slug])

  // La confirmación reemplaza al formulario: se lleva la vista y el foco a su título.
  useEffect(() => {
    if (!pedido) return
    window.scrollTo({ top: 0 })
    refConfirmacion.current?.focus()
  }, [pedido])

  if (pedido) return <PedidoConfirmado pedido={pedido} slug={slug} refTitulo={refConfirmacion} />

  if (!hidratado || sinItems) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Cargando tu pedido…</span>
        {[0, 1, 2].map((indice) => (
          <div key={indice} className="h-28 animate-pulse rounded-3xl bg-surface motion-reduce:animate-none" />
        ))}
      </div>
    )
  }

  const detalleEfectivo =
    tipoEntrega === 'delivery' ? 'Pagás cuando llega' : tipoEntrega === 'retiro' ? 'Pagás al retirar' : 'Pagás al recibirlo'

  function limpiarError(campo: Campo) {
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }))
  }

  // Mismas reglas y mensajes que validarPedidoOnline, pero campo por campo.
  function validar(): Errores {
    const encontrados: Errores = {}
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio || nombreLimpio.length > MAX_NOMBRE_CLIENTE) {
      encontrados.nombre = `Tu nombre debe tener entre 1 y ${MAX_NOMBRE_CLIENTE} caracteres.`
    }
    if (!whatsappValido(soloDigitos(telefono))) encontrados.telefono = MENSAJE_TELEFONO
    if (!tipoEntrega) encontrados.tipoEntrega = 'Elegí si retirás en el local o pedís delivery.'
    if (tipoEntrega === 'delivery') {
      const direccionLimpia = direccion.trim()
      if (direccionLimpia.length < MIN_DIRECCION || direccionLimpia.length > MAX_DIRECCION) {
        encontrados.direccion = MENSAJE_DIRECCION
      }
      if (hayZonas && !idLocalidad) encontrados.idLocalidad = MENSAJE_LOCALIDAD
      if (limpiarReferencias(referencias) === undefined) encontrados.referencias = MENSAJE_REFERENCIAS
    }
    if (!metodoPago) encontrados.metodoPago = 'Elegí cómo vas a pagar: efectivo o transferencia.'
    return encontrados
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    setErrorGeneral(null)

    const encontrados = validar()
    setErrores(encontrados)
    const primero = (Object.keys(encontrados) as Campo[])[0]
    if (primero) {
      document.querySelector<HTMLElement>(`[data-campo="${primero}"]`)?.focus()
      return
    }

    const cuerpo = {
      slugSucursal: slug,
      cliente: { nombre: nombre.trim(), telefono: soloDigitos(telefono) },
      tipoEntrega,
      ...(tipoEntrega === 'delivery'
        ? {
            direccion: direccion.trim(),
            ...(idLocalidad ? { idLocalidad: Number(idLocalidad) } : {}),
            // Opcionales: vacías no se mandan.
            ...(referencias.trim() ? { referencias: referencias.trim() } : {}),
          }
        : {}),
      metodoPago,
      // La aclaración para la cocina se escribe en el carrito; vacía no se manda.
      ...(carrito.aclaracion.trim() ? { aclaracion: carrito.aclaracion.trim() } : {}),
      // Una línea por combinación; sin variación no se manda idVariacion.
      items: carrito.items.map(({ idProducto, cantidad, idVariacion, extras }) => ({
        idProducto,
        cantidad,
        ...(idVariacion !== null ? { idVariacion } : {}),
        ...(extras.length > 0 ? { extras: extras.map((extra) => extra.idExtra) } : {}),
      })),
    }

    // Última revisión con el mismo validador que la API (topes de ítems, etc.).
    try {
      validarPedidoOnline(cuerpo)
    } catch (error) {
      mostrarErrorGeneral(error instanceof ErrorPedido ? error.message : MENSAJE_SIN_CONEXION)
      return
    }

    setEnviando(true)
    try {
      const respuesta = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const datos = (await respuesta.json().catch(() => null)) as
        | { pedido?: PedidoCreado; error?: string; productosNoDisponibles?: unknown }
        | null

      if (respuesta.status === 201 && datos?.pedido) {
        // Primero la confirmación y después vaciar: así no se dispara la vuelta al carrito.
        setPedido(datos.pedido)
        carrito.vaciar()
        return
      }
      // Incluye las líneas cuya variación o algún extra ya no está: se sacan todas las
      // líneas de esos productos (el 409 trae ids de producto).
      if (respuesta.status === 409 && Array.isArray(datos?.productosNoDisponibles)) {
        const ids = datos.productosNoDisponibles.filter((id): id is number => typeof id === 'number')
        carrito.quitarProductos(ids)
        mostrarErrorGeneral(
          `${datos.error ?? 'Algunos productos ya no están disponibles.'} Los sacamos de tu carrito: revisá el resumen y confirmá de nuevo.`,
        )
        return
      }
      mostrarErrorGeneral(datos?.error ?? MENSAJE_SIN_CONEXION)
    } catch {
      mostrarErrorGeneral(MENSAJE_SIN_CONEXION)
    } finally {
      setEnviando(false)
    }
  }

  function mostrarErrorGeneral(mensaje: string) {
    setErrorGeneral(mensaje)
    // role="alert" lo anuncia; además se lleva la vista hasta el mensaje.
    requestAnimationFrame(() => refError.current?.scrollIntoView({ block: 'center' }))
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <ResumenPedido
        items={carrito.items}
        total={carrito.total}
        cantidadTotal={carrito.cantidadTotal}
        aclaracion={carrito.aclaracion.trim()}
        slug={slug}
      />

      <form onSubmit={enviar} noValidate className="flex flex-col gap-5 lg:order-first" aria-busy={enviando}>
        <Seccion titulo="Tus datos">
          <Input
            id="checkout-nombre"
            data-campo="nombre"
            label="Nombre"
            autoComplete="name"
            maxLength={MAX_NOMBRE_CLIENTE}
            value={nombre}
            onChange={(evento) => { setNombre(evento.target.value); limpiarError('nombre') }}
            error={errores.nombre}
            className="min-h-12 rounded-xl"
          />
          <Input
            id="checkout-telefono"
            data-campo="telefono"
            label="Celular"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="Ej: 1123493023"
            maxLength={20}
            value={telefono}
            onChange={(evento) => { setTelefono(evento.target.value); limpiarError('telefono') }}
            error={errores.telefono}
            className="min-h-12 rounded-xl"
          />
          {!errores.telefono && (
            <p className="-mt-2 text-xs font-normal text-muted">Con código de área, sin 0 ni 15. Lo usamos solo por tu pedido.</p>
          )}
        </Seccion>

        <Seccion titulo="¿Cómo lo querés recibir?" comoGrupo error={errores.tipoEntrega} idError="error-entrega">
          {entregasOfrecidas.length === 1 ? (
            <OpcionFija
              icono={entregasOfrecidas[0] === 'retiro' ? <ShoppingBag className="size-5" aria-hidden="true" /> : <Bike className="size-5" aria-hidden="true" />}
              titulo={entregasOfrecidas[0] === 'retiro' ? 'Retiro en el local' : 'Delivery'}
              detalle={entregasOfrecidas[0] === 'retiro' ? `Este local solo hace retiro · ${direccionRetiro}` : 'Este local solo hace delivery'}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Opcion
                nombreGrupo="tipoEntrega"
                campo="tipoEntrega"
                valor="retiro"
                elegido={tipoEntrega === 'retiro'}
                onElegir={() => { setTipoEntrega('retiro'); limpiarError('tipoEntrega') }}
                icono={<ShoppingBag className="size-5" aria-hidden="true" />}
                titulo="Retiro en el local"
                detalle={direccionRetiro}
                idError={errores.tipoEntrega ? 'error-entrega' : undefined}
              />
              <Opcion
                nombreGrupo="tipoEntrega"
                valor="delivery"
                elegido={tipoEntrega === 'delivery'}
                onElegir={() => { setTipoEntrega('delivery'); limpiarError('tipoEntrega') }}
                icono={<Bike className="size-5" aria-hidden="true" />}
                titulo="Delivery"
                detalle="Te lo llevamos"
                idError={errores.tipoEntrega ? 'error-entrega' : undefined}
              />
            </div>
          )}

          {tipoEntrega === 'delivery' && (
            <div className="flex flex-col gap-4 pt-1">
              <Input
                id="checkout-direccion"
                data-campo="direccion"
                label="Dirección de entrega"
                autoComplete="street-address"
                placeholder="Calle, número, piso/depto"
                maxLength={MAX_DIRECCION}
                value={direccion}
                onChange={(evento) => { setDireccion(evento.target.value); limpiarError('direccion') }}
                error={errores.direccion}
                className="min-h-12 rounded-xl"
              />
              {hayZonas && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="checkout-localidad" className="text-sm font-medium text-text">Localidad</label>
                  <select
                    id="checkout-localidad"
                    data-campo="idLocalidad"
                    value={idLocalidad}
                    onChange={(evento) => { setIdLocalidad(evento.target.value); limpiarError('idLocalidad') }}
                    aria-invalid={errores.idLocalidad ? true : undefined}
                    aria-describedby={errores.idLocalidad ? 'checkout-localidad-error' : undefined}
                    className="min-h-12 rounded-xl border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
                  >
                    <option value="">Elegí tu localidad</option>
                    {sucursal.localidadesDelivery.map((localidad) => (
                      <option key={localidad.idLocalidad} value={localidad.idLocalidad}>{localidad.nombre}</option>
                    ))}
                  </select>
                  {errores.idLocalidad ? (
                    <span id="checkout-localidad-error" className="text-sm text-danger">{errores.idLocalidad}</span>
                  ) : (
                    <span className="text-xs font-normal text-muted">Solo hacemos delivery a estas localidades.</span>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="checkout-referencias" className="text-sm font-medium text-text">
                  Indicaciones para el repartidor (opcional)
                </label>
                <textarea
                  id="checkout-referencias"
                  data-campo="referencias"
                  rows={2}
                  placeholder="Ej: casa de 2 pisos, puerta blanca y ventanas verdes"
                  maxLength={MAX_REFERENCIAS}
                  value={referencias}
                  onChange={(evento) => { setReferencias(evento.target.value); limpiarError('referencias') }}
                  aria-invalid={errores.referencias ? true : undefined}
                  aria-describedby={errores.referencias ? 'checkout-referencias-error' : undefined}
                  className="min-h-12 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
                />
                {errores.referencias && (
                  <span id="checkout-referencias-error" className="text-sm text-danger">{errores.referencias}</span>
                )}
              </div>
            </div>
          )}
        </Seccion>

        <Seccion titulo="¿Cómo vas a pagar?" comoGrupo error={errores.metodoPago} idError="error-pago">
          {aceptaTransferencia ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Opcion
                nombreGrupo="metodoPago"
                campo="metodoPago"
                valor="efectivo"
                elegido={metodoPago === 'efectivo'}
                onElegir={() => { setMetodoPago('efectivo'); limpiarError('metodoPago') }}
                icono={<Banknote className="size-5" aria-hidden="true" />}
                titulo="Efectivo"
                detalle={detalleEfectivo}
                idError={errores.metodoPago ? 'error-pago' : undefined}
              />
              <Opcion
                nombreGrupo="metodoPago"
                valor="transferencia"
                elegido={metodoPago === 'transferencia'}
                onElegir={() => { setMetodoPago('transferencia'); limpiarError('metodoPago') }}
                icono={<Landmark className="size-5" aria-hidden="true" />}
                titulo="Transferencia"
                detalle="Con alias"
                idError={errores.metodoPago ? 'error-pago' : undefined}
              />
            </div>
          ) : (
            <OpcionFija
              icono={<Banknote className="size-5" aria-hidden="true" />}
              titulo="Efectivo"
              detalle={detalleEfectivo}
            />
          )}

          {/* Los datos para transferir se muestran recién con el pedido creado (en
              PedidoConfirmado, desde la respuesta del POST): así nadie paga un pedido que
              después falla al confirmarse. */}
          {metodoPago === 'transferencia' && aceptaTransferencia && (
            <div className="flex gap-3 rounded-2xl bg-accent-soft p-4 text-sm font-normal">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <p>
                Al confirmar te mostramos el alias para transferir, junto con el número de tu pedido.{' '}
                {sucursal.whatsapp
                  ? 'Después nos mandás el comprobante por WhatsApp y empezamos a prepararlo cuando verifiquemos el pago.'
                  : 'Una vez realizada la transferencia, enviá el comprobante por WhatsApp. Empezamos a preparar tu pedido cuando verifiquemos el pago.'}
              </p>
            </div>
          )}
        </Seccion>

        {errorGeneral && (
          <div ref={refError} role="alert" className="rounded-2xl border border-danger/30 bg-surface p-4 text-sm text-danger">
            {errorGeneral}
          </div>
        )}

        <Button type="submit" variant="acento" tamano="grande" disabled={enviando} className="shadow-lg">
          {enviando ? 'Enviando tu pedido…' : `Confirmar pedido · ${formatearPrecio(carrito.total)}`}
        </Button>
        <p className="-mt-2 text-center text-xs font-normal text-muted">
          Los precios se confirman al enviar el pedido.
        </p>
      </form>
    </div>
  )
}

function Seccion({ titulo, comoGrupo = false, error, idError, children }: {
  titulo: string
  comoGrupo?: boolean
  error?: string
  idError?: string
  children: ReactNode
}) {
  const clase = 'flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm'
  if (!comoGrupo) {
    return (
      <section className={clase}>
        <h2 className="font-semibold">{titulo}</h2>
        {children}
      </section>
    )
  }
  // Las opciones (radios) van en un fieldset: el lector de pantalla lee la pregunta.
  return (
    <fieldset className={clase}>
      <legend className="float-left mb-4 w-full font-semibold">{titulo}</legend>
      {children}
      {error && <p id={idError} className="text-sm text-danger">{error}</p>}
    </fieldset>
  )
}

const claseTarjetaOpcion = 'flex min-h-16 items-center gap-3 rounded-2xl border-2 p-4 text-left'

// Radio nativo (accesible y con teclado) vestido de tarjeta.
function Opcion({ nombreGrupo, campo, valor, elegido, onElegir, icono, titulo, detalle, idError }: {
  nombreGrupo: string
  campo?: Campo
  valor: string
  elegido: boolean
  onElegir: () => void
  icono: ReactNode
  titulo: string
  detalle: string
  idError?: string
}) {
  return (
    <label
      className={`${claseTarjetaOpcion} cursor-pointer transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
        elegido ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-accent/50'
      }`}
    >
      <input
        type="radio"
        name={nombreGrupo}
        value={valor}
        checked={elegido}
        onChange={onElegir}
        data-campo={campo}
        aria-describedby={idError}
        className="sr-only"
      />
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${elegido ? 'bg-accent text-on-accent' : 'bg-bg text-muted'}`}>
        {icono}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{titulo}</span>
        <span className="text-sm font-normal text-muted">{detalle}</span>
      </span>
    </label>
  )
}

function OpcionFija({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle: string }) {
  return (
    <div className={`${claseTarjetaOpcion} border-accent bg-accent-soft/50`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">{icono}</span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{titulo}</span>
        <span className="text-sm font-normal text-muted">{detalle}</span>
      </span>
    </div>
  )
}

function ResumenPedido({ items, total, cantidadTotal, aclaracion, slug }: {
  items: ItemCarrito[]
  total: number
  cantidadTotal: number
  aclaracion: string
  slug: string
}) {
  return (
    <aside aria-labelledby="titulo-resumen" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm lg:sticky lg:top-20">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-resumen" className="font-semibold">Tu pedido</h2>
        <Link href={`/${slug}/carrito`} className="rounded-full px-2 py-1 text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          Editar
        </Link>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((item) => {
          const detalle = detalleLinea(item)
          return (
            <li key={item.clave} className="flex justify-between gap-3">
              <span className="min-w-0 font-normal">
                <span className="tabular-nums">{item.cantidad}×</span> {item.nombre}
                {detalle && <span className="block break-words text-xs text-muted">{detalle}</span>}
              </span>
              <span className="tabular-nums">{formatearPrecio(item.precioUnitario * item.cantidad)}</span>
            </li>
          )
        })}
      </ul>
      {aclaracion && (
        <p className="rounded-2xl bg-bg px-3 py-2 text-sm font-normal break-words">
          <span className="block text-xs text-muted">Aclaración para la cocina</span>
          {aclaracion}
        </p>
      )}
      <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
        <span className="text-sm text-muted">Total · {textoProductos(cantidadTotal)}</span>
        <span className="text-xl font-semibold tabular-nums">{formatearPrecio(total)}</span>
      </div>
    </aside>
  )
}
