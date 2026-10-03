import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { ordenarVariaciones } from '@/lib/productos/variacion-principal'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'

export async function GET() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) {
    return NextResponse.json({ error: 'Iniciá sesión para consultar los productos.' }, { status: 401 })
  }

  try {
    // La sucursal se relee de la base para no depender de una sesión desactualizada.
    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: sesion.user.idUsuario },
      select: { activo: true, debeCambiarContrasena: true },
    })
    if (!usuario?.activo) {
      return NextResponse.json({ error: 'El usuario no está habilitado.' }, { status: 403 })
    }
    if (usuario.debeCambiarContrasena) {
      return NextResponse.json({ error: 'Primero tenés que cambiar tu contraseña.' }, { status: 403 })
    }
    // Admin: la sucursal elegida en el selector; el resto: la asignada a su usuario.
    const { sucursal: activa } = await obtenerSucursalActiva(sesion)
    if (activa === null) {
      return NextResponse.json({ error: 'Tu usuario no tiene una sucursal asignada.' }, { status: 400 })
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: { idSucursal: activa.idSucursal, activa: true },
      select: {
        idSucursal: true,
        nombre: true,
        // Zonas de delivery: si hay, Caja pide elegir una de ellas en un delivery.
        localidadesDelivery: {
          select: { localidad: { select: { idLocalidad: true, nombre: true } } },
          orderBy: { localidad: { nombre: 'asc' } },
        },
        productos: {
          where: { producto: { activo: true, categoria: { activa: true } } },
          orderBy: [
            { producto: { categoria: { orden: 'asc' } } },
            { producto: { nombre: 'asc' } },
            { idProducto: 'asc' },
          ],
          select: {
            disponible: true,
            producto: {
              select: {
                idProducto: true,
                nombre: true,
                precio: true,
                categoria: { select: { nombre: true, nombresVariaciones: true } },
                // Si tiene, Caja pide elegir una (igual que la carta): la API de pedidos la exige.
                variaciones: {
                  where: { disponible: true },
                  select: { idVariacion: true, nombre: true, precioAdicional: true },
                  orderBy: [{ precioAdicional: 'asc' }, { nombre: 'asc' }],
                },
                // Los extras activos que admite, igual que en la carta.
                extras: {
                  where: { extra: { activo: true } },
                  orderBy: { extra: { nombre: 'asc' } },
                  select: { extra: { select: { idExtra: true, nombre: true, precioAdicional: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!sucursal) {
      return NextResponse.json({ error: 'La sucursal asignada no está disponible.' }, { status: 404 })
    }

    return NextResponse.json({
      sucursal: { idSucursal: sucursal.idSucursal, nombre: sucursal.nombre },
      productos: sucursal.productos.map(({ producto, disponible }) => ({
        idProducto: producto.idProducto,
        nombre: producto.nombre,
        categoria: producto.categoria.nombre,
        precio: producto.precio,
        // En el orden de su categoría: la primera es la principal.
        variaciones: ordenarVariaciones(producto.variaciones, producto.categoria.nombresVariaciones),
        extras: producto.extras.map(({ extra }) => extra),
        disponible,
      })),
      localidadesDelivery: sucursal.localidadesDelivery.map((zona) => zona.localidad),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron cargar los productos de Caja.' },
      { status: 500 },
    )
  }
}
