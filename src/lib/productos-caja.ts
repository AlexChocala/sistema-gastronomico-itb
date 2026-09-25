// Productos que muestra la pantalla de Caja.
//
// La API ya existe (GET /api/productos?idSucursal=N), pero hoy la base no tiene
// sucursales ni productos cargados, así que se usan datos de prueba.
// Cuando haya datos reales, se reemplaza SOLO este archivo (ver el TODO).

export interface ProductoCaja {
  idProducto: number
  nombre: string
  categoria: string
  precio: number
  disponible: boolean
}

// TODO: borrar cuando haya productos cargados en la base.
const productosDePrueba: ProductoCaja[] = [
  { idProducto: 1, nombre: 'Hamburguesa simple', categoria: 'Hamburguesas', precio: 7500, disponible: true },
  { idProducto: 2, nombre: 'Hamburguesa doble completa', categoria: 'Hamburguesas', precio: 11200, disponible: true },
  { idProducto: 3, nombre: 'Hamburguesa triple simple', categoria: 'Hamburguesas', precio: 12900, disponible: false },
  { idProducto: 4, nombre: 'Pizza muzzarella', categoria: 'Pizzas', precio: 9800, disponible: true },
  { idProducto: 5, nombre: 'Pizza jamón y morrón', categoria: 'Pizzas', precio: 11500, disponible: true },
  { idProducto: 6, nombre: 'Pizza fugazzeta', categoria: 'Pizzas', precio: 10900, disponible: true },
  { idProducto: 7, nombre: 'Empanada de carne', categoria: 'Empanadas', precio: 1600, disponible: true },
  { idProducto: 8, nombre: 'Empanada de jamón y queso', categoria: 'Empanadas', precio: 1600, disponible: false },
  { idProducto: 9, nombre: 'Milanesa napolitana con papas', categoria: 'Platos', precio: 13500, disponible: true },
  { idProducto: 10, nombre: 'Ensalada César', categoria: 'Platos', precio: 8200, disponible: true },
  { idProducto: 11, nombre: 'Coca-Cola 500 ml', categoria: 'Bebidas', precio: 2500, disponible: true },
  { idProducto: 12, nombre: 'Agua sin gas 500 ml', categoria: 'Bebidas', precio: 1800, disponible: true },
  { idProducto: 13, nombre: 'Flan con dulce de leche', categoria: 'Postres', precio: 4200, disponible: true },
  { idProducto: 14, nombre: 'Helado 2 gustos', categoria: 'Postres', precio: 3900, disponible: false },
]

export function useProductosCaja() {
  // TODO: con datos reales, reemplazar por fetch a /api/productos?idSucursal={id de la sesión}.
  // Esa API hoy devuelve solo los disponibles; para mostrar "Sin stock" habría que sumar
  // el campo `disponible` de SucursalProducto a la respuesta.
  return { productos: productosDePrueba }
}
