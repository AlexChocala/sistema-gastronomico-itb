'use client'

// Aviso sonoro para Cocina: suena cuando entra un pedido que antes no estaba en la lista.
// Usa un beep de Web Audio (sin archivos ni dependencias). Los navegadores no dejan sonar
// hasta que la persona toca la pantalla una vez: por eso `sonidoActivo` arranca en falso (y
// se vuelve a apagar al recargar) hasta que se toca la pantalla o el botón del parlante.

import { useEffect, useRef, useState } from 'react'

function crearAudio(): AudioContext | null {
  const Contexto = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Contexto ? new Contexto() : null
}

function sonar(audio: AudioContext) {
  // Dos tonos cortos: se distingue de otros sonidos del local.
  const inicio = audio.currentTime
  for (const [indice, frecuencia] of [880, 1175].entries()) {
    const oscilador = audio.createOscillator()
    const volumen = audio.createGain()
    const desde = inicio + indice * 0.22
    oscilador.frequency.value = frecuencia
    volumen.gain.setValueAtTime(0.0001, desde)
    volumen.gain.exponentialRampToValueAtTime(0.3, desde + 0.02)
    volumen.gain.exponentialRampToValueAtTime(0.0001, desde + 0.2)
    oscilador.connect(volumen).connect(audio.destination)
    oscilador.start(desde)
    oscilador.stop(desde + 0.22)
  }
}

export function useAvisoPedidosNuevos(ids: number[], listo: boolean) {
  const audio = useRef<AudioContext | null>(null)
  const conocidos = useRef<Set<number> | null>(null)
  const [sonidoActivo, setSonidoActivo] = useState(false)

  function activar() {
    audio.current ??= crearAudio()
    void audio.current?.resume().then(() => {
      setSonidoActivo(audio.current?.state === 'running')
      if (audio.current?.state === 'running') sonar(audio.current)
    })
  }

  // Habilita el audio con el primer toque en la pantalla.
  useEffect(() => {
    function habilitar() {
      audio.current ??= crearAudio()
      void audio.current?.resume().then(() => setSonidoActivo(audio.current?.state === 'running'))
    }
    window.addEventListener('pointerdown', habilitar)
    window.addEventListener('keydown', habilitar)
    return () => {
      window.removeEventListener('pointerdown', habilitar)
      window.removeEventListener('keydown', habilitar)
    }
  }, [])

  // El primer listado cargado no suena: solo los pedidos que llegan después.
  const clave = ids.join(',')
  useEffect(() => {
    if (!listo) return
    const actuales = new Set(ids)
    const previos = conocidos.current
    conocidos.current = actuales
    if (!previos) return
    const hayNuevo = ids.some((id) => !previos.has(id))
    if (hayNuevo && audio.current?.state === 'running') sonar(audio.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, listo])

  return { sonidoActivo, activar }
}
