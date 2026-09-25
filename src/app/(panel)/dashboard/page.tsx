import { getServerSession } from 'next-auth'
import { ResumenDelDia } from '@/components/dashboard/ResumenDelDia'
import { authOptions } from '@/lib/auth'

export default async function DashboardPage() {
  const sesion = await getServerSession(authOptions)

  return (
    <main className="p-6" lang="es">
      <ResumenDelDia nombre={sesion?.user.name ?? 'Usuario'} />
    </main>
  )
}
