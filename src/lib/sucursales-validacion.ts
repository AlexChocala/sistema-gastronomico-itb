export class ErrorSucursal extends Error {
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
    throw new ErrorSucursal(400, 'El identificador debe ser un entero mayor que cero.')
  }
  return id
}

type DatosSucursal = {
  nombre?: string
  direccion?: string
  telefono?: string | null
  horario?: string | null
  idLocalidad?: number
  activa?: boolean
}

export function validarSucursal(cuerpo: unknown, parcial: boolean): DatosSucursal {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorSucursal(400, 'Enviá un objeto JSON con los datos de la sucursal.')
  }
  const datos = cuerpo as Record<string, unknown>
  const permitidos = ['nombre', 'direccion', 'telefono', 'horario', 'idLocalidad', ...(parcial ? ['activa'] : [])]
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((c) => !permitidos.includes(c))) {
    throw new ErrorSucursal(400, 'Enviá al menos un campo válido de la sucursal.')
  }
  const salida: DatosSucursal = {}
  if (!parcial || 'nombre' in datos) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 100) {
      throw new ErrorSucursal(400, 'El nombre debe tener entre 1 y 100 caracteres.')
    }
    salida.nombre = datos.nombre.trim()
  }
  if (!parcial || 'direccion' in datos) {
    if (typeof datos.direccion !== 'string' || !datos.direccion.trim() || datos.direccion.trim().length > 200) {
      throw new ErrorSucursal(400, 'La dirección debe tener entre 1 y 200 caracteres.')
    }
    salida.direccion = datos.direccion.trim()
  }
  if ('telefono' in datos) {
    if (datos.telefono !== null && typeof datos.telefono !== 'string') {
      throw new ErrorSucursal(400, 'El teléfono debe ser texto o null.')
    }
    const telefonoLimpio = typeof datos.telefono === 'string' ? datos.telefono.trim() : ''
    if (telefonoLimpio && !/^[\d\s\-+()]{6,30}$/.test(telefonoLimpio)) {
      throw new ErrorSucursal(400, 'El teléfono debe contener solo números, espacios, guiones o paréntesis (6 a 30 caracteres).')
    }
    salida.telefono = telefonoLimpio || null
  }
  if ('horario' in datos) {
    if (datos.horario !== null && (typeof datos.horario !== 'string' || datos.horario.length > 100)) {
      throw new ErrorSucursal(400, 'El horario debe ser texto de hasta 100 caracteres o null.')
    }
    const horarioLimpio = typeof datos.horario === 'string' ? datos.horario.trim() : ''
    if (horarioLimpio && !/\d/.test(horarioLimpio)) {
      throw new ErrorSucursal(400, 'El horario debe incluir al menos un número (ej: "9 a 22hs").')
    }
    salida.horario = horarioLimpio || null
  }
  if (!parcial || 'idLocalidad' in datos) {
    if (!idValido(datos.idLocalidad)) throw new ErrorSucursal(400, 'Indicá una localidad válida.')
    salida.idLocalidad = datos.idLocalidad
  }
  if ('activa' in datos) {
    if (typeof datos.activa !== 'boolean') throw new ErrorSucursal(400, 'Activa debe ser true o false.')
    salida.activa = datos.activa
  }
  return salida
}

export async function leerCuerpo(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ErrorSucursal(415, 'Enviá los datos como application/json.')
  }
  try {
    return await request.json()
  } catch {
    throw new ErrorSucursal(400, 'El cuerpo de la solicitud no es un JSON válido.')
  }
}