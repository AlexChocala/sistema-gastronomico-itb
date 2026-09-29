export class ErrorUsuario extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje)
  }
}

export function idValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 && valor <= 2147483647
}

export function leerId(valor: string): number {
  const id = Number(valor)
  if (!/^[1-9]\d*$/.test(valor) || !idValido(id)) {
    throw new ErrorUsuario(400, 'El identificador debe ser un entero mayor que cero.')
  }
  return id
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type DatosUsuario = {
  nombre?: string
  apellido?: string
  email?: string
  idRol?: number
  idSucursal?: number
  activo?: boolean
}

// Solo aceptamos campos editables; nunca la contraseña ni identificadores del usuario.
export function validarUsuario(cuerpo: unknown, parcial: boolean): DatosUsuario {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorUsuario(400, 'Enviá un objeto JSON con los datos del usuario.')
  }
  const datos = cuerpo as Record<string, unknown>
  const permitidos = ['nombre', 'apellido', 'email', 'idRol', 'idSucursal', ...(parcial ? ['activo'] : [])]
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((campo) => !permitidos.includes(campo))) {
    throw new ErrorUsuario(400, 'Enviá al menos un campo válido del usuario.')
  }
  const salida: DatosUsuario = {}
  if (!parcial || 'nombre' in datos) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 80) {
      throw new ErrorUsuario(400, 'El nombre debe tener entre 1 y 80 caracteres.')
    }
    salida.nombre = datos.nombre.trim()
  }
  if (!parcial || 'apellido' in datos) {
    if (typeof datos.apellido !== 'string' || !datos.apellido.trim() || datos.apellido.trim().length > 80) {
      throw new ErrorUsuario(400, 'El apellido debe tener entre 1 y 80 caracteres.')
    }
    salida.apellido = datos.apellido.trim()
  }
  if (!parcial || 'email' in datos) {
    if (typeof datos.email !== 'string' || !EMAIL_REGEX.test(datos.email.trim()) || datos.email.trim().length > 150) {
      throw new ErrorUsuario(400, 'Indicá un email válido.')
    }
    salida.email = datos.email.trim().toLowerCase()
  }
  if (!parcial || 'idRol' in datos) {
    if (!idValido(datos.idRol)) throw new ErrorUsuario(400, 'Indicá un rol válido.')
    salida.idRol = datos.idRol
  }
  if (!parcial || 'idSucursal' in datos) {
    if (!idValido(datos.idSucursal)) throw new ErrorUsuario(400, 'Indicá una sucursal válida.')
    salida.idSucursal = datos.idSucursal
  }
  if ('activo' in datos) {
    if (typeof datos.activo !== 'boolean') throw new ErrorUsuario(400, 'Activo debe ser true o false.')
    salida.activo = datos.activo
  }
  return salida
}

export async function leerCuerpo(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ErrorUsuario(415, 'Enviá los datos como application/json.')
  }
  try {
    return await request.json()
  } catch {
    throw new ErrorUsuario(400, 'El cuerpo de la solicitud no es un JSON válido.')
  }
}