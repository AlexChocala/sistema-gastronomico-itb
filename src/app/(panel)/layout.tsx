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
    <div className="min-h-screen bg-surface md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <PanelSidebar
        nombre={sesion.user.name ?? 'Usuario'}
        rol={sesion.user.rol}      />
      <div className="min-w-0 p-3 md:py-3 md:pr-3 md:pl-0">
        <div className="min-h-[calc(100vh-1.5rem)] rounded-3xl bg-bg">
          {children}
        </div>
      </div>
    </div>
  )
}
