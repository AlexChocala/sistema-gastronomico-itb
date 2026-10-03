'use client'

// Alias / titular / CUIT para pagar por transferencia. El alias se copia; titular y CUIT
// sirven para comprobar que el banco muestra a quien corresponde. Se usa en el checkout
// (al elegir transferencia) y en la confirmación del pedido.

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from '@/components/icons'
import type { DatosTransferencia as Datos } from '@/lib/negocio/negocio'

type EstadoCopia = 'listo' | 'copiado' | 'error'

function BotonCopiar({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [estado, setEstado] = useState<EstadoCopia>('listo')
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  function volverAlInicio() {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setEstado('listo'), 2500)
  }

  function copiar() {
    // clipboard no existe fuera de https (o puede estar bloqueado): se avisa y listo.
    if (!navigator.clipboard) {
      setEstado('error')
      volverAlInicio()
      return
    }
    navigator.clipboard.writeText(valor).then(
      () => setEstado('copiado'),
      () => setEstado('error'),
    ).finally(volverAlInicio)
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${etiqueta}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-sm text-accent shadow-sm transition-colors hover:bg-accent hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
    >
      {estado === 'copiado' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">
        {estado === 'copiado' ? 'Copiado' : estado === 'error' ? 'No se pudo' : 'Copiar'}
      </span>
    </button>
  )
}

function Fila({ etiqueta, valor, copiable }: { etiqueta: string; valor: string; copiable: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-col">
        <dt className="text-xs text-muted">{etiqueta}</dt>
        <dd className="font-semibold break-all">{valor}</dd>
      </div>
      {copiable && <BotonCopiar valor={valor} etiqueta={etiqueta} />}
    </div>
  )
}

export function DatosTransferencia({ datos }: { datos: Datos }) {
  return (
    <dl className="flex flex-col divide-y divide-border/60 rounded-2xl bg-accent-soft/60 px-4 py-1">
      <Fila etiqueta="Alias" valor={datos.alias} copiable />
      <Fila etiqueta="Titular" valor={datos.titular} copiable={false} />
      <Fila etiqueta="CUIT / CUIL" valor={datos.cuit} copiable={false} />
    </dl>
  )
}
