'use client'

import { ambitoParaRuta, CLAVES_TEMA, normalizarTema, type AmbitoTema, type Tema } from './tema'

const EVENTO_TEMA = 'mise:tema-cambiado'
// Si el navegador bloquea el almacenamiento, la elección sigue funcionando en esta página.
const temporales: Partial<Record<AmbitoTema, Tema>> = {}

export function leerTema(ambito: AmbitoTema): Tema {
  if (typeof window === 'undefined') return 'claro'
  if (temporales[ambito]) return temporales[ambito]
  try {
    return normalizarTema(window.localStorage.getItem(CLAVES_TEMA[ambito]))
  } catch {
    return 'claro'
  }
}

export function aplicarTema(tema: Tema, ambito: AmbitoTema) {
  document.documentElement.dataset.tema = tema
  document.documentElement.dataset.ambitoTema = ambito
}

function aplicarPreferenciaActual() {
  const ambito = ambitoParaRuta(window.location.pathname)
  aplicarTema(leerTema(ambito), ambito)
}

export function guardarTema(ambito: AmbitoTema, tema: Tema) {
  try {
    window.localStorage.setItem(CLAVES_TEMA[ambito], tema)
    delete temporales[ambito]
  } catch {
    temporales[ambito] = tema
  }
  aplicarPreferenciaActual()
  window.dispatchEvent(new Event(EVENTO_TEMA))
}

export function escucharTema(notificar: () => void) {
  function actualizar() {
    // El DOM se actualiza antes de notificar a React, también entre pestañas.
    aplicarPreferenciaActual()
    notificar()
  }
  function desdeOtraPestana(evento: StorageEvent) {
    if (evento.key !== null && !Object.values(CLAVES_TEMA).includes(evento.key)) return
    for (const ambito of ['personal', 'cliente'] as const) {
      if (evento.key === null || evento.key === CLAVES_TEMA[ambito]) delete temporales[ambito]
    }
    actualizar()
  }
  window.addEventListener(EVENTO_TEMA, actualizar)
  window.addEventListener('storage', desdeOtraPestana)
  return () => {
    window.removeEventListener(EVENTO_TEMA, actualizar)
    window.removeEventListener('storage', desdeOtraPestana)
  }
}

// Los gráficos de canvas deben releer los colores cuando el DOM ya tiene el tema,
// incluso después de navegar entre la carta y el panel sin recargar la página.
export function escucharTemaAplicado(notificar: () => void) {
  const observador = new MutationObserver(notificar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
  return () => observador.disconnect()
}

export function leerTemaAplicado(): Tema {
  return normalizarTema(document.documentElement.dataset.tema)
}
