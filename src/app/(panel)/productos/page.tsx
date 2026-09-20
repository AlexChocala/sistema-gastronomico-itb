import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { GestionProductosForm } from '@/components/forms/GestionProductosForm'
import { authOptions } from '@/lib/auth'

export default async function ProductosPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Los empleados consultan el menú de su sucursal sin acceder al CRUD.
  if (sesion.user.rol === 'empleado') {
    redirect('/productos/menu')
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4 sm:p-6" lang="es">
      <GestionProductosForm />
    </main>
  )
}
