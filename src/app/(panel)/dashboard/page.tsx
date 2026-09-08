// Dashboard mínimo de prueba, TEMPORAL: sirve para confirmar de punta a punta que el
// flujo de login funciona. El equipo de backend lo va a reemplazar por el dashboard real.
//
// proxy.ts ya bloquea /dashboard sin sesión, pero igual volvemos a chequear acá: la
// propia documentación de Next.js (proxy.md, sección "Execution order") recomienda no
// confiar solo en el proxy, porque un cambio de matcher el día de mañana podría dejar
// esta ruta desprotegida sin que se note.

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CerrarSesionButton } from '@/components/layout/CerrarSesionButton'

export default async function DashboardPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-lg">Dashboard - Bienvenido {sesion.user.name}</p>
      <CerrarSesionButton />
    </div>
  )
}
