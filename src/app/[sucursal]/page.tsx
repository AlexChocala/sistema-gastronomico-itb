// Menú público de una sucursal (/{slug}). Sin sesión: está fuera de (panel) y del matcher
// de src/proxy.ts. El servidor trae los datos; el carrito vive en MenuSucursal (cliente).

import type { Metadata } from 'next'
import { EncabezadoSucursal } from '@/components/carta/compartidos/EncabezadoSucursal'
import { MenuSucursal } from '@/components/carta/menu/MenuSucursal'
import { hayVariasSucursales, obtenerMenu, obtenerSucursalOFallar } from './datos'

export async function generateMetadata({ params }: PageProps<'/[sucursal]'>): Promise<Metadata> {
  const { sucursal, negocio } = await obtenerSucursalOFallar((await params).sucursal)
  return {
    title: `${sucursal.nombre} · ${negocio.nombre}`,
    description: negocio.descripcion ?? `Pedí online en ${negocio.nombre} ${sucursal.nombre}.`,
  }
}

export default async function PaginaMenuSucursal({ params }: PageProps<'/[sucursal]'>) {
  const { sucursal, negocio } = await obtenerSucursalOFallar((await params).sucursal)
  const [categorias, variasSucursales] = await Promise.all([obtenerMenu(sucursal.idSucursal), hayVariasSucursales()])

  return (
    <div className="flex flex-1 flex-col bg-bg text-text">
      <EncabezadoSucursal negocio={negocio} sucursal={sucursal} variasSucursales={variasSucursales} />
      <main className="flex flex-1 flex-col">
        <MenuSucursal slug={sucursal.slug} categorias={categorias} />
      </main>
    </div>
  )
}
