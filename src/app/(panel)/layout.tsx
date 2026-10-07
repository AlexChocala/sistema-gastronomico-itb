import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/auth'
import { BarraSuperior } from '@/components/layout/BarraSuperior'
import { PanelSidebar } from '@/components/layout/PanelSidebar'
import { SucursalActivaProvider } from '@/components/sucursal/SucursalActiva'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'
import { exigirSistemaListo } from '@/lib/negocio/configuracion-inicial'
import { prisma } from '@/lib/db/prisma'

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Usuario activo, contraseña ya cambiada y sistema configurado; si no, lo manda a donde corresponda.
  await exigirSistemaListo(sesion)

  const sucursalActiva = await obtenerSucursalActiva(sesion)
  // exigirSistemaListo ya garantizó que el negocio existe.
  const negocio = await prisma.negocio.findUnique({ where: { idNegocio: 1 }, select: { nombre: true } })

  return (
    <SucursalActivaProvider valor={sucursalActiva}>
      <div className="min-h-screen bg-surface md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <PanelSidebar rol={sesion.user.rol} nombreNegocio={negocio?.nombre ?? 'Mise'} />
        <div className="min-w-0 px-3 md:pl-0">
          <BarraSuperior nombre={sesion.user.name ?? 'Usuario'} rol={sesion.user.rol} />
          {/* Alto de pantalla menos la barra (5rem) y el margen inferior (0.75rem). */}
          <div className="mb-3 min-h-[calc(100vh-5.75rem)] rounded-3xl bg-bg">
            {children}
          </div>
        </div>
      </div>
    </SucursalActivaProvider>
  )
}
