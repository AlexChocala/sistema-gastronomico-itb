// Apariencia personal para todos los roles. Los datos del negocio se consultan y
// muestran exclusivamente al administrador, usando su rol actual de la base.

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { urlLogoNegocio } from '@/lib/negocio/negocio'
import { ConfiguracionNegocioForm } from '@/components/forms/ConfiguracionNegocioForm'
import { ConfiguracionApariencia } from '@/components/tema/ConfiguracionApariencia'

export default async function ConfiguracionPage() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) redirect('/acceso/login')

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { rol: { select: { nombre: true } } },
  })
  if (!usuario) redirect('/acceso/login')
  const esAdmin = usuario.rol.nombre === 'admin'

  const negocio = esAdmin ? await prisma.negocio.findUnique({
    where: { idNegocio: 1 },
    select: {
      nombre: true, descripcion: true, logoPath: true, instagram: true, tiktok: true, facebook: true,
      transferenciaAlias: true, transferenciaCuit: true, transferenciaTitular: true,
    },
  }) : null
  // El layout del panel ya exige el sistema configurado; esto cubre una carrera improbable.
  if (esAdmin && !negocio) redirect('/configuracion-inicial')

  return (
    <main className="flex flex-col gap-6 p-6" lang="es">
      <header>
        <h1 className="page-title">Configuración</h1>
        <p className="mt-1 text-sm text-muted">{esAdmin ? 'La apariencia del sistema y los datos de tu restaurante.' : 'Personalizá la apariencia del sistema.'}</p>
      </header>

      <ConfiguracionApariencia />

      {esAdmin && negocio && <ConfiguracionNegocioForm
        inicial={{
          nombre: negocio.nombre,
          descripcion: negocio.descripcion ?? '',
          instagram: negocio.instagram ?? '',
          tiktok: negocio.tiktok ?? '',
          facebook: negocio.facebook ?? '',
          transferenciaAlias: negocio.transferenciaAlias ?? '',
          transferenciaCuit: negocio.transferenciaCuit ?? '',
          transferenciaTitular: negocio.transferenciaTitular ?? '',
        }}
        logoUrl={urlLogoNegocio(negocio.logoPath)}
        tieneLogo={negocio.logoPath !== null}
      />}
    </main>
  )
}
