'use client'

// Pantalla de Pedidos del panel: seguimiento y cierre de cada pedido.
//
// Cada tarjeta muestra UNA acción principal según cómo se cargó el pedido:
//   Transferencia online  pendiente_pago → "Confirmar pago" (recién ahí pasa a Cocina)
//   Retiro    listo → "Marcar entregado"
//   Delivery  listo → "Enviar con cadete" → "Marcar entregado"
// Si el cliente cambia de idea, "Cambiar a delivery / retiro" es una acción secundaria
// (solo antes de que salga el pedido), para que un click de más no ensucie los datos.
// Pasar a delivery pide celular, dirección (y localidad si la sucursal tiene zonas) en
// la misma tarjeta; pasar a retiro borra dirección, localidad e indicaciones.
//
// Las acciones se ven al instante y el servidor las confirma (ver lib/pedidos/pedidos-pantallas).
// "Deshacer" vuelve el pedido un paso atrás; el servidor lo rechaza si ya cambió.

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Banknote, Bike, CheckCheck, ChefHat, CircleCheck, Landmark, RotateCcw, Search, ShoppingBag,
  type LucideIcon,
} from '@/components/icons'
import { CamposDelivery, type ValoresDelivery } from '@/components/pedidos/CamposDelivery'
import { DatosEntrega } from '@/components/pedidos/DatosEntrega'
import { EstadoConexion } from '@/components/pedidos/EstadoConexion'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import {
  puedeIrACocina,
  usePedidosPantalla,
  type DatosDelivery,
  type EstadoPagoPantalla,
  type EstadoPedidoPantalla,
  type PedidoPantalla,
  type ResultadoAccion,
  type ZonaDelivery,
} from '@/lib/pedidos/pedidos-pantallas'
import { puedeCambiarEntrega, textoOpciones } from '@/lib/pedidos/pedidos-estados'
import { erroresDatosDelivery } from '@/lib/pedidos/pedidos-validacion'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })
const formatoDia = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function mismoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "16:30" si es de hoy, "Ayer · 16:30" o "24 sept · 16:30" si no: sin la fecha, un
// pedido viejo parece del día y no coincide con lo que cuenta el Dashboard.
function cuandoSeCargo(fechaIso: string) {
  const fecha = new Date(fechaIso)
  const hora = formatoHora.format(fecha)
  const hoy = new Date()
  if (mismoDia(fecha, hoy)) return hora
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  return `${mismoDia(fecha, ayer) ? 'Ayer' : formatoDia.format(fecha)} · ${hora}`
}

const etiquetaEntrega = {
  retiro: { texto: 'Para retirar', icono: ShoppingBag, clase: 'bg-accent-soft text-accent' },
  delivery: { texto: 'Delivery', icono: Bike, clase: 'bg-warning-surface text-warning' },
}

const estados: Record<EstadoPedidoPantalla, { texto: string; color: string; punto: string }> = {
  pendiente_pago: { texto: 'Esperando pago', color: 'text-warning', punto: 'bg-warning' },
  recibido: { texto: 'Recibido', color: 'text-accent', punto: 'bg-accent' },
  en_preparacion: { texto: 'En preparación', color: 'text-order-preparing', punto: 'bg-order-preparing' },
  listo: { texto: 'Listo', color: 'text-order-ready', punto: 'bg-order-ready' },
  enviado: { texto: 'Enviado', color: 'text-accent', punto: 'bg-accent' },
  entregado: { texto: 'Entregado', color: 'text-order-delivered', punto: 'bg-order-delivered' },
}

const etiquetaPago: Record<EstadoPagoPantalla, string> = {
  pendiente: 'Pago pendiente',
  pendiente_verificacion: 'Transferencia a verificar',
  pagado: 'Pagado',
}

const filtros = [
  {
    valor: 'por_entregar',
    texto: 'Por entregar',
    incluye: (p: PedidoPantalla) => p.estado === 'listo' || p.estado === 'enviado',
  },
  {
    valor: 'en_cocina',
    texto: 'En cocina',
    incluye: (p: PedidoPantalla) => puedeIrACocina(p),
  },
  {
    // Efectivo a cobrar al entregar y transferencias sin confirmar.
    valor: 'pago_pendiente',
    texto: 'Pago pendiente',
    incluye: (p: PedidoPantalla) => p.estadoPago !== 'pagado' && p.estado !== 'entregado',
  },
  { valor: 'entregados', texto: 'Entregados', incluye: (p: PedidoPantalla) => p.estado === 'entregado' },
  { valor: 'todos', texto: 'Todos', incluye: () => true },
] as const

// Solo llevan contador las pestañas que piden acción: si todas lo tienen, ninguno resalta.
const filtrosConContador: readonly string[] = ['por_entregar', 'pago_pendiente']

type Filtro = (typeof filtros)[number]['valor']
type FiltroEntrega = 'todas' | 'retiro' | 'delivery'

type Acciones = Pick<
  ReturnType<typeof usePedidosPantalla>,
  'marcarEnviado' | 'marcarEntregado' | 'confirmarPago'
>

type AccionPrincipal = {
  texto: string
  icono: LucideIcon
  confirmacion: string
  ejecutar: () => Promise<ResultadoAccion>
}

// Decide el único botón principal de la tarjeta. `null` + `pista` cuando no hay nada
// para hacer desde esta pantalla (por ejemplo, el pedido está en manos de Cocina).
function accionPrincipal(
  pedido: PedidoPantalla,
  acciones: Acciones,
): { accion: AccionPrincipal | null; pista: string } {
  const { idPedido, estado, tipoEntrega, estadoPago, metodoPago } = pedido
  const cobraAlEntregar = estadoPago !== 'pagado'

  if (estado === 'entregado') return { accion: null, pista: '' }

  if (estado === 'pendiente_pago') {
    return {
      accion: {
        texto: 'Confirmar pago',
        icono: Landmark,
        confirmacion: `Pago del pedido #${idPedido} confirmado. Pasa a Cocina.`,
        ejecutar: () => acciones.confirmarPago(idPedido),
      },
      pista: 'Verificá que la transferencia llegó antes de enviarlo a Cocina.',
    }
  }

  if (puedeIrACocina(pedido)) {
    return { accion: null, pista: 'En cocina. Se habilita cuando esté listo.' }
  }

  if (tipoEntrega === 'retiro') {
    return {
      accion: {
        texto: cobraAlEntregar ? 'Cobrar y entregar' : 'Marcar entregado',
        icono: cobraAlEntregar ? Banknote : CheckCheck,
        confirmacion: `Pedido #${idPedido} entregado en mostrador.`,
        ejecutar: () => acciones.marcarEntregado(idPedido),
      },
      pista: cobraAlEntregar ? `Cobrar ${formatoPrecio.format(pedido.total)} en ${metodoPago}.` : '',
    }
  }

  if (estado === 'listo') {
    return {
      accion: {
        texto: 'Enviar con cadete',
        icono: Bike,
        confirmacion: `Pedido #${idPedido} salió con el cadete.`,
        ejecutar: () => acciones.marcarEnviado(idPedido),
      },
      pista: '',
    }
  }

  return {
    accion: {
      texto: cobraAlEntregar ? 'Entregado y cobrado' : 'Marcar entregado',
      icono: CheckCheck,
      confirmacion: `Pedido #${idPedido} entregado por delivery.`,
      ejecutar: () => acciones.marcarEntregado(idPedido),
    },
    pista: cobraAlEntregar ? `El cadete cobra ${formatoPrecio.format(pedido.total)} en efectivo.` : '',
  }
}

// "Cambiar a delivery": los mismos datos que pide Caja, dentro de la tarjeta. El celular
// viene cargado si el cliente ya lo había dejado (pedidos online).
function FormularioDelivery({
  pedido,
  zonas,
  guardando,
  onGuardar,
  onCancelar,
}: {
  pedido: PedidoPantalla
  zonas: ZonaDelivery[]
  guardando: boolean
  onGuardar: (datos: DatosDelivery) => void
  onCancelar: () => void
}) {
  const [valores, setValores] = useState<ValoresDelivery>({
    telefono: pedido.telefono ?? '',
    direccion: '',
    idLocalidad: '',
    referencias: '',
  })
  const errores = erroresDatosDelivery(valores, zonas.length > 0)
  const valido = Object.keys(errores).length === 0

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!valido || guardando) return
        onGuardar({
          telefono: valores.telefono,
          direccion: valores.direccion,
          idLocalidad: valores.idLocalidad ? Number(valores.idLocalidad) : null,
          referencias: valores.referencias,
        })
      }}
      aria-label={`Datos de delivery del pedido #${pedido.idPedido}`}
      className="flex flex-col gap-3 rounded-2xl border border-border p-3"
    >
      <p className="text-sm font-semibold">Pasar a delivery</p>
      <CamposDelivery
        id={`delivery-${pedido.idPedido}`}
        valores={valores}
        errores={errores}
        zonas={zonas}
        onCambiar={(campo, valor) => setValores((previos) => ({ ...previos, [campo]: valor }))}
      />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="cursor-pointer rounded-full border border-border py-2 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!valido || guardando}
          className="cursor-pointer rounded-full bg-accent py-2 text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {!valido && <p className="-mt-1 text-center text-xs text-muted">Completá celular y dirección para guardar.</p>}
    </form>
  )
}

function TarjetaPedido({
  pedido,
  acciones,
  ocupado,
  editandoEntrega,
  zonas,
  onCambiarEntrega,
  onGuardarDelivery,
  onCancelarEdicion,
  onAccion,
  soloLectura,
}: {
  pedido: PedidoPantalla
  acciones: Acciones
  // Admin: ve el pedido completo, sin botones para cambiarlo.
  soloLectura: boolean
  // Hay una acción de este pedido esperando respuesta del servidor.
  ocupado: boolean
  editandoEntrega: boolean
  zonas: ZonaDelivery[]
  onCambiarEntrega: () => void
  onGuardarDelivery: (datos: DatosDelivery) => void
  onCancelarEdicion: () => void
  onAccion: (accion: AccionPrincipal) => void
}) {
  const entrega = etiquetaEntrega[pedido.tipoEntrega]
  const IconoEntrega = entrega.icono
  const estado = estados[pedido.estado]
  const { accion, pista } = accionPrincipal(pedido, acciones)
  const sePuedeCambiarEntrega = puedeCambiarEntrega(pedido)
  const itemsVisibles = pedido.items.slice(0, 4)
  const itemsOcultos = pedido.items.length - itemsVisibles.length

  return (
    <article
      className={`flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm ${pedido.estado === 'entregado' ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg">{pedido.cliente}</h3>
          <p className="text-xs text-muted">
            {cuandoSeCargo(pedido.fecha)} · {pedido.origen === 'online' ? 'Pedido online' : 'Cargado en caja'}
          </p>
        </div>
        <span className="shrink-0 text-lg font-bold">#{pedido.idPedido}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${entrega.clase}`}>
          <IconoEntrega className="size-3.5" />
          {entrega.texto}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-xs ${estado.color}`}>
          <span className={`size-1.5 rounded-full ${estado.punto}`} />
          {estado.texto}
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${pedido.estadoPago === 'pagado' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
        >
          {pedido.metodoPago === 'efectivo' ? <Banknote className="size-3.5" /> : <Landmark className="size-3.5" />}
          {etiquetaPago[pedido.estadoPago]}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        {/* Key por posición: el mismo producto puede venir con otras opciones. */}
        {itemsVisibles.map((item, indice) => {
          const opciones = textoOpciones(item.variacion, item.extras)
          return (
            <li key={indice} className="flex gap-3">
              <span className="w-6 shrink-0 text-muted">{item.cantidad}x</span>
              <span className="min-w-0 flex-1">
                {item.producto}
                {opciones && <span className="block text-xs break-words text-muted">{opciones}</span>}
              </span>
            </li>
          )
        })}
        {itemsOcultos > 0 && (
          <li className="pl-9 text-xs text-muted">
            + {itemsOcultos} {itemsOcultos === 1 ? 'producto más' : 'productos más'}
          </li>
        )}
      </ul>

      {pedido.aclaracion && (
        <p className="rounded-2xl bg-warning-surface px-3 py-2 text-sm break-words">
          <span className="block text-xs text-warning">Aclaración para la cocina</span>
          {pedido.aclaracion}
        </p>
      )}

      {/* Celular, dirección e indicaciones: solo para el personal (esta pantalla). */}
      {!editandoEntrega && <DatosEntrega pedido={pedido} />}

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-bold">{formatoPrecio.format(pedido.total)}</span>
        </div>

        {soloLectura ? null : accion ? (
          <button
            type="button"
            onClick={() => onAccion(accion)}
            disabled={ocupado || editandoEntrega}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <accion.icono className="size-4" />
            {accion.texto}
          </button>
        ) : pedido.estado === 'entregado' ? (
          <p className="inline-flex items-center justify-center gap-2 rounded-full bg-bg py-3 text-sm text-muted">
            <CircleCheck className="size-4" />
            {pedido.tipoEntrega === 'delivery' ? 'Entregado por delivery' : 'Entregado en mostrador'}
          </p>
        ) : (
          <p className="inline-flex items-center justify-center gap-2 rounded-full bg-bg py-3 text-sm text-muted">
            <ChefHat className="size-4" />
            {pista}
          </p>
        )}

        {!soloLectura && accion && pista && <p className="-mt-1 text-center text-xs text-muted">{pista}</p>}

        {soloLectura ? null : editandoEntrega ? (
          <FormularioDelivery
            pedido={pedido}
            zonas={zonas}
            guardando={ocupado}
            onGuardar={onGuardarDelivery}
            onCancelar={onCancelarEdicion}
          />
        ) : sePuedeCambiarEntrega && (
          <button
            type="button"
            onClick={onCambiarEntrega}
            disabled={ocupado}
            className="cursor-pointer self-center text-xs text-muted underline-offset-2 transition-colors hover:text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pedido.tipoEntrega === 'retiro' ? 'Cambiar a delivery' : 'Cambiar a retiro en mostrador'}
          </button>
        )}
      </div>
    </article>
  )
}

const sinSuscripcion = () => () => {}

type UltimaAccion = { texto: string; deshacer: () => Promise<ResultadoAccion> }

export function GestionPedidos({ soloLectura }: { soloLectura: boolean }) {
  const { sucursal } = useSucursalActiva()
  const pedidosPantalla = usePedidosPantalla(sucursal?.idSucursal ?? null)
  const {
    pedidos, localidadesDelivery, cargando, error, recargar, errorAccion, limpiarErrorAccion,
    cambiarTipoEntrega, deshacer: deshacerEstado,
  } = pedidosPantalla
  // Las horas dependen de la zona horaria del navegador: se muestran solo en el cliente.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false)

  const [filtro, setFiltro] = useState<Filtro>('por_entregar')
  const [filtroEntrega, setFiltroEntrega] = useState<FiltroEntrega>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [ultimaAccion, setUltimaAccion] = useState<UltimaAccion | null>(null)
  // Pedidos con una acción esperando respuesta (se deshabilitan sus botones).
  const [ocupados, setOcupados] = useState<ReadonlySet<number>>(new Set())
  // Pedido que muestra el formulario de "Cambiar a delivery".
  const [editandoEntrega, setEditandoEntrega] = useState<number | null>(null)

  // El aviso con "Deshacer" se oculta solo a los pocos segundos.
  useEffect(() => {
    if (!ultimaAccion) return
    const temporizador = setTimeout(() => setUltimaAccion(null), 6000)
    return () => clearTimeout(temporizador)
  }, [ultimaAccion])

  if (!enCliente || (cargando && !error)) {
    return <p className="rounded-3xl bg-surface p-10 text-center text-muted">Cargando pedidos...</p>
  }

  const texto = busqueda.trim().toLowerCase().replace('#', '')
  const coincideBusqueda = (p: PedidoPantalla) =>
    texto === '' || p.cliente.toLowerCase().includes(texto) || String(p.idPedido).includes(texto)
  const coincideEntrega = (p: PedidoPantalla) => filtroEntrega === 'todas' || p.tipoEntrega === filtroEntrega

  const base = pedidos.filter((p) => coincideBusqueda(p) && coincideEntrega(p))
  const filtroActivo = filtros.find((f) => f.valor === filtro) ?? filtros[0]
  const visibles = base.filter(filtroActivo.incluye).sort((a, b) => b.idPedido - a.idPedido)

  // Corre una acción del pedido marcándolo como ocupado; si el servidor la acepta, ofrece
  // "Deshacer". Si falla, el aviso lo muestra EstadoConexion (errorAccion).
  async function correr(idPedido: number, accion: () => Promise<ResultadoAccion>, aviso?: UltimaAccion) {
    setOcupados((actuales) => new Set(actuales).add(idPedido))
    setUltimaAccion(null)
    const resultado = await accion()
    setOcupados((actuales) => {
      const siguientes = new Set(actuales)
      siguientes.delete(idPedido)
      return siguientes
    })
    if (resultado.ok && aviso) setUltimaAccion(aviso)
    return resultado
  }

  function ejecutar(pedido: PedidoPantalla, accion: AccionPrincipal) {
    void correr(pedido.idPedido, accion.ejecutar, {
      texto: accion.confirmacion,
      deshacer: () => deshacerEstado(pedido.idPedido, pedido.estado),
    })
  }

  // A retiro se cambia directo (con "Deshacer", que vuelve a cargar los datos de entrega
  // que tenía). A delivery primero se piden los datos en la tarjeta.
  function cambiarEntrega(pedido: PedidoPantalla) {
    if (pedido.tipoEntrega === 'retiro') {
      setEditandoEntrega(pedido.idPedido)
      return
    }
    const anterior: DatosDelivery = {
      telefono: pedido.telefono ?? '',
      direccion: pedido.direccion ?? '',
      idLocalidad: pedido.idLocalidad,
      referencias: pedido.referencias ?? '',
    }
    void correr(pedido.idPedido, () => cambiarTipoEntrega(pedido.idPedido, 'retiro'), {
      texto: `Pedido #${pedido.idPedido} cambiado a retiro en mostrador.`,
      deshacer: () => cambiarTipoEntrega(pedido.idPedido, 'delivery', anterior),
    })
  }

  async function guardarDelivery(pedido: PedidoPantalla, datos: DatosDelivery) {
    const resultado = await correr(pedido.idPedido, () => cambiarTipoEntrega(pedido.idPedido, 'delivery', datos), {
      texto: `Pedido #${pedido.idPedido} cambiado a delivery.`,
      deshacer: () => cambiarTipoEntrega(pedido.idPedido, 'retiro'),
    })
    // Si falla, el formulario queda abierto con lo cargado para corregir.
    if (resultado.ok) setEditandoEntrega(null)
  }

  function deshacer() {
    if (!ultimaAccion) return
    const { deshacer: volver } = ultimaAccion
    setUltimaAccion(null)
    void volver()
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="page-title">Pedidos</h1>
        <p className="mt-1 text-sm text-muted">
          {soloLectura
            ? 'Seguí cada pedido de la sucursal. Los cargan y entregan supervisores y empleados.'
            : 'Entregá, cobrá y seguí cada pedido de la sucursal.'}
        </p>
      </header>

      <EstadoConexion
        error={error}
        errorAccion={errorAccion}
        onReintentar={() => void recargar()}
        onCerrarAviso={limpiarErrorAccion}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => {
              const cantidad = base.filter(f.incluye).length
              const activo = filtro === f.valor
              return (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setFiltro(f.valor)}
                  aria-pressed={activo}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${activo ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                >
                  {f.texto}
                  {filtrosConContador.includes(f.valor) && cantidad > 0 && (
                    <span className="min-w-5 rounded-full bg-accent px-1.5 text-xs text-on-accent">
                      {cantidad}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted/60 p-1 text-sm">
            {([
              { valor: 'todas', texto: 'Todas' },
              { valor: 'retiro', texto: 'Retiro' },
              { valor: 'delivery', texto: 'Delivery' },
            ] as const).map(({ valor, texto: etiqueta }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltroEntrega(valor)}
                aria-pressed={filtroEntrega === valor}
                className={`cursor-pointer rounded-full px-3 py-1.5 transition-colors ${filtroEntrega === valor ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <label className="flex w-full items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm sm:w-56">
            <Search className="size-4 text-muted" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente o número"
              aria-label="Buscar pedido por cliente o número"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          </div>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-3xl bg-surface p-10 text-center text-muted">No hay pedidos en esta sección.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
          {visibles.map((pedido) => (
            <TarjetaPedido
              key={pedido.idPedido}
              pedido={pedido}
              acciones={pedidosPantalla}
              ocupado={ocupados.has(pedido.idPedido)}
              editandoEntrega={editandoEntrega === pedido.idPedido && pedido.tipoEntrega === 'retiro'}
              zonas={localidadesDelivery}
              onAccion={(accion) => ejecutar(pedido, accion)}
              onCambiarEntrega={() => cambiarEntrega(pedido)}
              onGuardarDelivery={(datos) => void guardarDelivery(pedido, datos)}
              onCancelarEdicion={() => setEditandoEntrega(null)}
              soloLectura={soloLectura}
            />
          ))}
        </div>
      )}

      {ultimaAccion && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-full bg-text py-2 pr-2 pl-5 text-sm text-surface shadow-xl"
        >
          <CircleCheck className="size-4 shrink-0 text-success" />
          <span className="min-w-0 flex-1 truncate">{ultimaAccion.texto}</span>
          <button
            type="button"
            onClick={deshacer}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-accent transition-colors hover:bg-surface/10"
          >
            <RotateCcw className="size-3.5" />
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
