// Textos comunes de los avisos, en dos tonos:
// - panel: directo e impersonal (personal del local).
// - cliente: cálido, en primera persona del plural (landing y menú digital).
// Las pantallas nuevas usan estos textos; las existentes se migran en la fase 2.

export const MENSAJES = {
  panel: {
    sinConexion: 'No se pudo conectar con el sistema. Revisá tu conexión e intentá de nuevo.',
    errorGenerico: 'No se pudo completar la operación. Intentá de nuevo en unos minutos.',
    cambiosGuardados: 'Cambios guardados.',
  },
  cliente: {
    sinConexion: 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',
    errorGenerico: 'Algo salió mal de nuestro lado. Intentá de nuevo en unos minutos.',
  },
} as const
