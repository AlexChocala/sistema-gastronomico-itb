// Bloqueo temporal del login tras varios intentos fallidos con el mismo email.
//
// Esta cuenta es EN MEMORIA: cada instancia de Vercel lleva la suya. Alcanza para los emails
// que no existen; para un usuario real el bloqueo firme está en la base (Usuario.intentosFallidos
// y Usuario.bloqueadoHasta, ver lib/auth/auth.ts).

export const MAX_INTENTOS_FALLIDOS = 5
export const MINUTOS_BLOQUEO = 15
const VENTANA_MS = MINUTOS_BLOQUEO * 60 * 1000

type Registro = { fallos: number; desde: number; bloqueadoHasta: number }

const registros = new Map<string, Registro>()

function limpiarVencidos(ahora: number) {
  for (const [clave, registro] of registros) {
    if (registro.bloqueadoHasta <= ahora && ahora - registro.desde > VENTANA_MS) registros.delete(clave)
  }
}

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase()
}

// true si el email está bloqueado en este momento.
export function estaBloqueado(clave: string, ahora = Date.now()) {
  const registro = registros.get(clave)
  return registro !== undefined && registro.bloqueadoHasta > ahora
}

export function registrarFallo(clave: string, ahora = Date.now()) {
  if (registros.size > 1000) limpiarVencidos(ahora)
  const previo = registros.get(clave)
  // Pasada la ventana (o terminado un bloqueo), se empieza a contar de nuevo.
  const vigente = previo && ahora - previo.desde <= VENTANA_MS && previo.bloqueadoHasta <= ahora
  const fallos = (vigente ? previo.fallos : 0) + 1
  registros.set(clave, {
    fallos,
    desde: vigente ? previo.desde : ahora,
    bloqueadoHasta: fallos >= MAX_INTENTOS_FALLIDOS ? ahora + VENTANA_MS : 0,
  })
}

export function limpiarIntentos(clave: string) {
  registros.delete(clave)
}
