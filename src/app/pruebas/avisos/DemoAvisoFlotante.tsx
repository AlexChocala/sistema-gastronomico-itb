'use client'

// Piezas interactivas de la guía de avisos: los Aviso con X o con acción (necesitan
// estado) y los botones que disparan el AvisoFlotante.

import { useCallback, useState } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'
import { Button } from '@/components/ui/Button'
import { MENSAJES } from '@/lib/utils/mensajes'

export function DemoAvisosInteractivos() {
  const [visible, setVisible] = useState(true)
  const [reintentos, setReintentos] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      {visible ? (
        <Aviso tipo="exito" onCerrar={() => setVisible(false)}>
          {MENSAJES.panel.cambiosGuardados}
        </Aviso>
      ) : (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="self-start cursor-pointer text-sm text-muted underline hover:text-text"
        >
          Mostrar de nuevo el aviso con X
        </button>
      )}
      <Aviso
        tipo="error"
        titulo="Sin conexión"
        accion={{ texto: 'Reintentar', onClick: () => setReintentos((n) => n + 1) }}
      >
        {MENSAJES.panel.sinConexion}
        {reintentos > 0 && <span className="text-muted"> (Reintentos: {reintentos})</span>}
      </Aviso>
    </div>
  )
}

export function DemoAvisoFlotante() {
  // `id` nuevo por cada clic: el aviso se vuelve a montar y el tiempo empieza de cero.
  const [aviso, setAviso] = useState<{ id: number; conDeshacer: boolean } | null>(null)
  const cerrar = useCallback(() => setAviso(null), [])

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="secundario" onClick={() => setAviso({ id: Date.now(), conDeshacer: false })}>
          Sin acción
        </Button>
        <Button variant="secundario" onClick={() => setAviso({ id: Date.now(), conDeshacer: true })}>
          Con &quot;Deshacer&quot;
        </Button>
      </div>
      {aviso && (
        <AvisoFlotante
          key={aviso.id}
          mensaje={aviso.conDeshacer ? 'Quitaste la hamburguesa.' : 'Pedido enviado a cocina.'}
          accion={aviso.conDeshacer ? { texto: 'Deshacer', onClick: cerrar } : undefined}
          onCerrar={cerrar}
        />
      )}
    </>
  )
}
