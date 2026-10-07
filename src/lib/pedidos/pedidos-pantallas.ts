// Datos de pedidos para las pantallas de Caja, Cocina, Pedidos, Dashboard y Pedidos
// Mostrador. Las pantallas usan `usePedidosPantalla()` / `usePedidosMostrador()` y no
// saben de dónde salen los datos: este archivo habla con la API.
//
//   Lista    GET /api/pedidos/sucursal (la sucursal la decide el servidor por la sesión),
//            cada 5 s mientras la pestaña está visible; al volver a la pestaña o darle
//            foco se actualiza en el momento.
//   Acciones PATCH /api/pedidos/{id}. Se muestran al instante (actualización optimista)
//            y después se reemplazan por lo que responde el servidor, que es el que
//            decide (lib/pedidos/pedidos-estados.ts). Si el pedido ya había cambiado (409) o
//            falla, se vuelve a cargar la lista y se avisa con `errorAccion`.
//   Caja     POST /api/pedidos/caja (crearPedidoMostrador): el número lo da la base.
//
// Antes el estado vivía en localStorage (clave pedidos-pantallas-v5): esos datos locales
// ya no se leen ni se borran, simplemente se ignoran.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aplicarAccion, deshacerA, puedeIrACocina,
  type AccionEstado, type EstadoPago, type EstadoPedido, type ItemPedidoPantalla, type MetodoPago,
  type OrigenPedido, type PedidoMostrador, type PedidoPantalla, type TipoEntrega, type ZonaDelivery,
} from './pedidos-estados'

export { puedeIrACocina }
export type { ItemPedidoPantalla, PedidoMostrador, PedidoPantalla, ZonaDelivery }
export type EstadoPedidoPantalla = EstadoPedido
export type EstadoPagoPantalla = EstadoPago
export type MetodoPagoPantalla = MetodoPago
export type TipoEntregaPantalla = TipoEntrega
export type OrigenPedidoPantalla = OrigenPedido

export const INTERVALO_ACTUALIZACION_MS = 5000

const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá la conexión e intentá de nuevo.'

export function calcularTotal(items: Pick<ItemPedidoPantalla, 'cantidad' | 'precioUnitario'>[]) {
  return items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)
}

export class ErrorApiPedidos extends Error {
  constructor(public estado: number, mensaje: string, public datos: Record<string, unknown> = {}) {
    super(mensaje)
  }
}

// fetch + JSON con el mensaje de error de la API. Sin conexión o con una respuesta que no
// es JSON (por ejemplo, la sesión venció y el proxy redirigió al login) tira ErrorApiPedidos.
async function pedirJson<T>(url: string, init?: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(url, { cache: 'no-store', ...init })
  } catch {
    throw new ErrorApiPedidos(0, MENSAJE_SIN_CONEXION)
  }
  const datos = (await respuesta.json().catch(() => null)) as (Record<string, unknown> & { error?: unknown }) | null
  if (!respuesta.ok || datos === null) {
    const mensaje = typeof datos?.error === 'string' ? datos.error : MENSAJE_SIN_CONEXION
    throw new ErrorApiPedidos(respuesta.status, mensaje, datos ?? {})
  }
  return datos as T
}

function mensajeDe(error: unknown) {
  return error instanceof ErrorApiPedidos ? error.message : MENSAJE_SIN_CONEXION
}

// ---- Consulta periódica ----

type Resultado<T> = { clave: string; datos: T | null; error: string | null }

// Pide `url` al montar y cada INTERVALO_ACTUALIZACION_MS, con la pestaña visible. `clave`
// identifica qué se está mirando (la sucursal): si cambia, lo anterior deja de valer.
// `invalidar()` descarta las respuestas que estaban en camino (las acciones lo llaman para
// que una lista vieja no pise un cambio recién hecho).
function useConsultaPeriodica<T>(url: string | null, clave: string) {
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  const generacion = useRef(0)
  const enCurso = useRef(false)

  const consultar = useCallback(async (forzar = false) => {
    if (url === null || (enCurso.current && !forzar)) return
    const miGeneracion = generacion.current
    enCurso.current = true
    try {
      const datos = await pedirJson<T>(url)
      if (miGeneracion === generacion.current) setResultado({ clave, datos, error: null })
    } catch (error) {
      if (miGeneracion === generacion.current) {
        // Si falla, se sigue mostrando lo último que llegó, con el aviso.
        setResultado((previo) => ({ clave, datos: previo?.clave === clave ? previo.datos : null, error: mensajeDe(error) }))
      }
    } finally {
      if (miGeneracion === generacion.current) enCurso.current = false
    }
  }, [url, clave])

  const invalidar = useCallback(() => {
    generacion.current++
    enCurso.current = false
  }, [])

  useEffect(() => {
    if (url === null) return
    let temporizador: ReturnType<typeof setInterval> | null = null
    const arrancar = () => {
      temporizador ??= setInterval(() => void consultar(), INTERVALO_ACTUALIZACION_MS)
    }
    const parar = () => {
      if (temporizador !== null) clearInterval(temporizador)
      temporizador = null
    }
    // Con la pestaña oculta no se consulta; al volver, se actualiza enseguida.
    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        parar()
      } else {
        void consultar()
        arrancar()
      }
    }
    const alEnfocar = () => void consultar()

    void consultar(true)
    if (!document.hidden) arrancar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    window.addEventListener('focus', alEnfocar)
    return () => {
      parar()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      window.removeEventListener('focus', alEnfocar)
      // Lo que llegue de esta consulta ya no corresponde.
      invalidar()
    }
  }, [url, consultar, invalidar])

  const recargar = useCallback(() => consultar(true), [consultar])

  // Cambia los datos en pantalla sin esperar al servidor (acciones optimistas).
  const modificar = useCallback((cambio: (datos: T) => T) => {
    setResultado((previo) => (previo?.clave === clave && previo.datos !== null ? { ...previo, datos: cambio(previo.datos) } : previo))
  }, [clave])

  const vigente = url !== null && resultado?.clave === clave ? resultado : null
  return {
    datos: vigente?.datos ?? null,
    // Solo la primera carga: las actualizaciones periódicas no vuelven a "cargando".
    cargando: url !== null && vigente?.datos == null && vigente?.error == null,
    error: vigente?.error ?? null,
    recargar,
    invalidar,
    modificar,
  }
}

// ---- Pantallas del personal ----

type RespuestaLista = { pedidos: PedidoPantalla[]; localidadesDelivery: ZonaDelivery[] }

export type NuevoPedidoMostrador = {
  cliente: string
  tipoEntrega: TipoEntrega
  metodoPago: MetodoPago
  items: { idProducto: number; cantidad: number; idVariacion?: number; extras?: number[] }[]
  // Para la cocina, de todo el pedido (vacía no se manda).
  aclaracion?: string
  // Solo delivery (en retiro no se mandan).
  telefono?: string
  direccion?: string
  idLocalidad?: number | null
  referencias?: string
}

export type DatosDelivery = { telefono: string; direccion: string; idLocalidad: number | null; referencias: string }

export type ResultadoAccion =
  | { ok: true; pedido: PedidoPantalla }
  | { ok: false; error: string; estado: number; datos: Record<string, unknown> }

function fallo(error: unknown): ResultadoAccion {
  return error instanceof ErrorApiPedidos
    ? { ok: false, error: error.message, estado: error.estado, datos: error.datos }
    : { ok: false, error: MENSAJE_SIN_CONEXION, estado: 0, datos: {} }
}

// Cuerpo de POST /api/pedidos/caja. En retiro no va ningún dato de contacto: el servidor
// los rechaza (ver validarPedidoCaja).
export function cuerpoPedidoCaja(datos: NuevoPedidoMostrador) {
  return {
    cliente: {
      nombre: datos.cliente.trim(),
      ...(datos.tipoEntrega === 'delivery' ? { telefono: datos.telefono ?? '' } : {}),
    },
    tipoEntrega: datos.tipoEntrega,
    metodoPago: datos.metodoPago,
    ...(datos.aclaracion?.trim() ? { aclaracion: datos.aclaracion.trim() } : {}),
    items: datos.items,
    ...(datos.tipoEntrega === 'delivery'
      ? {
          direccion: datos.direccion ?? '',
          ...(datos.idLocalidad ? { idLocalidad: datos.idLocalidad } : {}),
          ...(datos.referencias?.trim() ? { referencias: datos.referencias.trim() } : {}),
        }
      : {}),
  }
}

// Caja cobra ANTES de crear el pedido: entra pagado y 'recibido'. Suelta (sin hook) para
// que Caja no tenga que consultar la lista de pedidos.
export async function crearPedidoMostrador(datos: NuevoPedidoMostrador): Promise<ResultadoAccion> {
  try {
    const { pedido } = await pedirJson<{ pedido: PedidoPantalla }>('/api/pedidos/caja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoPedidoCaja(datos)),
    })
    return { ok: true, pedido }
  } catch (error) {
    return fallo(error)
  }
}

// Pedidos de UNA sucursal: la activa de la sesión. `idSucursal` (del contexto) sirve para
// volver a consultar cuando el admin cambia de sucursal; con null (usuario sin sucursal)
// no consulta nada.
export function usePedidosPantalla(idSucursal: number | null) {
  const consulta = useConsultaPeriodica<RespuestaLista>(
    idSucursal === null ? null : '/api/pedidos/sucursal',
    String(idSucursal),
  )
  const { invalidar, modificar, recargar } = consulta
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // Por si la respuesta es de la sucursal anterior (el admin acaba de cambiarla).
  const pedidos = (consulta.datos?.pedidos ?? []).filter((pedido) => pedido.idSucursal === idSucursal)

  const reemplazar = useCallback((nuevo: PedidoPantalla) => {
    modificar((datos) => ({
      ...datos,
      pedidos: datos.pedidos.some((pedido) => pedido.idPedido === nuevo.idPedido)
        ? datos.pedidos.map((pedido) => (pedido.idPedido === nuevo.idPedido ? nuevo : pedido))
        : [nuevo, ...datos.pedidos],
    }))
  }, [modificar])

  // Aplica `optimista` al pedido en pantalla, manda el PATCH y reconcilia con la respuesta.
  const mutar = useCallback(async (
    idPedido: number,
    cuerpo: Record<string, unknown>,
    optimista: (pedido: PedidoPantalla) => PedidoPantalla | null,
  ): Promise<ResultadoAccion> => {
    setErrorAccion(null)
    invalidar()
    modificar((datos) => ({
      ...datos,
      pedidos: datos.pedidos.map((pedido) => (pedido.idPedido === idPedido ? optimista(pedido) ?? pedido : pedido)),
    }))
    try {
      const { pedido } = await pedirJson<{ pedido: PedidoPantalla }>(`/api/pedidos/${idPedido}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      invalidar()
      reemplazar(pedido)
      return { ok: true, pedido }
    } catch (error) {
      // Lo optimista se descarta: la lista vuelve a lo que diga el servidor.
      invalidar()
      void recargar()
      const resultado = fallo(error)
      if (!resultado.ok) setErrorAccion(resultado.error)
      return resultado
    }
  }, [invalidar, modificar, recargar, reemplazar])

  const cambiarEstado = useCallback((idPedido: number, accion: AccionEstado) =>
    mutar(idPedido, { accion }, (pedido) => {
      const estados = aplicarAccion(pedido, accion)
      return estados && { ...pedido, ...estados }
    }), [mutar])

  const crear = useCallback(async (datos: NuevoPedidoMostrador) => {
    const resultado = await crearPedidoMostrador(datos)
    if (resultado.ok) {
      invalidar()
      reemplazar(resultado.pedido)
    }
    return resultado
  }, [invalidar, reemplazar])

  return {
    pedidos,
    // Zonas de delivery de la sucursal (para "Cambiar a delivery").
    localidadesDelivery: consulta.datos?.localidadesDelivery ?? [],
    cargando: consulta.cargando,
    error: consulta.error,
    recargar,
    errorAccion,
    limpiarErrorAccion: () => setErrorAccion(null),
    crearPedidoMostrador: crear,
    // Transferencia verificada: queda pagado y recién ahí pasa a Cocina ('recibido').
    confirmarPago: (idPedido: number) => cambiarEstado(idPedido, 'confirmarPago'),
    marcarEnPreparacion: (idPedido: number) => cambiarEstado(idPedido, 'marcarEnPreparacion'),
    marcarListo: (idPedido: number) => cambiarEstado(idPedido, 'marcarListo'),
    // Solo delivery: el cadete sale con el pedido.
    marcarEnviado: (idPedido: number) => cambiarEstado(idPedido, 'marcarEnviado'),
    // Si el pago estaba pendiente (efectivo al entregar), entregar también lo cobra.
    marcarEntregado: (idPedido: number) => cambiarEstado(idPedido, 'marcarEntregado'),
    // A retiro: se borran dirección, localidad e indicaciones. A delivery: hacen falta
    // celular y dirección (y localidad si la sucursal tiene zonas).
    cambiarTipoEntrega: (idPedido: number, tipoEntrega: TipoEntrega, entrega?: DatosDelivery) =>
      mutar(
        idPedido,
        tipoEntrega === 'retiro' || !entrega
          ? { accion: 'cambiarTipoEntrega', tipoEntrega }
          : {
              accion: 'cambiarTipoEntrega',
              tipoEntrega,
              telefono: entrega.telefono,
              direccion: entrega.direccion,
              ...(entrega.idLocalidad ? { idLocalidad: entrega.idLocalidad } : {}),
              ...(entrega.referencias.trim() ? { referencias: entrega.referencias.trim() } : {}),
            },
        (pedido) => tipoEntrega === 'retiro'
          ? { ...pedido, tipoEntrega, direccion: null, idLocalidad: null, localidad: null, referencias: null }
          : { ...pedido, tipoEntrega },
      ),
    // "Deshacer": vuelve el pedido al estado en que estaba antes de la última acción. El
    // servidor solo lo acepta si es exactamente un paso atrás.
    deshacer: (idPedido: number, estadoAnterior: EstadoPedido) =>
      mutar(idPedido, { accion: 'deshacer', estadoAnterior }, (pedido) => {
        const estados = deshacerA(pedido, estadoAnterior)
        return estados && { ...pedido, ...estados }
      }),
  }
}

// ---- Monitor público de Pedidos Mostrador ----

// Sin sesión: la sucursal viaja en la URL. Solo recibe número, nombre de pila y estado.
export function usePedidosMostrador(idSucursal: number | null) {
  const consulta = useConsultaPeriodica<{ pedidos: PedidoMostrador[] }>(
    idSucursal === null ? null : `/api/pedidos/mostrador?sucursal=${idSucursal}`,
    String(idSucursal),
  )
  return {
    pedidos: consulta.datos?.pedidos ?? [],
    cargando: consulta.cargando,
    error: consulta.error,
    recargar: consulta.recargar,
  }
}
