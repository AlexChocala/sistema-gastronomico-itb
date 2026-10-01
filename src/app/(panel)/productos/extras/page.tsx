import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { GestionExtrasForm } from '@/components/forms/GestionExtrasForm'
import { authOptions } from '@/lib/auth/auth'

type Props = { searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }

export default async function ExtrasPage({ searchParams }: Props) {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Crear y editar extras: admin y supervisor.
  if (!['admin', 'supervisor'].includes(sesion.user.rol)) {
    redirect('/productos')
  }

  // ?categoria=ID abre directo esa categoría (el acceso desde la tarjeta de Categorías).
  const { categoria } = await searchParams
  const idCategoria = Number(categoria)

  return (
    <main className="p-6" lang="es">
      <GestionExtrasForm idCategoriaInicial={Number.isInteger(idCategoria) && idCategoria > 0 ? idCategoria : null} />
    </main>
  )
}