// 404 general: la página no existe.
import Link from 'next/link'
import { MapPin } from '@/components/icons'
import { estilosBoton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function NoEncontrada() {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12 text-text">
      <Card className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MapPin className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">No encontramos esta página</h1>
          <p className="text-sm font-normal text-muted">Puede que el link esté mal escrito.</p>
        </div>
        <Link href="/" className={estilosBoton({ variant: 'acento', tamano: 'grande' })}>
          Ir al inicio
        </Link>
      </Card>
    </main>
  )
}
