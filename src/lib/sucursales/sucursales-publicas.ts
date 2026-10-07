// Lecturas públicas (sin sesión) para el menú digital: sucursales activas y su carta.
// Solo corre en el servidor: usa Prisma. Devuelve únicamente lo que puede ver un cliente.

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ordenarVariaciones } from '@/lib/productos/variacion-principal'

const camposSucursalPublica = {
  idSucursal: true, nombre: true, slug: true, direccion: true, horario: true, whatsapp: true,
  ofreceRetiro: true, ofreceDelivery: true,
  localidad: { select: { nombre: true, provincia: { select: { nombre: true } } } },
} satisfies Prisma.SucursalSelect

type FilaSucursalPublica = Prisma.SucursalGetPayload<{ select: typeof camposSucursalPublica }>

export type SucursalPublica = Omit<FilaSucursalPublica, 'localidad'> & { localidad: string; provincia: string }

export type SucursalPublicaDetalle = SucursalPublica & {
  // Zonas de delivery. Vacía = la sucursal no limitó localidades.
  localidadesDelivery: { idLocalidad: number; nombre: string }[]
}

function aPublica({ localidad, ...resto }: FilaSucursalPublica): SucursalPublica {
  return { ...resto, localidad: localidad.nombre, provincia: localidad.provincia.nombre }
}

// Sucursal activa por su slug, o null si no existe o está desactivada.
export async function obtenerSucursalPublica(slug: string): Promise<SucursalPublicaDetalle | null> {
  const sucursal = await prisma.sucursal.findFirst({
    where: { slug, activa: true },
    select: {
      ...camposSucursalPublica,
      localidadesDelivery: {
        select: { localidad: { select: { idLocalidad: true, nombre: true } } },
        orderBy: { localidad: { nombre: 'asc' } },
      },
    },
  })
  if (!sucursal) return null
  const { localidadesDelivery, ...resto } = sucursal
  return { ...aPublica(resto), localidadesDelivery: localidadesDelivery.map((zona) => zona.localidad) }
}

export async function listarSucursalesPublicas(): Promise<SucursalPublica[]> {
  const sucursales = await prisma.sucursal.findMany({
    where: { activa: true },
    select: camposSucursalPublica,
    orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
  })
  return sucursales.map(aPublica)
}

// Opciones de un producto en la carta. Variación: se elige una (si hay). Extras: opcionales.
export type OpcionMenu = { nombre: string; precioAdicional: number }
export type VariacionMenu = OpcionMenu & { idVariacion: number }
export type ExtraMenu = OpcionMenu & { idExtra: number }

export type ProductoMenu = {
  idProducto: number
  nombre: string
  descripcion: string | null
  // Precio de la variación más barata (o el único, si no tiene variaciones).
  precio: number
  // Solo las disponibles, en el orden de su categoría: LA PRIMERA ES LA PRINCIPAL (la que
  // la tarjeta muestra y el modal deja elegida). Ver lib/productos/variacion-principal.ts.
  variaciones: VariacionMenu[]
  // Solo los extras activos asociados al producto, por nombre.
  extras: ExtraMenu[]
}

export type CategoriaMenu = {
  idCategoria: number
  nombre: string
  productos: ProductoMenu[]
}

// Carta de una sucursal: categorías activas (por orden) con los productos activos que
// esa sucursal tiene disponibles, con sus variaciones y extras. Las categorías sin
// productos no se incluyen. No revisa que la sucursal esté activa: se llama con el id que
// devolvió obtenerSucursalPublica.
export async function obtenerMenuSucursal(idSucursal: number): Promise<CategoriaMenu[]> {
  const productoVisible = {
    activo: true,
    sucursales: { some: { idSucursal, disponible: true } },
  } satisfies Prisma.ProductoWhereInput

  const categorias = await prisma.categoria.findMany({
    where: { activa: true, productos: { some: productoVisible } },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: {
      idCategoria: true,
      nombre: true,
      nombresVariaciones: true,
      productos: {
        where: productoVisible,
        orderBy: [{ nombre: 'asc' }, { idProducto: 'asc' }],
        select: {
          idProducto: true, nombre: true, descripcion: true, precio: true,
          variaciones: {
            where: { disponible: true },
            orderBy: [{ precioAdicional: 'asc' }, { nombre: 'asc' }],
            select: { idVariacion: true, nombre: true, precioAdicional: true },
          },
          extras: {
            where: { extra: { activo: true } },
            orderBy: { extra: { nombre: 'asc' } },
            select: { extra: { select: { idExtra: true, nombre: true, precioAdicional: true } } },
          },
        },
      },
    },
  })
  return categorias.map(({ nombresVariaciones, ...categoria }) => ({
    ...categoria,
    productos: categoria.productos.map(({ extras, variaciones, ...producto }) => ({
      ...producto,
      variaciones: ordenarVariaciones(variaciones, nombresVariaciones),
      extras: extras.map(({ extra }) => extra),
    })),
  }))
}
