// Lo que muestran Cocina, Entregas y la pantalla del cliente cuando no hay turno de caja
// abierto ni pedidos en curso. En cuanto se abre la caja o entra un pedido, vuelve la pantalla.

import { Store } from '@/components/icons'

export function LocalCerrado({ titulo }: { titulo: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Store className="size-7" aria-hidden="true" />
      </span>
      <h1 className="screen-title">Local cerrado</h1>
      <p className="text-muted">{titulo}</p>
    </main>
  )
}
