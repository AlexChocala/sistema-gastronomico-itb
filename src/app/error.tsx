'use client'

// Pantalla de error para cualquier falla inesperada al mostrar una página.
import { TriangleAlert } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12 text-text">
      <Card className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Algo salió mal</h1>
          <p className="text-sm font-normal text-muted">Probá de nuevo en unos segundos.</p>
        </div>
        <Button onClick={() => retry()}>Reintentar</Button>
      </Card>
    </main>
  )
}
