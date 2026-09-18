import { ErrorProducto, idValido } from '@/lib/productos-validacion'

export type DatosCategoria = {
  nombre?: string
  descripcion?: string | null
  orden?: number
  activa?: boolean
}

export function validarCategoria(cuerpo: unknown, parcial: boolean): DatosCategoria {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorProducto(400, 'Enviá un objeto JSON con los datos de la categoría.')
  }

  const datos = cuerpo as Record<string, unknown>
  const permitidos = ['nombre', 'descripcion', 'orden', ...(parcial ? ['activa'] : [])]
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((campo) => !permitidos.includes(campo))) {
    throw new ErrorProducto(400, 'Enviá al menos un campo válido de la categoría.')
  }

  const salida: DatosCategoria = {}

  if (!parcial || 'nombre' in datos) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 80) {
      throw new ErrorProducto(400, 'El nombre debe tener entre 1 y 80 caracteres.')
    }
    salida.nombre = datos.nombre.trim()
  }

  if ('descripcion' in datos) {
    if (datos.descripcion !== null && (typeof datos.descripcion !== 'string' || datos.descripcion.length > 1000)) {
      throw new ErrorProducto(400, 'La descripción debe ser texto de hasta 1000 caracteres o null.')
    }
    salida.descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() || null : null
  }

  if (!parcial || 'orden' in datos) {
    if (!idValido(datos.orden) && datos.orden !== 0) {
      throw new ErrorProducto(400, 'El orden debe ser un número entero desde cero.')
    }
    salida.orden = datos.orden as number
  }

  if ('activa' in datos) {
    if (typeof datos.activa !== 'boolean') {
      throw new ErrorProducto(400, 'Activa debe ser true o false.')
    }
    salida.activa = datos.activa
  }

  return salida
}
