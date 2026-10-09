// Lecturas compartidas por las páginas públicas de una sucursal (menú, carrito, checkout)
// y su generateMetadata. cache() evita repetir la misma consulta dentro de un request
// (la metadata y la página piden lo mismo). Solo corre en el servidor.

import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { obtenerNegocioPublico } from '@/lib/negocio/negocio'
import {
  listarSucursalesPublicas, obtenerMenuSucursal, obtenerSlugActual, obtenerSucursalPublica,
} from '@/lib/sucursales/sucursales-publicas'
import { SLUGS_RESERVADOS } from '@/lib/sucursales/sucursales-validacion'

export const obtenerNegocio = cache(obtenerNegocioPublico)
export const obtenerMenu = cache(obtenerMenuSucursal)

// Sucursal activa del slug, o 404 (not-found.tsx de este segmento) si no existe, está
// desactivada o el slug es una ruta de la app. Sin negocio configurado tampoco hay menú.
// Si el slug es un link viejo de la sucursal (lo cambió el admin), redirige a su carta actual.
export const obtenerSucursalOFallar = cache(async (slug: string) => {
  if (SLUGS_RESERVADOS.includes(slug)) notFound()
  const [sucursal, negocio] = await Promise.all([obtenerSucursalPublica(slug), obtenerNegocio()])
  if (!sucursal) {
    const slugActual = await obtenerSlugActual(slug)
    if (slugActual) redirect(`/${slugActual}`)
  }
  if (!sucursal || !negocio) notFound()
  return { sucursal, negocio }
})

// El link "Cambiar de local" solo tiene sentido si hay más de una sucursal activa.
export const hayVariasSucursales = cache(async () => (await listarSucursalesPublicas()).length > 1)

// Productos del menú en forma plana, para reconciliar el carrito en el carrito y el
// checkout: ids, nombres y precios vigentes, más sus variaciones y extras disponibles
// (así una opción que se desactivó se detecta ahí mismo y no recién al confirmar).
export async function productosDelMenu(idSucursal: number) {
  const categorias = await obtenerMenu(idSucursal)
  return categorias.flatMap((categoria) =>
    categoria.productos.map(({ idProducto, nombre, precio, variaciones, extras }) => ({
      idProducto, nombre, precio, variaciones, extras,
    })),
  )
}