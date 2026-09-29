// Contrato entre el frontend y el backend para la administración de extras.
//
// Cada extra pertenece a una categoría (Extra.idCategoria) y solo se asigna a productos
// de esa categoría: el cheddar de hamburguesas no es el de panchos, y una categoría sin
// extras (ej. bebidas) simplemente no tiene ninguno.
//
// Endpoints de extras (solo admin; responden 401 sin sesión y 403 si no es admin):
//   GET    /api/productos/extras       → 200 RespuestaListadoExtras
//   POST   /api/productos/extras       ← DatosNuevoExtra          → 201 RespuestaExtra
//   PATCH  /api/productos/extras/[id]  ← CambiosExtra (parcial)   → 200 RespuestaExtra
//   DELETE /api/productos/extras/[id]                             → 200 RespuestaDesactivarExtra
//   DELETE no borra: pone activo = false. Para reactivar se usa PATCH { activo: true }.
//
// Validaciones del backend (los errores se responden como RespuestaErrorExtras):
//   - idCategoria: categoría existente y activa → 400. No se cambia después de crear el extra.
//   - nombre: se recorta y debe tener de 1 a 80 caracteres (como Categoría) → 400. No se
//     repite dentro de la misma categoría, sin distinguir mayúsculas (se valida en el
//     código, no en la base) → 409.
//   - precioAdicional: número finito >= 0 (0 = extra sin cargo) → 400.
//   - idProductos: productos activos de la misma categoría del extra, sin repetir → 400.
//     Reemplaza las asignaciones a productos activos; las de productos inactivos no se tocan.
//   - Campos desconocidos o cuerpo vacío → 400. Id inexistente → 404.

export type Extra = {
  idExtra: number
  idCategoria: number
  nombre: string
  precioAdicional: number
  activo: boolean
  // Productos activos que lo tienen habilitado (ProductoExtra).
  productos: { idProducto: number }[]
}

// Categorías activas, por orden y nombre (las pestañas de la pantalla).
export type CategoriaDeExtras = { idCategoria: number; nombre: string }
// Productos activos de esas categorías, por nombre (las casillas del modal del extra).
export type ProductoDeCategoria = { idProducto: number; idCategoria: number; nombre: string }

export type RespuestaListadoExtras = {
  categorias: CategoriaDeExtras[]
  productos: ProductoDeCategoria[]
  // Activos e inactivos de las categorías activas, por nombre.
  extras: Extra[]
}

export type DatosNuevoExtra = { idCategoria: number; nombre: string; precioAdicional: number; idProductos: number[] }
export type CambiosExtra = Partial<Omit<DatosNuevoExtra, 'idCategoria'> & { activo: boolean }>

export type RespuestaExtra = { extra: Extra }
export type RespuestaDesactivarExtra = { mensaje: string; extra: Extra }
export type RespuestaErrorExtras = { error: string }

// Extras dentro de la API de productos (admin y supervisor):
//   GET /api/productos/gestion suma al listado:
//     - `extras: ExtraDisponible[]`: los extras activos de todas las categorías, por nombre
//       (el formulario muestra los de la categoría elegida).
//     - en cada producto, `extras: ExtraAsignado[]`: sus extras activos asignados.
//   POST  /api/productos/gestion       ← suma `idExtras: number[]` (obligatorio, puede ser []).
//   PATCH /api/productos/gestion/[id]  ← suma `idExtras?: number[]` (si no viene, no cambia).
//   `idExtras` reemplaza los extras activos del producto; las asignaciones a extras
//   inactivos no se tocan. Ids repetidos, inexistentes, inactivos o de otra categoría → 400.
//   Si el producto cambia de categoría, se quitan sus extras de la categoría anterior.
// GET /api/productos/categorias suma `extras` a `_count` de cada categoría.

export type ExtraDisponible = Pick<Extra, 'idExtra' | 'idCategoria' | 'nombre' | 'precioAdicional'>
export type ExtraAsignado = { idExtra: number }
export type ExtrasDelProducto = { idExtras: number[] }
