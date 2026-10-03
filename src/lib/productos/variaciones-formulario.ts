// Reglas de la sección "Variaciones" del formulario de producto (sin React, para probarlas aparte).
//
// El comercio carga el PRECIO FINAL de cada variación ("Entera $18.000"). Al guardar:
//   - el precio del producto es el de la variación más barata;
//   - cada variación guarda la diferencia con ese precio (precioAdicional, nunca negativo).
// Es solo la forma de guardarlo: la carta muestra el precio final de la principal.

import type { VariacionProducto } from './productos-validacion'

export type VariacionGuardada = { idVariacion: number; nombre: string; precioAdicional: number }

// Una fila de la sección. `propia`: la escribió el usuario solo para este producto (no
// viene de la categoría), así que su nombre se edita y se puede quitar.
export type FilaVariacion = {
  clave: string
  idVariacion?: number
  nombre: string
  precio: string
  elegida: boolean
  propia: boolean
}

let ultimaClave = 0
export function nuevaClave() {
  ultimaClave += 1
  return `variacion-${ultimaClave}`
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100
}

function mismoNombre(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// Filas de un producto: primero las variaciones de su categoría (tildadas si el producto
// ya las tiene; en un producto nuevo, todas) y después las propias del producto.
export function filasIniciales(
  nombresCategoria: string[],
  producto?: { precio: number; variaciones: VariacionGuardada[] },
): FilaVariacion[] {
  const existentes = producto?.variaciones ?? []
  const base = producto?.precio ?? 0
  const deCategoria = nombresCategoria.map((nombre): FilaVariacion => {
    const guardada = existentes.find((variacion) => mismoNombre(variacion.nombre, nombre))
    return {
      clave: nuevaClave(),
      idVariacion: guardada?.idVariacion,
      nombre,
      precio: guardada ? String(redondear(base + guardada.precioAdicional)) : '',
      elegida: producto ? guardada !== undefined : true,
      propia: false,
    }
  })
  const propias = existentes
    .filter((variacion) => !nombresCategoria.some((nombre) => mismoNombre(nombre, variacion.nombre)))
    .map((variacion): FilaVariacion => ({
      clave: nuevaClave(),
      idVariacion: variacion.idVariacion,
      nombre: variacion.nombre,
      precio: String(redondear(base + variacion.precioAdicional)),
      elegida: true,
      propia: true,
    }))
  return [...deCategoria, ...propias]
}

// Al cambiar de categoría: aparecen las variaciones de la nueva (conservando lo que ya se
// había cargado con el mismo nombre) y lo elegido que no está en ella queda como propio.
export function filasParaCategoria(nombresCategoria: string[], actuales: FilaVariacion[]): FilaVariacion[] {
  const deCategoria = nombresCategoria.map((nombre): FilaVariacion => {
    const previa = actuales.find((fila) => mismoNombre(fila.nombre, nombre))
    return previa ? { ...previa, nombre, propia: false } : { clave: nuevaClave(), nombre, precio: '', elegida: true, propia: false }
  })
  const propias = actuales
    .filter((fila) => (fila.propia || fila.elegida) && !nombresCategoria.some((nombre) => mismoNombre(nombre, fila.nombre)))
    .map((fila) => ({ ...fila, propia: true }))
  return [...deCategoria, ...propias]
}

// Una fila propia sin nombre ni precio es una que se agregó y no se completó: se ignora.
function esVacia(fila: FilaVariacion) {
  return fila.propia && !fila.nombre.trim() && !fila.precio
}

export function filasElegidas(filas: FilaVariacion[]) {
  return filas.filter((fila) => fila.elegida && !esVacia(fila))
}

// La principal es la primera elegida: las filas ya vienen en el orden de la categoría y
// las propias al final (ver variacion-principal.ts).
export function filaPrincipal(filas: FilaVariacion[]): FilaVariacion | null {
  return filasElegidas(filas)[0] ?? null
}

// Arma lo que se manda a la API, o devuelve el error para mostrar.
export function armarVariaciones(
  filas: FilaVariacion[],
): { precio: number | null; variaciones: VariacionProducto[] } | { error: string } {
  const elegidas = filasElegidas(filas)
  if (elegidas.length === 0) return { precio: null, variaciones: [] }
  if (elegidas.some((fila) => !fila.nombre.trim())) return { error: 'Completá el nombre de cada variación.' }
  const nombres = elegidas.map((fila) => fila.nombre.trim().toLowerCase())
  if (new Set(nombres).size !== nombres.length) return { error: 'Hay variaciones con el mismo nombre.' }
  const precios = elegidas.map((fila) => Number(fila.precio))
  if (precios.some((precio) => !Number.isFinite(precio) || precio <= 0)) {
    return { error: 'Cargá el precio de cada variación elegida.' }
  }
  const minimo = Math.min(...precios)
  return {
    precio: minimo,
    variaciones: elegidas.map((fila, indice) => ({
      ...(fila.idVariacion !== undefined ? { idVariacion: fila.idVariacion } : {}),
      nombre: fila.nombre.trim(),
      precioAdicional: redondear(precios[indice] - minimo),
    })),
  }
}
