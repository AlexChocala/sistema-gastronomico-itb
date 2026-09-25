import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) {
    return NextResponse.json({ error: 'Iniciá sesión para consultar los productos.' }, { status: 401 })
  }

  try {
    // La sucursal se relee de la base para no depender de una sesión desactualizada.
    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: sesion.user.idUsuario },
      select: { activo: true, debeCambiarContrasena: true, idSucursal: true },
    })
    if (!usuario?.activo) {
      return NextResponse.json({ error: 'El usuario no está habilitado.' }, { status: 403 })
    }
    if (usuario.debeCambiarContrasena) {
      return NextResponse.json({ error: 'Primero tenés que cambiar tu contraseña.' }, { status: 403 })
    }
    if (usuario.idSucursal === null) {
      return NextResponse.json({ error: 'Tu usuario no tiene una sucursal asignada.' }, { status: 400 })
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: { idSucursal: usuario.idSucursal, activa: true },
      select: {
        idSucursal: true,
        nombre: true,
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
                categoria: { select: { nombre: true } },
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
        disponible,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron cargar los productos de Caja.' },
      { status: 500 },
    )
  }
}
