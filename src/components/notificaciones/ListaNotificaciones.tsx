// Panel de la campanita: transferencias online que esperan que alguien verifique el pago.

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import type { PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { formatearPrecio } from '@/lib/utils/precio'

const tiempoRelativo = new Intl.RelativeTimeFormat('es-AR', { style: 'short' })

function haceCuanto(fecha: string) {
  const minutos = Math.max(1, Math.round((Date.now() - new Date(fecha).getTime()) / 60000))
  return minutos < 60
    ? tiempoRelativo.format(-minutos, 'minute')
    : tiempoRelativo.format(-Math.floor(minutos / 60), 'hour')
}

export function ListaNotificaciones({
  pedidos,
  confirmando,
  onConfirmar,
  onVerPedido,
}: {
  pedidos: PedidoPantalla[]
  confirmando: number | null
  onConfirmar: (idPedido: number) => void
  onVerPedido: () => void
}) {
  return (
    <div className="flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-3xl bg-surface p-4 shadow-xl">
      <p className="px-1 text-sm font-semibold">Transferencias por verificar ({pedidos.length})</p>

      {pedidos.length === 0 ? (
        <p className="rounded-2xl bg-bg p-6 text-center text-sm text-muted">No hay transferencias pendientes.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {pedidos.map((pedido) => {
            const monto = formatearPrecio(pedido.total)
            return (
              <li key={pedido.idPedido} className="flex flex-col gap-3 rounded-2xl bg-bg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">#{pedido.idPedido} · {pedido.cliente}</p>
                    <p className="text-xs text-muted">Pedido online · {haceCuanto(pedido.fecha)}</p>
                  </div>
                  <span className="shrink-0 text-lg font-bold">{monto}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <Button
                    onClick={() => onConfirmar(pedido.idPedido)}
                    disabled={confirmando === pedido.idPedido}
                    aria-label={`Confirmar pago de ${monto} del pedido #${pedido.idPedido}`}
                    variant="acento"
                    className="text-sm"
                  >
                    Confirmar {monto}
                  </Button>
                  <Link href="/pedidos" onClick={onVerPedido} className="px-2 text-sm text-muted hover:text-text">
                    Ver pedido
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
