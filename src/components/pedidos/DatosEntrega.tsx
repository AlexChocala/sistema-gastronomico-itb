// Datos de entrega de un delivery: dirección, localidad, indicaciones y celular (con
// link para llamar). Son datos personales: este componente se usa solo en pantallas del
// personal (Pedidos y la confirmación de Caja), nunca en Pedidos Mostrador.

import { MapPin, Phone } from '@/components/icons'
import type { PedidoPantalla } from '@/lib/pedidos/pedidos-pantallas'

// 1123493023 → 11 2349-3023 (solo para leerlo; el link usa los dígitos).
function formatearCelular(digitos: string) {
  return digitos.length === 10 ? `${digitos.slice(0, 2)} ${digitos.slice(2, 6)}-${digitos.slice(6)}` : digitos
}

export function DatosEntrega({
  pedido,
  className = '',
}: {
  pedido: Pick<PedidoPantalla, 'direccion' | 'localidad' | 'referencias' | 'telefono'>
  className?: string
}) {
  const { direccion, localidad, referencias, telefono } = pedido
  if (!direccion && !telefono) return null

  return (
    <div className={`flex w-full flex-col gap-1.5 rounded-2xl bg-bg p-3 text-left text-sm ${className}`}>
      {direccion && (
        <p className="flex gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
          <span className="min-w-0">
            {direccion}
            {localidad && <span className="text-muted">, {localidad}</span>}
          </span>
        </p>
      )}
      {referencias && <p className="pl-6 text-xs text-muted">{referencias}</p>}
      {telefono && (
        <a
          href={`tel:+549${telefono}`}
          className="flex w-fit items-center gap-2 text-accent underline-offset-2 hover:underline"
        >
          <Phone className="size-4 shrink-0" />
          {formatearCelular(telefono)}
        </a>
      )}
    </div>
  )
}
