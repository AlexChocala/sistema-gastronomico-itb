import { ErrorSucursal } from './sucursales-validacion'

type DatosLocalidad = {
  nombre: string
  nombreProvincia: string
}

export function validarLocalidadNueva(cuerpo: unknown): DatosLocalidad {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    throw new ErrorSucursal(400, 'Datos de localidad inválidos.')
  }
  const datos = cuerpo as Record<string, unknown>
  if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 100) {
    throw new ErrorSucursal(400, 'El nombre de la localidad debe tener entre 1 y 100 caracteres.')
  }
  if (typeof datos.nombreProvincia !== 'string' || !datos.nombreProvincia.trim() || datos.nombreProvincia.trim().length > 100) {
    throw new ErrorSucursal(400, 'El nombre de la provincia debe tener entre 1 y 100 caracteres.')
  }
  return { nombre: datos.nombre.trim(), nombreProvincia: datos.nombreProvincia.trim() }
}