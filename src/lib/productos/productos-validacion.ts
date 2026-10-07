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

// Variaciones de un producto (tamaño o cantidad: "Chica", "Docena"...). Mismos topes para
// los nombres sugeridos de la categoría (Categoria.nombresVariaciones).
export const MAX_VARIACIONES = 10
export const MAX_NOMBRE_VARIACION = 40

// Nombres de variaciones: texto recortado, de 1 a MAX_NOMBRE_VARIACION caracteres, sin
// repetir (sin distinguir mayúsculas) y hasta MAX_VARIACIONES.
export function validarNombresVariaciones(valor: unknown): string[] {
  if (!Array.isArray(valor) || valor.length > MAX_VARIACIONES) {
    throw new ErrorProducto(400, `Las variaciones deben ser una lista de hasta ${MAX_VARIACIONES} nombres.`)
  }
  const nombres = valor.map((nombre) => {
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > MAX_NOMBRE_VARIACION) {
      throw new ErrorProducto(400, `Cada variación debe tener entre 1 y ${MAX_NOMBRE_VARIACION} caracteres.`)
    }
    return nombre.trim()
  })
  if (new Set(nombres.map((nombre) => nombre.toLowerCase())).size !== nombres.length) {
    throw new ErrorProducto(400, 'Hay variaciones con el mismo nombre.')
  }
  return nombres
}

// idVariacion: la que ya existe y se edita; sin id = nueva.
export type VariacionProducto = { idVariacion?: number; nombre: string; precioAdicional: number }

// precioAdicional es la diferencia con el precio del producto, que es siempre el de la
// variación más barata: ninguno es negativo y al menos uno es 0.
function validarVariaciones(valor: unknown): VariacionProducto[] {
  if (!Array.isArray(valor)) throw new ErrorProducto(400, 'Las variaciones deben ser una lista.')
  const variaciones = valor.map((elemento): VariacionProducto => {
    if (typeof elemento !== 'object' || elemento === null || Array.isArray(elemento)) {
      throw new ErrorProducto(400, 'Hay una variación con datos inválidos.')
    }
    const datos = elemento as Record<string, unknown>
    if (Object.keys(datos).some((campo) => !['idVariacion', 'nombre', 'precioAdicional'].includes(campo))) {
      throw new ErrorProducto(400, 'Hay una variación con campos que no se reconocen.')
    }
    if (datos.idVariacion !== undefined && !idValido(datos.idVariacion)) {
      throw new ErrorProducto(400, 'Hay una variación con un identificador inválido.')
    }
    const { precioAdicional } = datos
    if (typeof precioAdicional !== 'number' || !Number.isFinite(precioAdicional) || precioAdicional < 0) {
      throw new ErrorProducto(400, 'El precio de cada variación no puede ser menor al del producto.')
    }
    return {
      ...(datos.idVariacion !== undefined ? { idVariacion: datos.idVariacion as number } : {}),
      nombre: datos.nombre as string,
      precioAdicional,
    }
  })
  // Reusa la regla de nombres (largo, sin repetir y el tope de cantidad).
  validarNombresVariaciones(variaciones.map((variacion) => variacion.nombre)).forEach((nombre, indice) => {
    variaciones[indice].nombre = nombre
  })
  const ids = variaciones.flatMap((variacion) => (variacion.idVariacion === undefined ? [] : [variacion.idVariacion]))
  if (new Set(ids).size !== ids.length) throw new ErrorProducto(400, 'Hay una variación repetida.')
  if (variaciones.length > 0 && !variaciones.some((variacion) => variacion.precioAdicional === 0)) {
    throw new ErrorProducto(400, 'El precio del producto tiene que ser el de su variación más barata.')
  }
  return variaciones
}

type DatosProducto = {
  nombre?: string
  descripcion?: string | null
  precio?: number
  idCategoria?: number
  idSucursales?: number[]
  idExtras?: number[]
  variaciones?: VariacionProducto[]
  activo?: boolean
}

// Solo aceptamos campos editables; nunca relaciones o identificadores del producto.
export function validarProducto(cuerpo: unknown, parcial: boolean): DatosProducto {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorProducto(400, 'Enviá un objeto JSON con los datos del producto.')
  }
  const datos = cuerpo as Record<string, unknown>
  const permitidos = [
    'nombre', 'descripcion', 'precio', 'idCategoria', 'idSucursales', 'idExtras', 'variaciones',
    ...(parcial ? ['activo'] : []),
  ]
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
  if (!parcial || 'idSucursales' in datos) {
    if (
      !Array.isArray(datos.idSucursales) ||
      datos.idSucursales.length === 0 ||
      datos.idSucursales.length > 100 ||
      datos.idSucursales.some((id) => !idValido(id)) ||
      new Set(datos.idSucursales).size !== datos.idSucursales.length
    ) {
      throw new ErrorProducto(400, 'Elegí al menos una sucursal válida, sin repetirla.')
    }
    salida.idSucursales = datos.idSucursales as number[]
  }
  if (!parcial || 'idExtras' in datos) {
    if (
      !Array.isArray(datos.idExtras) ||
      datos.idExtras.length > 100 ||
      datos.idExtras.some((id) => !idValido(id)) ||
      new Set(datos.idExtras).size !== datos.idExtras.length
    ) {
      throw new ErrorProducto(400, 'Los extras deben ser una lista de ids válidos, sin repetir.')
    }
    salida.idExtras = datos.idExtras as number[]
  }
  // Opcional también al crear: un producto sin variaciones se vende en un solo tamaño.
  if ('variaciones' in datos) {
    salida.variaciones = validarVariaciones(datos.variaciones)
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