// Categorías comunes de un local gastronómico, con los nombres de variaciones que suelen
// usar. Son solo una ayuda del formulario de categorías (no se guardan en la base hasta
// que el usuario las elige, y las puede cambiar o escribir las suyas).
// La primera variación es la principal (ver lib/productos/variacion-principal.ts): la que
// más se pide, no la más barata (en pizzas, la entera).

export type CategoriaSugerida = { nombre: string; nombresVariaciones: string[] }

export const CATEGORIAS_SUGERIDAS: readonly CategoriaSugerida[] = [
  { nombre: 'Hamburguesas', nombresVariaciones: [] },
  { nombre: 'Pizzas', nombresVariaciones: ['Entera', 'Media'] },
  { nombre: 'Empanadas', nombresVariaciones: ['Unidad', 'Media docena', 'Docena'] },
  { nombre: 'Papas fritas', nombresVariaciones: ['Chica', 'Mediana', 'Grande'] },
  { nombre: 'Panchos', nombresVariaciones: [] },
  { nombre: 'Sándwiches', nombresVariaciones: [] },
  { nombre: 'Platos', nombresVariaciones: [] },
  { nombre: 'Ensaladas', nombresVariaciones: [] },
  { nombre: 'Bebidas', nombresVariaciones: [] },
  { nombre: 'Cafetería', nombresVariaciones: ['Chico', 'Grande'] },
  { nombre: 'Helados', nombresVariaciones: ['1/4 kg', '1/2 kg', '1 kg'] },
  { nombre: 'Postres', nombresVariaciones: [] },
]
