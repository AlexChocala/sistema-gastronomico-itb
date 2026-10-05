// Pedidos de categorías desde el cliente fuera de la pantalla de Categorías: hoy, la
// creación rápida dentro del formulario de producto (components/productos/CrearCategoriaRapida.tsx).

export type CategoriaCreada = { idCategoria: number; nombre: string; nombresVariaciones: string[] }

type CategoriaListada = CategoriaCreada & { orden: number }

async function leerJson<T>(respuesta: Response): Promise<T & { error?: string }> {
  if (!respuesta.headers.get('content-type')?.includes('application/json')) {
    throw new Error('El servidor no devolvió una respuesta válida. Reiniciá la aplicación e intentá nuevamente.')
  }
  return respuesta.json() as Promise<T & { error?: string }>
}

// La categoría nueva va al final del menú, como al crearla desde Categorías. El orden se
// calcula con todas las categorías (también las inactivas) para no repetir posiciones.
export async function crearCategoriaAlFinal(nombre: string, nombresVariaciones: string[]): Promise<CategoriaCreada> {
  const listado = await fetch('/api/productos/categorias', { cache: 'no-store' })
  const { categorias, error: errorListado } = await leerJson<{ categorias: CategoriaListada[] }>(listado)
  if (!listado.ok) throw new Error(errorListado || 'No se pudieron cargar las categorías.')

  const orden = Math.max(0, ...categorias.map((categoria) => categoria.orden)) + 1
  const respuesta = await fetch('/api/productos/categorias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: nombre.trim(), orden, nombresVariaciones }),
  })
  const { categoria, error } = await leerJson<{ categoria: CategoriaCreada }>(respuesta)
  if (!respuesta.ok) throw new Error(error || 'No se pudo crear la categoría.')
  return { idCategoria: categoria.idCategoria, nombre: categoria.nombre, nombresVariaciones: categoria.nombresVariaciones }
}
