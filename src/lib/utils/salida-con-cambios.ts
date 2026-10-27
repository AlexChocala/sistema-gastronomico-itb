// Permite consultar los formularios pendientes antes de cerrar la sesión.
// No guarda borradores ni modifica datos del usuario.
export const EVENTO_CONFIRMAR_SALIDA = 'mise-confirmar-salida-con-cambios'
export const EVENTO_CANCELAR_SALIDA = 'mise-cancelar-salida-con-cambios'

export function confirmarSalidaConCambios() {
  return window.dispatchEvent(new Event(EVENTO_CONFIRMAR_SALIDA, { cancelable: true }))
}

export function cancelarSalidaConCambios() {
  window.dispatchEvent(new Event(EVENTO_CANCELAR_SALIDA))
}
