// 404 amable para /{slug} (y su carrito y checkout) cuando la sucursal no existe, está
// desactivada o el slug es una ruta de la app. Ver obtenerSucursalOFallar en ./datos.ts.

import Link from 'next/link'
import { MapPin } from '@/components/icons'
import { estilosBoton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function SucursalNoEncontrada() {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12 text-text">
      <Card className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MapPin className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">No encontramos este local</h1>
          <p className="text-sm font-normal text-muted">
            Puede que el link esté mal escrito o que el local ya no tome pedidos online.
          </p>
        </div>
        <Link href="/" className={estilosBoton({ variant: 'acento', tamano: 'grande' })}>
          Ver nuestros locales
        </Link>
      </Card>
    </main>
  )
}
