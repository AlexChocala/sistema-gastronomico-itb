'use client'

// Cierra un desplegable al tocar afuera de `contenedor` o con Escape (en ese caso el foco
// vuelve a `boton`). Lo usan la campanita, el menú del usuario y el selector de sucursal.

import { useEffect, type RefObject } from 'react'

export function useCerrarAlSalir(
  abierto: boolean,
  setAbierto: (abierto: boolean) => void,
  contenedor: RefObject<HTMLElement | null>,
  boton: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!abierto) return
    function alTocarAfuera(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false)
    }
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    document.addEventListener('pointerdown', alTocarAfuera)
    document.addEventListener('keydown', alPresionarTecla)
    return () => {
      document.removeEventListener('pointerdown', alTocarAfuera)
      document.removeEventListener('keydown', alPresionarTecla)
    }
  }, [abierto, setAbierto, contenedor, boton])
}
