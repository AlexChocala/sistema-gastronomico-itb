'use client'

// PIN de caja de la persona, en Perfil. Con el PIN se identifica quién cobra en Caja y en
// "Entregado y cobrado". Son 4 números y no puede repetirse con el de otra persona.

import { useState, type FormEvent } from 'react'
import { LockKeyhole } from '@/components/icons'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'

export function CampoPin({ tienePin: tienePinInicial }: { tienePin: boolean }) {
  const [tienePin, setTienePin] = useState(tienePinInicial)
  const [pin, setPin] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setError('')
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN tiene que tener 4 números.')
      return
    }
    setGuardando(true)
    try {
      const respuesta = await fetch('/api/perfil/pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const datos = await respuesta.json().catch(() => null)
      if (!respuesta.ok) {
        setError(typeof datos?.error === 'string' ? datos.error : 'No se pudo guardar el PIN.')
        return
      }
      setTienePin(true)
      setPin('')
      setAviso('PIN guardado.')
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-2xl bg-bg p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
          <LockKeyhole className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">PIN de caja</p>
          <p>{tienePin ? 'Configurado' : 'Sin PIN'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          aria-label={tienePin ? 'Nuevo PIN' : 'PIN'}
          placeholder="4 números"
          className="w-36 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex cursor-pointer items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tienePin ? 'Cambiar PIN' : 'Guardar PIN'}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {aviso && <AvisoFlotante mensaje={aviso} onCerrar={() => setAviso('')} />}
    </form>
  )
}
