import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Consulta pública de productos disponibles. Ejemplo: /api/productos?idSucursal=1
export async function GET(request: Request) {
  // Leemos de la dirección el número de sucursal que solicita la pantalla.
  const parametros = new URL(request.url).searchParams
  const valor = parametros.get('idSucursal')
  const idSucursal = Number(valor)

  // El identificador debe ser un entero positivo que entre en un Int de PostgreSQL.
  // También rechazamos el parámetro repetido para evitar una selección ambigua.
  if (
    parametros.getAll('idSucursal').length !== 1 ||
    !valor ||
    !/^[1-9]\d*$/.test(valor) ||
    !Number.isSafeInteger(idSucursal) ||
    idSucursal > 2147483647
  ) {
    return NextResponse.json(
      { error: 'Indicá un idSucursal válido: un número entero mayor que cero.' },
      { status: 400 }
    )
  }

  try {
    // Buscamos la sucursal y sus productos relacionados. La relación mantiene
    // la consulta limitada a esa sucursal, sin mezclar productos de otras.
    const sucursal = await prisma.sucursal.findFirst({
      where: { idSucursal, activa: true },
      select: {
        idSucursal: true,
        nombre: true,
        productos: {
          // Debe estar disponible en esta sucursal, y tanto el producto como
          // su categoría deben estar activos para aparecer en la carta pública.
          where: {
            disponible: true,
            producto: { activo: true, categoria: { activa: true } },
          },
          // Primero respetamos el orden de categorías, luego el nombre del producto.
          // El identificador desempata nombres iguales y mantiene un orden estable.
          orderBy: [
            { producto: { categoria: { orden: 'asc' } } },
            { producto: { nombre: 'asc' } },
            { idProducto: 'asc' },
          ],
          // Devolvemos solo los datos que necesita la carta.
          select: {
            producto: {
              select: {
                idProducto: true,
                nombre: true,
                descripcion: true,
                precio: true,
                categoria: { select: { idCategoria: true, nombre: true } },
              },
            },
          },
        },
      },
    })

    // Una sucursal inexistente o inactiva no tiene una carta pública accesible.
    if (!sucursal) {
      return NextResponse.json(
        { error: 'Sucursal no encontrada o inactiva.' },
        { status: 404 }
      )
    }

    // Una sucursal sin productos disponibles devuelve una lista vacía.
    // map quita el envoltorio de la relación y entrega una lista directa de productos.
    // no-store evita guardar esta respuesta en caché y mostrar disponibilidad vieja.
    return NextResponse.json({
      sucursal: { idSucursal: sucursal.idSucursal, nombre: sucursal.nombre },
      productos: sucursal.productos.map(({ producto }) => producto),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Mostramos un mensaje general para no exponer detalles internos de la base.
    return NextResponse.json(
      { error: 'No se pudieron consultar los productos. Intentá nuevamente más tarde.' },
      { status: 500 }
    )
  }
}
