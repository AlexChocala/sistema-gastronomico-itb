import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { PantallaReportes } from '@/components/reportes/PantallaReportes'
import { authOptions } from '@/lib/auth/auth'
import { obtenerNegocioPublico } from '@/lib/negocio/negocio'

export default async function ReportesPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Reportes es para admin y supervisor: el empleado opera en vivo desde Pedidos.
  if (sesion.user.rol === 'empleado') {
    redirect('/dashboard')
  }

  // Nombre y descripción del negocio para el encabezado de las descargas.
  const negocio = await obtenerNegocioPublico()

  return (
    <main className="p-6" lang="es">
      <PantallaReportes negocio={{ nombre: negocio?.nombre ?? 'Mise', descripcion: negocio?.descripcion ?? null }} />
    </main>
  )
}
