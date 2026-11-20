import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/auth'
import { BarraSuperior } from '@/components/layout/BarraSuperior'
import { PanelSidebar } from '@/components/layout/PanelSidebar'
import { SucursalActivaProvider } from '@/components/sucursal/SucursalActiva'
import { obtenerSucursalActiva } from '@/lib/sucursales/sucursal-activa'
import { exigirSistemaListo } from '@/lib/negocio/configuracion-inicial'
import { prisma } from '@/lib/db/prisma'
import { urlImagenPublica } from '@/lib/storage/imagenes'

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Usuario activo, contraseña ya cambiada y sistema configurado; si no, lo manda a donde corresponda.
  await exigirSistemaListo(sesion)

  const sucursalActiva = await obtenerSucursalActiva(sesion)
  // exigirSistemaListo ya garantizó que el negocio existe.
  const negocio = await prisma.negocio.findUnique({ where: { idNegocio: 1 }, select: { nombre: true, logoPath: true } })
  // La foto no va en la sesión: se lee acá para que cambiarla se vea sin volver a iniciar sesión.
  const perfil = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario }, select: { fotoPerfilPath: true },
  })

  return (
    <SucursalActivaProvider valor={sucursalActiva}>
      <div className="min-h-screen bg-surface md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <PanelSidebar rol={sesion.user.rol} nombreNegocio={negocio?.nombre ?? 'Mise'} logoUrl={urlImagenPublica(negocio?.logoPath ?? null)} />
        <div className="min-w-0 px-3 md:pl-0">
          <BarraSuperior
            nombre={sesion.user.name ?? 'Usuario'}
            rol={sesion.user.rol}
            fotoUrl={urlImagenPublica(perfil?.fotoPerfilPath ?? null)}
          />
          {/* Esquinas redondeadas del panel al desplazarse: la barra blanca queda encima del contenido
              y, sin esto, corta el panel en recto. Son dos recortes pegados bajo la barra (5rem). */}
          <div aria-hidden="true" className="pointer-events-none sticky top-20 z-30 -mb-6 h-6">
            <span className="absolute top-0 left-0 size-6" style={{ background: 'radial-gradient(circle at 100% 100%, transparent 1.5rem, var(--surface) 1.5rem)' }} />
            <span className="absolute top-0 right-0 size-6" style={{ background: 'radial-gradient(circle at 0% 100%, transparent 1.5rem, var(--surface) 1.5rem)' }} />
          </div>
          {/* Alto de pantalla menos la barra (5rem) y el margen inferior (0.75rem). */}
          <div className="mb-3 min-h-[calc(100vh-5.75rem)] rounded-3xl bg-bg">
            {children}
          </div>
        </div>
      </div>
    </SucursalActivaProvider>
  )
}
