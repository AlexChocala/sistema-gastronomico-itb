// Cuánto hace que pasó algo con un pedido (llegó a Cocina, se marcó listo), para las
// pantallas de Cocina: ahí importa más la espera ("Hace 12 min") que la hora exacta.

import { useEffect, useState } from 'react'

// Hora actual que se actualiza sola; sin esto "hace 3 min" se quedaría clavado.
export function useAhora(cadaMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(id)
  }, [cadaMs])
  return ahora
}

// Minutos de espera a partir de los cuales el tiempo se marca como demora.
export const MINUTOS_DEMORA = 10
export const MINUTOS_DEMORA_GRAVE = 20

export function esperaDe(fechaIso: string, ahora: number) {
  const minutos = Math.max(0, Math.floor((ahora - new Date(fechaIso).getTime()) / 60_000))
  let texto: string
  if (minutos < 1) texto = 'Ahora'
  else if (minutos < 60) texto = `Hace ${minutos} min`
  else if (minutos < 24 * 60) {
    const horas = Math.floor(minutos / 60)
    const resto = minutos % 60
    texto = resto === 0 ? `Hace ${horas} h` : `Hace ${horas} h ${resto} min`
  } else {
    const dias = Math.floor(minutos / (24 * 60))
    texto = `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  }
  return { texto, minutos }
}

// Color del tiempo de espera según los minutos que pasaron: verde (reciente), amarillo
// (se está demorando) y rojo (demorado).
export function colorEspera(minutos: number) {
  if (minutos >= MINUTOS_DEMORA_GRAVE) return 'text-danger font-semibold'
  if (minutos >= MINUTOS_DEMORA) return 'text-warning font-semibold'
  return 'text-order-ready font-semibold'
}
