import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { GestionProductosForm } from '@/components/forms/GestionProductosForm'
import { authOptions } from '@/lib/auth'

export default async function ProductosPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Los empleados no administran productos: los ven al cargar pedidos en Caja.
  if (sesion.user.rol === 'empleado') {
    redirect('/dashboard')
  }

  return (
    <main className="p-6" lang="es">
      <GestionProductosForm />
    </main>
  )
}
