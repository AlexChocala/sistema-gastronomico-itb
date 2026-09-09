import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { GestionProductosForm } from '@/components/forms/GestionProductosForm'

export default async function ProductosPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  return (
    <main className="p-4" lang="es">
      <GestionProductosForm />
    </main>
  )
}
