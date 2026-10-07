// DATOS FALSOS, TEMPORALES. Respetan el contrato de extras-tipos.ts para que la pantalla de
// Extras y el formulario de producto funcionen antes de que exista la API de extras.
// Cuando el backend esté listo, extras-api.ts deja de usar este archivo y se puede borrar.
// Los ids de categoría coinciden con los de la base de desarrollo (1 Hamburguesa, 2 Pizza,
// 3 Bebida) para que el formulario de producto muestre extras coherentes.

import type { RespuestaListadoExtras } from './extras-tipos'

export const EXTRAS_DE_EJEMPLO: RespuestaListadoExtras = {
  categorias: [
    { idCategoria: 1, nombre: 'Hamburguesa' },
    { idCategoria: 2, nombre: 'Pizza' },
    { idCategoria: 3, nombre: 'Bebida' },
    { idCategoria: 4, nombre: 'Panchos' },
  ],
  productos: [
    { idProducto: 101, idCategoria: 1, nombre: 'Clásica' },
    { idProducto: 102, idCategoria: 1, nombre: 'Doble cheddar' },
    { idProducto: 103, idCategoria: 1, nombre: 'Veggie' },
    { idProducto: 201, idCategoria: 2, nombre: 'Muzzarella' },
    { idProducto: 202, idCategoria: 2, nombre: 'Napolitana' },
    { idProducto: 301, idCategoria: 3, nombre: 'Gaseosa 500 ml' },
    { idProducto: 302, idCategoria: 3, nombre: 'Agua sin gas' },
    { idProducto: 401, idCategoria: 4, nombre: 'Pancho simple' },
    { idProducto: 402, idCategoria: 4, nombre: 'Súper pancho' },
  ],
  extras: [
    { idExtra: 1, idCategoria: 1, nombre: 'Bacon', precioAdicional: 1200, activo: true,
      productos: [{ idProducto: 101 }, { idProducto: 102 }] },
    { idExtra: 2, idCategoria: 1, nombre: 'Cheddar extra', precioAdicional: 900, activo: true,
      productos: [{ idProducto: 101 }, { idProducto: 102 }, { idProducto: 103 }] },
    { idExtra: 3, idCategoria: 1, nombre: 'Papas grandes', precioAdicional: 1500, activo: true,
      productos: [{ idProducto: 101 }, { idProducto: 102 }, { idProducto: 103 }] },
    { idExtra: 4, idCategoria: 1, nombre: 'Huevo frito', precioAdicional: 800, activo: false, productos: [] },
    { idExtra: 5, idCategoria: 2, nombre: 'Muzzarella extra', precioAdicional: 1800, activo: true,
      productos: [{ idProducto: 201 }, { idProducto: 202 }] },
    { idExtra: 6, idCategoria: 4, nombre: 'Cheddar', precioAdicional: 600, activo: true,
      productos: [{ idProducto: 401 }, { idProducto: 402 }] },
    { idExtra: 7, idCategoria: 4, nombre: 'Papas pay', precioAdicional: 0, activo: true,
      productos: [{ idProducto: 402 }] },
  ],
}
