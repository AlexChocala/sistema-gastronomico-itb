// Confirmación que reemplaza al formulario de checkout cuando la API crea el pedido.
// Se arma solo con la respuesta de POST /api/pedidos (sin otra consulta): si se recarga
// la página, esta vista se pierde, y está bien. Presentacional.

import Link from 'next/link'
import type { Ref } from 'react'
import { CircleCheck, IconoWhatsapp } from '@/components/icons'
import { estilosBoton } from '@/components/ui/Button'
import type { DatosTransferencia as Datos } from '@/lib/negocio/negocio'
import type { MetodoPagoOnline, TipoEntregaOnline } from '@/lib/pedidos/pedidos-validacion'
import { textoOpciones } from '@/lib/pedidos/pedidos-estados'
import { formatearPrecio } from '@/lib/utils/precio'
import { linkWhatsapp } from '@/lib/sucursales/sucursales-validacion'
import { DatosTransferencia } from './DatosTransferencia'

// Forma de la respuesta 201 de POST /api/pedidos (ver lib/pedidos/pedidos-online.ts).
export type PedidoCreado = {
  idPedido: number
  cliente: { nombre: string }
  tipoEntrega: TipoEntregaOnline
  // Solo delivery (null en retiro).
  direccion?: string | null
  referencias?: string | null
  // Para la cocina, de todo el pedido (null si no escribió nada).
  aclaracion?: string | null
  metodoPago: MetodoPagoOnline
  estadoPedido: string
  estadoPago: string
  // Una línea por combinación: el mismo producto puede repetirse con otras opciones.
  items: {
    idProducto: number
    nombre: string
    cantidad: number
    precioUnitario: number
    subtotal: number
    variacion: string | null
    extras: string[]
  }[]
  total: number
  sucursal: { nombre: string; whatsapp: string | null }
  transferencia?: Datos
}

function proximosPasos(pedido: PedidoCreado) {
  if (pedido.tipoEntrega === 'retiro') {
    return `Recibimos tu pedido y en breve lo empezamos a preparar. Retiralo en ${pedido.sucursal.nombre} y pagás en efectivo al retirar.`
  }
  return 'Recibimos tu pedido y en breve lo empezamos a preparar. Te lo llevamos a la dirección que indicaste y pagás en efectivo cuando llegue.'
}

export function PedidoConfirmado({ pedido, slug, refTitulo }: {
  pedido: PedidoCreado
  slug: string
  refTitulo?: Ref<HTMLHeadingElement>
}) {
  const { transferencia, sucursal } = pedido
  const textoWhatsapp = encodeURIComponent(`Hola! Te mando el comprobante del pedido #${pedido.idPedido}`)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-8 text-center shadow-sm">
        <CircleCheck className="size-14 text-success" aria-hidden="true" />
        <h2 ref={refTitulo} tabIndex={-1} className="text-2xl font-semibold outline-none">
          ¡Listo {pedido.cliente.nombre}!
        </h2>
        <p className="text-lg">
          Tu pedido es el <span className="font-bold text-accent">#{pedido.idPedido}</span>
        </p>
        {!transferencia && <p className="max-w-sm text-sm font-normal text-muted">{proximosPasos(pedido)}</p>}
      </div>

      {transferencia && (
        <section aria-labelledby="titulo-pago" className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
          <h3 id="titulo-pago" className="font-semibold">Falta un paso: la transferencia</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm font-normal">
            <li>
              Transferí <strong className="font-semibold">{formatearPrecio(pedido.total)}</strong> a esta cuenta.
            </li>
            <li>
              {sucursal.whatsapp
                ? `Mandanos el comprobante por WhatsApp con el número de pedido (#${pedido.idPedido}).`
                : pedido.tipoEntrega === 'retiro'
                  ? 'Mostrá el comprobante en el local cuando pases a retirar.'
                  : 'Enviá el comprobante por WhatsApp al local.'}
            </li>
            <li>Cuando confirmemos el pago, empezamos a preparar tu pedido.</li>
          </ol>
          <DatosTransferencia datos={transferencia} />
          {sucursal.whatsapp && (
            <a
              href={`${linkWhatsapp(sucursal.whatsapp)}?text=${textoWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-success px-5 py-3 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
            >
              <IconoWhatsapp className="size-5" />
              Enviar comprobante por WhatsApp
            </a>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-detalle" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm">
        <h3 id="titulo-detalle" className="font-semibold">Detalle del pedido</h3>
        <ul className="flex flex-col gap-2 text-sm">
          {pedido.items.map((item, indice) => {
            const detalle = textoOpciones(item.variacion, item.extras)
            return (
              <li key={indice} className="flex justify-between gap-3">
                <span className="min-w-0 font-normal">
                  <span className="tabular-nums">{item.cantidad}×</span> {item.nombre}
                  {detalle && <span className="block break-words text-xs text-muted">{detalle}</span>}
                </span>
                <span className="tabular-nums">{formatearPrecio(item.subtotal)}</span>
              </li>
            )
          })}
        </ul>
        {pedido.aclaracion && (
          <p className="rounded-2xl bg-bg px-3 py-2 text-sm font-normal break-words">
            <span className="block text-xs text-muted">Aclaración para la cocina</span>
            {pedido.aclaracion}
          </p>
        )}
        <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatearPrecio(pedido.total)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Entrega</dt>
            <dd>{pedido.tipoEntrega === 'retiro' ? `Retiro en ${sucursal.nombre}` : 'Delivery'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Pago</dt>
            <dd>{pedido.metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia'}</dd>
          </div>
          {pedido.tipoEntrega === 'delivery' && pedido.direccion && (
            <div className="col-span-2">
              <dt className="text-xs text-muted">Dirección de entrega</dt>
              <dd className="break-words">{pedido.direccion}</dd>
            </div>
          )}
          {pedido.tipoEntrega === 'delivery' && pedido.referencias && (
            <div className="col-span-2">
              <dt className="text-xs text-muted">Indicaciones para el repartidor</dt>
              <dd className="break-words">{pedido.referencias}</dd>
            </div>
          )}
        </dl>
      </section>

      <Link href={`/${slug}`} className={estilosBoton({ variant: 'secundario', tamano: 'grande' })}>
        Volver al menú
      </Link>
    </div>
  )
}
