import { ErrorProducto, idValido } from './productos-validacion'

export type DatosExtra = {
  idCategoria?: number
  nombre?: string
  precioAdicional?: number
  idProductos?: number[]
  activo?: boolean
}

// Al crear se pide todo; al editar, cualquier campo menos idCategoria (no se cambia).
export function validarExtra(cuerpo: unknown, parcial: boolean): DatosExtra {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorProducto(400, 'Enviá un objeto JSON con los datos del extra.')
  }
  const datos = cuerpo as Record<string, unknown>
  const permitidos = parcial
    ? ['nombre', 'precioAdicional', 'idProductos', 'activo']
    : ['idCategoria', 'nombre', 'precioAdicional', 'idProductos']
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((campo) => !permitidos.includes(campo))) {
    throw new ErrorProducto(400, 'Enviá al menos un campo válido del extra.')
  }
  const salida: DatosExtra = {}
  if (!parcial) {
    if (!idValido(datos.idCategoria)) throw new ErrorProducto(400, 'Indicá una categoría válida.')
    salida.idCategoria = datos.idCategoria
  }
  if (!parcial || 'nombre' in datos) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 80) {
      throw new ErrorProducto(400, 'El nombre debe tener entre 1 y 80 caracteres.')
    }
    salida.nombre = datos.nombre.trim()
  }
  if (!parcial || 'precioAdicional' in datos) {
    if (
      typeof datos.precioAdicional !== 'number' ||
      !Number.isFinite(datos.precioAdicional) ||
      datos.precioAdicional < 0
    ) {
      throw new ErrorProducto(400, 'El precio adicional debe ser un número mayor o igual a cero.')
    }
    salida.precioAdicional = datos.precioAdicional
  }
  if (!parcial || 'idProductos' in datos) {
    if (
      !Array.isArray(datos.idProductos) ||
      datos.idProductos.length > 500 ||
      datos.idProductos.some((id) => !idValido(id)) ||
      new Set(datos.idProductos).size !== datos.idProductos.length
    ) {
      throw new ErrorProducto(400, 'Los productos deben ser una lista de ids válidos, sin repetir.')
    }
    salida.idProductos = datos.idProductos as number[]
  }
  if ('activo' in datos) {
    if (typeof datos.activo !== 'boolean') throw new ErrorProducto(400, 'Activo debe ser true o false.')
    salida.activo = datos.activo
  }
  return salida
}