// Formato del PIN de caja: 4 números. Sin dependencias de servidor, así lo usan también las
// pantallas y los validadores que corren en el navegador.

export const LARGO_PIN = 4
export const MENSAJE_PIN = 'El PIN tiene que tener 4 números.'

export function pinValido(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin)
}
