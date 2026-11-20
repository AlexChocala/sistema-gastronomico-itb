'use client'

// Abrir y cerrar la caja. La apertura reemplaza a la pantalla de Caja mientras no haya turno
// abierto; el cierre es una ventana con el arqueo (lo que se cuenta contra lo que el sistema
// espera). Las dos piden el PIN de quien lo hace, que queda registrado.

import { useState, type FormEvent } from 'react'
import { CircleCheck, TriangleAlert, Wallet, X } from '@/components/icons'
import { PastillaSucursal } from '@/components/sucursal/SucursalActiva'
import { formatearPrecio } from '@/lib/utils/precio'
import type { CajaConTurno, ResumenCierre } from '@/lib/caja/turnos-cliente'
import { CampoMonto, CampoPinCaja, claseBotonCaja, claseCampoCaja } from './CamposCaja'

const textoError = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar. Intentá de nuevo.')

export function AperturaCaja({
  cajas, caja, onElegirCaja, onAbrir,
}: {
  cajas: CajaConTurno[]
  caja: CajaConTurno
  onElegirCaja: (idCaja: number) => void
  onAbrir: (montoInicial: number, pin: string) => Promise<void>
}) {
  const [monto, setMonto] = useState('')
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function abrir(evento: FormEvent) {
    evento.preventDefault()
    if (monto === '') return setError('Indicá con cuánto efectivo se abre la caja (puede ser 0).')
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene que tener 4 números.')
    setEnviando(true)
    setError('')
    try {
      await onAbrir(Number(monto), pin)
    } catch (e) {
      setError(textoError(e))
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-bg p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Caja</h1>
        <PastillaSucursal />
      </header>
      <div className="m-auto w-full max-w-sm rounded-3xl bg-surface p-6 shadow-sm">
        <form onSubmit={abrir} className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Wallet className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">Abrir caja</h2>
          </div>

          {cajas.length > 1 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="apertura-caja" className="text-sm">Caja</label>
              <select
                id="apertura-caja"
                value={caja.idCaja}
                onChange={(e) => onElegirCaja(Number(e.target.value))}
                className={claseCampoCaja}
              >
                {cajas.map((c) => (
                  <option key={c.idCaja} value={c.idCaja}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <CampoMonto id="apertura-monto" etiqueta="Efectivo inicial" valor={monto} onCambiar={setMonto} />
          <CampoPinCaja id="apertura-pin" valor={pin} onCambiar={setPin} />

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={enviando} className={claseBotonCaja}>{enviando ? 'Abriendo…' : 'Abrir caja'}</button>
        </form>
      </div>
    </main>
  )
}

export function CierreCaja({
  caja, porCobrar = 0, onCerrar, onSalir,
}: {
  caja: CajaConTurno
  // Pedidos con efectivo por cobrar al entregar: esa plata va a entrar a un turno que se abra después.
  porCobrar?: number
  onCerrar: (efectivoContado: number, pin: string, observacion?: string) => Promise<ResumenCierre>
  onSalir: () => void
}) {
  const [contado, setContado] = useState('')
  const [pin, setPin] = useState('')
  const [observacion, setObservacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState<ResumenCierre | null>(null)

  async function cerrar(evento: FormEvent) {
    evento.preventDefault()
    if (contado === '') return setError('Contá el efectivo de la caja e ingresalo.')
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene que tener 4 números.')
    setEnviando(true)
    setError('')
    try {
      setResumen(await onCerrar(Number(contado), pin, observacion.trim() || undefined))
    } catch (e) {
      setError(textoError(e))
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-overlay p-4 print:hidden">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-cierre" className="m-auto flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-surface p-6 shadow-xl">
        {resumen ? (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              {resumen.diferencia === 0
                ? <CircleCheck className="size-10 text-success" aria-hidden="true" />
                : <TriangleAlert className="size-10 text-warning" aria-hidden="true" />}
              <h2 id="titulo-cierre" className="text-lg font-semibold">
                {resumen.diferencia === 0 ? 'Caja cuadrada' : resumen.diferencia > 0 ? 'Sobra efectivo' : 'Falta efectivo'}
              </h2>
              {resumen.diferencia !== 0 && (
                <p className="text-3xl font-bold">{formatearPrecio(Math.abs(resumen.diferencia))}</p>
              )}
            </div>
            <dl className="flex flex-col gap-1 rounded-2xl bg-bg p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Esperado</dt><dd>{formatearPrecio(resumen.efectivoEsperado)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Contado</dt><dd>{formatearPrecio(resumen.efectivoContado)}</dd></div>
            </dl>
            <button type="button" onClick={onSalir} className={claseBotonCaja}>Listo</button>
          </>
        ) : (
          <form onSubmit={cerrar} className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="titulo-cierre" className="text-lg font-semibold">Cerrar {caja.nombre}</h2>
              <button type="button" onClick={onSalir} aria-label="Cancelar" className="cursor-pointer rounded-full p-2 text-muted hover:bg-bg hover:text-text">
                <X className="size-4" />
              </button>
            </div>
            {porCobrar > 0 && (
              <p role="status" className="rounded-2xl bg-warning-surface p-4 text-sm">
                {porCobrar === 1 ? 'Queda 1 pedido' : `Quedan ${porCobrar} pedidos`} con efectivo por cobrar al entregar. Para registrar ese cobro hay que abrir la caja de nuevo.
              </p>
            )}
            <CampoMonto id="cierre-contado" etiqueta="Efectivo contado" valor={contado} onCambiar={setContado} />
            <div className="flex flex-col gap-2">
              <label htmlFor="cierre-observacion" className="text-sm">Observación (opcional)</label>
              <input id="cierre-observacion" value={observacion} maxLength={200} onChange={(e) => setObservacion(e.target.value)} className={claseCampoCaja} />
            </div>
            <CampoPinCaja id="cierre-pin" valor={pin} onCambiar={setPin} />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={enviando} className={claseBotonCaja}>{enviando ? 'Cerrando…' : 'Cerrar caja'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
