'use client'

// Campanita del personal: cuenta las transferencias online sin verificar de la sucursal
// activa y permite confirmarlas sin ir a Pedidos. Suena cuando llega una nueva.

import { useEffect, useRef, useState } from 'react'
import { Bell } from '@/components/icons'
import { ListaNotificaciones } from '@/components/notificaciones/ListaNotificaciones'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'
import { usePedidosPantalla } from '@/lib/pedidos/pedidos-pantallas'
import { useCerrarAlSalir } from '@/lib/utils/useCerrarAlSalir'

// "Ding" corto. Si el navegador no deja reproducir audio (sin interacción previa), no suena.
function sonarDing() {
  try {
    const audio = new AudioContext()
    const oscilador = audio.createOscillator()
    const volumen = audio.createGain()
    oscilador.frequency.value = 880
    volumen.gain.setValueAtTime(0.08, audio.currentTime)
    volumen.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15)
    oscilador.connect(volumen).connect(audio.destination)
    oscilador.onended = () => void audio.close()
    oscilador.start()
    oscilador.stop(audio.currentTime + 0.15)
  } catch {}
}

export function Campanita() {
  const { sucursal } = useSucursalActiva()
  const { pedidos, cargando, confirmarPago, deshacer, errorAccion, limpiarErrorAccion } =
    usePedidosPantalla(sucursal?.idSucursal ?? null)
  const pendientes = pedidos.filter((pedido) => pedido.origen === 'online' && pedido.estado === 'pendiente_pago')
  const cantidad = pendientes.length

  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [confirmado, setConfirmado] = useState<number | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  // null mientras carga: la primera lista (o la de otra sucursal) no suena.
  const cantidadAnterior = useRef<number | null>(null)

  useEffect(() => {
    if (cargando) {
      cantidadAnterior.current = null
      return
    }
    if (cantidadAnterior.current !== null && cantidad > cantidadAnterior.current) sonarDing()
    cantidadAnterior.current = cantidad
  }, [cantidad, cargando])

  useCerrarAlSalir(abierto, setAbierto, contenedor, boton)

  async function confirmar(idPedido: number) {
    setConfirmando(idPedido)
    setConfirmado(null)
    const resultado = await confirmarPago(idPedido)
    setConfirmando((actual) => (actual === idPedido ? null : actual))
    if (resultado.ok) setConfirmado(idPedido)
  }

  function deshacerConfirmacion() {
    if (confirmado === null) return
    setConfirmado(null)
    void deshacer(confirmado, 'pendiente_pago')
  }

  return (
    // El aviso queda dentro del contenedor para que tocar "Deshacer" no cierre el panel.
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label="Notificaciones"
        aria-expanded={abierto}
        aria-haspopup="true"
        className="relative flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface text-muted shadow-sm transition-colors hover:text-text"
      >
        <Bell strokeWidth={1.75} className="size-5" />
        {cantidad > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-on-primary">
            {cantidad > 9 ? '9+' : cantidad}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute top-full right-0 z-40 mt-2">
          <ListaNotificaciones
            pedidos={pendientes}
            confirmando={confirmando}
            onConfirmar={(idPedido) => void confirmar(idPedido)}
            onVerPedido={() => setAbierto(false)}
          />
        </div>
      )}

      {errorAccion ? (
        <AvisoFlotante mensaje={errorAccion} onCerrar={limpiarErrorAccion} />
      ) : confirmado !== null && (
        <AvisoFlotante
          mensaje={`Pago del pedido #${confirmado} confirmado.`}
          accion={{ texto: 'Deshacer', onClick: deshacerConfirmacion }}
          onCerrar={() => setConfirmado(null)}
          // El botón "Confirmar" desaparece de la lista: el foco pasa a "Deshacer".
          enfocarAccion
        />
      )}
    </div>
  )
}
