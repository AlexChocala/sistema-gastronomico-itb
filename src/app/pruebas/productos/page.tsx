import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PruebaProductosForm } from '@/components/forms/PruebaProductosForm'

// Pantalla temporal disponible solo durante el desarrollo.
export default async function PruebaProductosPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  let sucursales: { idSucursal: number; nombre: string }[] = []
  let errorInicial = ''
  try {
    sucursales = await prisma.sucursal.findMany({
      where: { activa: true },
      select: { idSucursal: true, nombre: true },
      orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
    })
  } catch {
    errorInicial = 'No se pudieron cargar las sucursales.'
  }
  return <PruebaProductosForm sucursales={sucursales} errorInicial={errorInicial} />
}
