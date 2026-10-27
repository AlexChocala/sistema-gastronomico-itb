'use client'

import { useEffect } from 'react'
import { EVENTO_CANCELAR_SALIDA, EVENTO_CONFIRMAR_SALIDA } from './salida-con-cambios'

const AVISO = 'Tenés cambios en el horario sin guardar. Si salís, se perderán. ¿Querés salir sin guardarlos?'

// Navigation API aún no está declarada en la versión de lib.dom del proyecto.
type EventoNavegacion = Event & {
  destination: { url: string; sameDocument: boolean }
  hashChange: boolean; downloadRequest: string | null
}

export function useCambiosSinGuardar(hayCambios: boolean) {
  useEffect(() => {
    if (!hayCambios) return
    const navegacion = (window as Window & { navigation?: EventTarget }).navigation
    let enlacePermitido: string | null = null
    let cerrandoSesion = false
    let salidaCompletaPermitida = false
    let finDelClic: ReturnType<typeof setTimeout> | undefined
    let vencimiento: ReturnType<typeof setTimeout> | undefined
    function limpiarPermiso() { enlacePermitido = null; salidaCompletaPermitida = false; clearTimeout(vencimiento); clearTimeout(finDelClic) }
    function permitirEnlace(url: string) {
      enlacePermitido = url
      clearTimeout(vencimiento)
      // Si el destino falla y el formulario sigue abierto, vuelve a quedar protegido.
      vencimiento = setTimeout(limpiarPermiso, 10000)
    }
    function confirmar() { return window.confirm(AVISO) }
    function otraVista(url: URL) {
      return url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search
    }
    function alSalir(evento: BeforeUnloadEvent) {
      if (cerrandoSesion || salidaCompletaPermitida) { limpiarPermiso(); return }
      evento.preventDefault()
      evento.returnValue = ''
    }
    function alPulsarEnlace(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return
      const enlace = evento.target instanceof Element ? evento.target.closest('a[href]') : null
      if (!(enlace instanceof HTMLAnchorElement) || enlace.hasAttribute('download') || (enlace.target && enlace.target !== '_self') || enlace.getAttribute('aria-disabled') === 'true') return
      const destino = new URL(enlace.href, location.href)
      // Las otras pestañas y las descargas no cierran el editor. Las salidas externas
      // quedan cubiertas por beforeunload, con el aviso propio del navegador.
      if (destino.origin !== location.origin || !otraVista(destino)) return
      if (!confirmar()) { evento.preventDefault(); evento.stopImmediatePropagation(); return }
      permitirEnlace(destino.href)
      if (!navegacion) {
        // Sin Navigation API, solo se autoriza la salida inmediata de este clic.
        // Un enlace SPA fallido no debe dejar una recarga posterior desprotegida.
        salidaCompletaPermitida = true
        finDelClic = setTimeout(() => { salidaCompletaPermitida = false }, 0)
      }
    }
    function alNavegar(evento: Event) {
      const e = evento as EventoNavegacion
      if (!e.destination.sameDocument) {
        salidaCompletaPermitida = enlacePermitido === e.destination.url
        return
      }
      if (!e.cancelable || e.defaultPrevented || e.hashChange || e.downloadRequest !== null) return
      if (!otraVista(new URL(e.destination.url))) return
      if (cerrandoSesion || enlacePermitido === e.destination.url) { limpiarPermiso(); return }
      // Cubre Atrás/Adelante y la navegación programática cuando el navegador la admite.
      if (!confirmar()) e.preventDefault()
    }
    function alCerrarSesion(evento: Event) {
      if (evento.defaultPrevented) return
      if (!confirmar()) { evento.preventDefault(); return }
      cerrandoSesion = true
    }
    function cancelarCierre() { cerrandoSesion = false; limpiarPermiso() }
    window.addEventListener('beforeunload', alSalir)
    document.addEventListener('click', alPulsarEnlace, true)
    window.addEventListener(EVENTO_CONFIRMAR_SALIDA, alCerrarSesion)
    window.addEventListener(EVENTO_CANCELAR_SALIDA, cancelarCierre)
    navegacion?.addEventListener('navigate', alNavegar)
    navegacion?.addEventListener('navigatesuccess', limpiarPermiso)
    navegacion?.addEventListener('navigateerror', limpiarPermiso)
    return () => {
      clearTimeout(vencimiento)
      clearTimeout(finDelClic)
      window.removeEventListener('beforeunload', alSalir)
      document.removeEventListener('click', alPulsarEnlace, true)
      window.removeEventListener(EVENTO_CONFIRMAR_SALIDA, alCerrarSesion)
      window.removeEventListener(EVENTO_CANCELAR_SALIDA, cancelarCierre)
      navegacion?.removeEventListener('navigate', alNavegar)
      navegacion?.removeEventListener('navigatesuccess', limpiarPermiso)
      navegacion?.removeEventListener('navigateerror', limpiarPermiso)
    }
  }, [hayCambios])
}
