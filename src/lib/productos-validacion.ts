export class ErrorProducto extends Error {
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
    throw new ErrorProducto(400, 'El identificador debe ser un entero mayor que cero.')
  }
  return id
}

type DatosProducto = {
  nombre?: string
  descripcion?: string | null
  precio?: number
  idCategoria?: number
  activo?: boolean
}

// Solo aceptamos campos editables; nunca relaciones o identificadores del producto.
export function validarProducto(cuerpo: unknown, parcial: boolean): DatosProducto {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorProducto(400, 'Enviá un objeto JSON con los datos del producto.')
  }
  const datos = cuerpo as Record<string, unknown>
  const permitidos = ['nombre', 'descripcion', 'precio', 'idCategoria', ...(parcial ? ['activo'] : [])]
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((campo) => !permitidos.includes(campo))) {
    throw new ErrorProducto(400, 'Enviá al menos un campo válido del producto.')
  }
  const salida: DatosProducto = {}
  if (!parcial || 'nombre' in datos) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 120) {
      throw new ErrorProducto(400, 'El nombre debe tener entre 1 y 120 caracteres.')
    }
    salida.nombre = datos.nombre.trim()
  }
  if ('descripcion' in datos) {
    if (datos.descripcion !== null && (typeof datos.descripcion !== 'string' || datos.descripcion.length > 2000)) {
      throw new ErrorProducto(400, 'La descripción debe ser texto de hasta 2000 caracteres o null.')
    }
    salida.descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() || null : null
  }
  if (!parcial || 'precio' in datos) {
    if (typeof datos.precio !== 'number' || !Number.isFinite(datos.precio) || datos.precio <= 0) {
      throw new ErrorProducto(400, 'El precio debe ser un número mayor que cero.')
    }
    salida.precio = datos.precio
  }
  if (!parcial || 'idCategoria' in datos) {
    if (!idValido(datos.idCategoria)) throw new ErrorProducto(400, 'Indicá una categoría válida.')
    salida.idCategoria = datos.idCategoria
  }
  if ('activo' in datos) {
    if (typeof datos.activo !== 'boolean') throw new ErrorProducto(400, 'Activo debe ser true o false.')
    salida.activo = datos.activo
  }
  return salida
}

export async function leerCuerpo(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ErrorProducto(415, 'Enviá los datos como application/json.')
  }
  try {
    return await request.json()
  } catch {
    throw new ErrorProducto(400, 'El cuerpo de la solicitud no es un JSON válido.')
  }
}
