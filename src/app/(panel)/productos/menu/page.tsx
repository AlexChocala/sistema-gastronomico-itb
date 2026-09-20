import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { ConsultaMenuSucursal } from '@/components/forms/ConsultaMenuSucursal'
import { Card } from '@/components/ui/Card'
import { authOptions } from '@/lib/auth'

export default async function MenuSucursalPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  if (sesion.user.idSucursal === null) {
    return (
      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6" lang="es">
        <Card className="max-w-none!">
          <h1 className="text-2xl font-semibold">Consultar menú</h1>
          <p className="mt-2">
            Tu usuario no tiene una sucursal asignada. Pedile a un administrador que la configure.
          </p>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4 sm:p-6" lang="es">
      <ConsultaMenuSucursal idSucursal={sesion.user.idSucursal} />
    </main>
  )
}
