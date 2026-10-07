// Asistente de primera configuración: datos del negocio y primeras sucursales. Vive
// fuera de (panel) porque el layout del panel manda acá mientras el sistema no esté
// configurado (ver lib/negocio/configuracion-inicial.ts); si estuviera adentro, se redirigiría
// a sí mismo sin fin.

import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { sistemaConfigurado } from '@/lib/negocio/configuracion-inicial'
import { LogoMise, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { CerrarSesionButton } from '@/components/layout/CerrarSesionButton'
import { ConfiguracionInicialForm } from '@/components/forms/ConfiguracionInicialForm'
import { Settings, TriangleAlert } from '@/components/icons'

function PantallaConfiguracion({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg p-6 md:p-10">
      <LogoMise />
      <main className="flex flex-1 items-center justify-center py-10">{children}</main>
    </div>
  )
}

const claseCerrarSesion =
  'inline-flex cursor-pointer items-center gap-2 self-center rounded-full border border-border px-5 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-danger'

export default async function ConfiguracionInicialPage() {
  const sesion = await getServerSession(authOptions)
  if (!sesion) redirect('/acceso/login')

  // Se lee de la base (no del token) igual que la guardia del panel.
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
  })
  if (!usuario?.activo) redirect('/acceso/login')
  if (usuario.debeCambiarContrasena) redirect('/acceso/cambiar-contrasena')
  if (await sistemaConfigurado(prisma)) redirect('/dashboard')

  if (usuario.rol.nombre !== 'admin') {
    return (
      <PantallaConfiguracion>
        <TarjetaAcceso
          icono={Settings}
          titulo="Sistema sin configurar"
          descripcion="El sistema todavía no está configurado. Pedile al administrador que complete la configuración inicial."
        >
          <div className="flex justify-center">
            <CerrarSesionButton className={claseCerrarSesion} />
          </div>
        </TarjetaAcceso>
      </PantallaConfiguracion>
    )
  }

  const [negocio, localidades, totalSucursales, sucursalesActivas] = await Promise.all([
    prisma.negocio.findUnique({ where: { idNegocio: 1 }, select: { idNegocio: true } }),
    prisma.localidad.findMany({
      select: { idLocalidad: true, nombre: true, provincia: { select: { nombre: true } } },
      orderBy: [{ nombre: 'asc' }, { idLocalidad: 'asc' }],
    }),
    prisma.sucursal.count(),
    prisma.sucursal.count({ where: { activa: true } }),
  ])

  // Caso borde: el negocio ya está cargado pero no queda ninguna sucursal activa (la API
  // de Sucursales no deja desactivar la última, así que solo pasa si se tocó la base a
  // mano). El asistente no sirve acá porque la API rechaza un segundo negocio.
  if (negocio) {
    return (
      <PantallaConfiguracion>
        <TarjetaAcceso
          icono={TriangleAlert}
          tono="peligro"
          titulo="No hay sucursales activas"
          descripcion="Los datos del negocio ya están cargados, pero no queda ninguna sucursal activa. Reactivá una sucursal desde la base de datos para volver a usar el sistema."
        >
          <div className="flex justify-center">
            <CerrarSesionButton className={claseCerrarSesion} />
          </div>
        </TarjetaAcceso>
      </PantallaConfiguracion>
    )
  }

  return (
    <PantallaConfiguracion>
      <ConfiguracionInicialForm
        localidades={localidades}
        totalSucursales={totalSucursales}
        sucursalesActivas={sucursalesActivas}
      />
    </PantallaConfiguracion>
  )
}
