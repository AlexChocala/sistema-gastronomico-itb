// Tickets que se imprimen al confirmar el pago en Caja (impresora térmica de 80 mm):
//   1. Comanda para cocina: sin precios.
//   2. Ticket del cliente: número de pedido grande (el que busca en el monitor) y detalle del pago.
// En pantalla no se ve: solo aparece al imprimir (`hidden print:block`).

import type { PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { textoOpciones } from '@/lib/pedidos/pedidos-estados'

const NOMBRE_LOCAL = 'Mise'

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const textoEntrega = { retiro: 'Para retirar', delivery: 'Delivery' }
const textoPago = { efectivo: 'Efectivo', transferencia: 'Transferencia' }

function fechaYHora(iso: string) {
  const fecha = new Date(iso)
  return {
    fecha: fecha.toLocaleDateString('es-AR'),
    hora: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function Separador() {
  return <hr className="my-2 border-t border-dashed border-black" />
}

export function TicketsPedido({ pedido, pagaCon }: { pedido: PedidoPantalla; pagaCon: number | null }) {
  const { fecha, hora } = fechaYHora(pedido.fecha)
  const vuelto = pagaCon !== null ? pagaCon - pedido.total : null

  return (
    <div className="hidden text-[12px] leading-snug text-black print:block">
      {/* El tamaño de página solo aplica mientras este componente está en pantalla (Caja). */}
      <style>{'@page { size: 80mm auto; margin: 4mm; }'}</style>

      {/* 1. Comanda para cocina */}
      <section className="break-after-page">
        <p className="text-center font-bold">COMANDA — COCINA</p>
        <Separador />
        <p className="text-center text-[28px] font-bold leading-none">#{pedido.idPedido}</p>
        <p className="mt-1 text-center text-[16px] font-bold">{pedido.cliente}</p>
        <p className="text-center">
          {textoEntrega[pedido.tipoEntrega]} · {hora}
        </p>
        <Separador />
        <ul>
          {/* Key por posición: el mismo producto puede venir con otras opciones. */}
          {pedido.items.map((item, indice) => {
            const opciones = textoOpciones(item.variacion, item.extras)
            return (
              <li key={indice} className="text-[14px]">
                <strong>{item.cantidad}x</strong> {item.producto}
                {opciones && <p className="pl-4 font-bold">{opciones}</p>}
              </li>
            )
          })}
        </ul>
      </section>

      {/* 2. Ticket del cliente */}
      <section>
        <p className="text-center text-[16px] font-bold">{NOMBRE_LOCAL}</p>
        <p className="text-center">
          {fecha} · {hora}
        </p>
        <Separador />
        <p className="text-center">Tu número de pedido</p>
        <p className="text-center text-[36px] font-bold leading-none">#{pedido.idPedido}</p>
        <p className="mt-1 text-center text-[16px] font-bold">{pedido.cliente}</p>
        <p className="text-center">{textoEntrega[pedido.tipoEntrega]}</p>
        {/* El ticket viaja con el pedido: el cadete necesita a dónde llevarlo. */}
        {pedido.tipoEntrega === 'delivery' && pedido.direccion && (
          <div className="mt-1 text-center">
            <p className="font-bold">
              {pedido.direccion}
              {pedido.localidad && `, ${pedido.localidad}`}
            </p>
            {pedido.referencias && <p>{pedido.referencias}</p>}
            {pedido.telefono && <p>Cel: {pedido.telefono}</p>}
          </div>
        )}
        <Separador />
        <table className="w-full">
          <tbody>
            {pedido.items.map((item, indice) => (
              <tr key={indice}>
                <td className="pr-2 align-top">
                  {item.cantidad}x {item.producto}
                  {(item.variacion || item.extras.length > 0) && (
                    <span className="block pl-4">{textoOpciones(item.variacion, item.extras)}</span>
                  )}
                </td>
                <td className="text-right align-top whitespace-nowrap">
                  {formatoPrecio.format(item.precioUnitario * item.cantidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Separador />
        <p className="flex justify-between text-[16px] font-bold">
          <span>TOTAL</span>
          <span>{formatoPrecio.format(pedido.total)}</span>
        </p>
        <p className="flex justify-between">
          <span>Pago</span>
          <span>{textoPago[pedido.metodoPago]}</span>
        </p>
        {pagaCon !== null && vuelto !== null && (
          <>
            <p className="flex justify-between">
              <span>Paga con</span>
              <span>{formatoPrecio.format(pagaCon)}</span>
            </p>
            <p className="flex justify-between">
              <span>Vuelto</span>
              <span>{formatoPrecio.format(vuelto)}</span>
            </p>
          </>
        )}
        <Separador />
        <p className="text-center">Seguí tu pedido en la pantalla del mostrador.</p>
        <p className="text-center">¡Gracias!</p>
        <p className="mt-1 text-center text-[10px]">No válido como factura</p>
      </section>
    </div>
  )
}
