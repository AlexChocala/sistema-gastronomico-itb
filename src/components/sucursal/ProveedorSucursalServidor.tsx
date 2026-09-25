// Resuelve la sucursal activa en el servidor y la pasa a las pantallas de pestaña aparte
// (Caja, Cocina), que no viven dentro del layout de (panel).

import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { SucursalActivaProvider } from '@/components/sucursal/SucursalActiva'
import { authOptions } from '@/lib/auth'
import { obtenerSucursalActiva } from '@/lib/sucursal-activa'

export async function ProveedorSucursalServidor({ children }: { children: ReactNode }) {
  const sesion = await getServerSession(authOptions)
  if (!sesion) redirect('/acceso/login')

  return (
    <SucursalActivaProvider valor={await obtenerSucursalActiva(sesion)}>
      {children}
    </SucursalActivaProvider>
  )
}
