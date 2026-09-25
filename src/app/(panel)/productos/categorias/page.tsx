import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { GestionCategoriasForm } from '@/components/forms/GestionCategoriasForm'
import { authOptions } from '@/lib/auth'

export default async function CategoriasPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  if (sesion.user.rol === 'empleado') {
    redirect('/productos/menu')
  }

  return (
    <main className="p-6" lang="es">
      <GestionCategoriasForm />
    </main>
  )
}
