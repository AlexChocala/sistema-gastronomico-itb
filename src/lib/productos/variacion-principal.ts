// Orden de las variaciones de un producto y cuál es la principal.
//
// La principal es la que la carta muestra en la tarjeta y deja elegida al abrir el
// producto. La define el orden de la categoría (Categoria.nombresVariaciones): Pizzas
// [Entera, Media] → Entera; Papas fritas [Chica, Mediana, Grande] → Chica. Si el producto
// no tiene la primera, se usa la siguiente que sí tenga. Las variaciones propias del
// producto (que no están en la categoría) van al final, de la más barata a la más cara.

type Variacion = { nombre: string; precioAdicional: number }

function posicionEnCategoria(nombre: string, nombresCategoria: string[]) {
  const indice = nombresCategoria.findIndex((otro) => otro.trim().toLowerCase() === nombre.trim().toLowerCase())
  return indice === -1 ? Number.MAX_SAFE_INTEGER : indice
}

export function ordenarVariaciones<T extends Variacion>(variaciones: T[], nombresCategoria: string[]): T[] {
  return [...variaciones].sort(
    (a, b) =>
      posicionEnCategoria(a.nombre, nombresCategoria) - posicionEnCategoria(b.nombre, nombresCategoria) ||
      a.precioAdicional - b.precioAdicional ||
      a.nombre.localeCompare(b.nombre),
  )
}

export function variacionPrincipal<T extends Variacion>(variaciones: T[], nombresCategoria: string[]): T | null {
  return ordenarVariaciones(variaciones, nombresCategoria)[0] ?? null
}
