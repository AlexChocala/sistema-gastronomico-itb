// Resuelve la sucursal activa en el servidor y la pasa a las pantallas de pestaña aparte
// (Caja, Cocina), que no viven dentro del layout de (panel).

import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { SucursalActivaProvider } from '@/components/sucursal/SucursalActiva'
import { authOptions } from '@/lib/auth/auth'
import { exigirSistemaListo } from '@/lib/negocio/configuracion-inicial'
import { prisma } from '@/lib/db/prisma'
import { accesoDeEsteEquipo, type TipoPantalla } from '@/lib/pantallas/acceso'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'

// `pantalla`: si se indica, un equipo enlazado a esa pantalla (link de acceso) entra sin sesión.
export async function ProveedorSucursalServidor({ children, pantalla }: { children: ReactNode; pantalla?: TipoPantalla }) {
  const sesion = await getServerSession(authOptions)
  if (!sesion) {
    const acceso = pantalla ? await accesoDeEsteEquipo(prisma, [pantalla]) : null
    if (!acceso) redirect('/acceso/login')
    const sucursal = await prisma.sucursal.findUnique({ where: { idSucursal: acceso.idSucursal }, select: { idSucursal: true, nombre: true } })
    return (
      <SucursalActivaProvider valor={{ sucursal, puedeElegir: false, opciones: [] }}>
        {children}
      </SucursalActivaProvider>
    )
  }
  // Misma guardia que el layout del panel: usuario activo, contraseña cambiada y sistema configurado.
  await exigirSistemaListo(sesion)

  return (
    <SucursalActivaProvider valor={await obtenerSucursalActiva(sesion)}>
      {children}
    </SucursalActivaProvider>
  )
}
