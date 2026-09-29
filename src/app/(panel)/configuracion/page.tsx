// Configuración del negocio: nombre, descripción, logo, redes sociales y datos para
// transferencias. Solo admin
// (el proxy ya redirige a los demás; acá se vuelve a controlar con el rol de la base).

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { urlLogoNegocio } from '@/lib/negocio/negocio'
import { ConfiguracionNegocioForm } from '@/components/forms/ConfiguracionNegocioForm'

export default async function ConfiguracionPage() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) redirect('/acceso/login')

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { rol: { select: { nombre: true } } },
  })
  if (usuario?.rol.nombre !== 'admin') redirect('/dashboard')

  const negocio = await prisma.negocio.findUnique({
    where: { idNegocio: 1 },
    select: {
      nombre: true, descripcion: true, logoPath: true, instagram: true, tiktok: true, facebook: true,
      transferenciaAlias: true, transferenciaCbu: true, transferenciaTitular: true,
    },
  })
  // El layout del panel ya exige el sistema configurado; esto cubre una carrera improbable.
  if (!negocio) redirect('/configuracion-inicial')

  return (
    <main className="flex flex-col gap-6 p-6" lang="es">
      <header>
        <h1 className="page-title">Configuración</h1>
        <p className="mt-1 text-sm text-muted">Los datos de tu restaurante que ven tu equipo y tus clientes.</p>
      </header>

      <ConfiguracionNegocioForm
        inicial={{
          nombre: negocio.nombre,
          descripcion: negocio.descripcion ?? '',
          instagram: negocio.instagram ?? '',
          tiktok: negocio.tiktok ?? '',
          facebook: negocio.facebook ?? '',
          transferenciaAlias: negocio.transferenciaAlias ?? '',
          transferenciaCbu: negocio.transferenciaCbu ?? '',
          transferenciaTitular: negocio.transferenciaTitular ?? '',
        }}
        logoUrl={urlLogoNegocio(negocio.logoPath)}
        tieneLogo={negocio.logoPath !== null}
      />
    </main>
  )
}
