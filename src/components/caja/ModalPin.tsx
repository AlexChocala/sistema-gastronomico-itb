'use client'

// Ventana que pide el PIN de quien hace una acción (cobrar al entregar, cancelar un pedido).
// Opcionalmente pide también un motivo. `onConfirmar` devuelve el mensaje de error, o null si
// salió bien (y entonces se cierra sola).

import { useState, type FormEvent } from 'react'
import { X } from '@/components/icons'
import { CampoPinCaja, claseBotonCaja, claseCampoCaja } from './CamposCaja'

export function ModalPin({
  titulo, descripcion, textoBoton, pedirMotivo = false, aviso, onConfirmar, onCerrar,
}: {
  titulo: string
  descripcion?: string
  textoBoton: string
  pedirMotivo?: boolean
  // Si hay un aviso (por ejemplo, "La caja está cerrada"), no se puede confirmar.
  aviso?: string
  onConfirmar: (pin: string, motivo: string) => Promise<string | null>
  onCerrar: () => void
}) {
  const [pin, setPin] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (pedirMotivo && motivo.trim().length < 3) return setError('Escribí el motivo.')
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene que tener 4 números.')
    setEnviando(true)
    setError('')
    const resultado = await onConfirmar(pin, motivo.trim())
    setEnviando(false)
    if (resultado === null) return onCerrar()
    setError(resultado)
    setPin('')
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-overlay p-4 print:hidden">
      <form
        onSubmit={confirmar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-pin"
        className="m-auto flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-surface p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-modal-pin" className="text-lg font-semibold">{titulo}</h2>
            {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer rounded-full p-2 text-muted hover:bg-bg hover:text-text">
            <X className="size-4" />
          </button>
        </div>

        {aviso ? (
          <p role="alert" className="rounded-2xl bg-warning-surface p-4 text-sm">{aviso}</p>
        ) : (
          <>
            {pedirMotivo && (
              <div className="flex flex-col gap-2">
                <label htmlFor="modal-pin-motivo" className="text-sm">Motivo</label>
                <input id="modal-pin-motivo" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} className={claseCampoCaja} />
              </div>
            )}
            <CampoPinCaja id="modal-pin" valor={pin} onCambiar={setPin} />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={enviando} className={claseBotonCaja}>{enviando ? 'Guardando…' : textoBoton}</button>
          </>
        )}
      </form>
    </div>
  )
}
