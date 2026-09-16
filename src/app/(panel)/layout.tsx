import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PanelSidebar } from '@/components/layout/PanelSidebar'

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
      <PanelSidebar
        nombre={sesion.user.name ?? 'Usuario'}
        rol={sesion.user.rol}
      />
      <div className="min-w-0">
        {children}
      </div>
    </div>
  )
}
