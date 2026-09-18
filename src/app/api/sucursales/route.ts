import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const sucursales = await prisma.sucursal.findMany({
    select: {
      idSucursal: true,
      nombre: true,
      activa: true,
    },
  })

  return NextResponse.json(sucursales)
}