import type { ReactNode } from 'react'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Mail, ShieldCheck, Store, User, type LucideIcon } from '@/components/icons'
import { authOptions } from '@/lib/auth/auth'
import { CampoFotoPerfil } from '@/components/perfil/CampoFotoPerfil'
import { CampoPin } from '@/components/perfil/CampoPin'
import { prisma } from '@/lib/db/prisma'
import { urlImagenPublica } from '@/lib/storage/imagenes'

function iniciales(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

function Dato({ icono: Icono, label, className = '', children }: { icono: LucideIcon; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-bg p-4 ${className}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
        <Icono className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate">{children}</p>
      </div>
    </div>
  )
}

export default async function PerfilPage() {
  const sesion = await getServerSession(authOptions)

  if (!sesion) {
    redirect('/acceso/login')
  }

  // Los datos se leen de la base con el id de la sesión: nunca de algo que mande el cliente.
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: {
      nombre: true, apellido: true, email: true, fotoPerfilPath: true, pinClave: true,
      rol: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
    },
  })

  if (!usuario) {
    redirect('/acceso/login')
  }

  return (
    <main className="flex flex-col gap-6 p-6" lang="es">
      <header>
        <h1 className="page-title">Perfil</h1>
        <p className="mt-1 text-sm text-muted">Tus datos de acceso al sistema.</p>
      </header>

      <section className="flex max-w-2xl flex-col gap-6 rounded-3xl bg-surface p-6 shadow-sm">
        <CampoFotoPerfil
          idUsuario={sesion.user.idUsuario}
          iniciales={iniciales(usuario.nombre, usuario.apellido)}
          fotoUrl={urlImagenPublica(usuario.fotoPerfilPath)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Dato icono={User} label="Nombre">{usuario.nombre}</Dato>
          <Dato icono={User} label="Apellido">{usuario.apellido}</Dato>
          {/* El email va en una fila entera para que se lea completo. */}
          <Dato icono={Mail} label="Email" className="sm:col-span-2">{usuario.email}</Dato>
          <Dato icono={ShieldCheck} label="Rol"><span className="capitalize">{usuario.rol.nombre}</span></Dato>
          <Dato icono={Store} label="Sucursal">
            {usuario.sucursal
              ? usuario.sucursal.nombre.replace('Prueba - ', '')
              : usuario.rol.nombre === 'admin' ? 'Todas las sucursales' : 'Sin sucursal asignada'}
          </Dato>
        </div>

        {/* El PIN identifica a quien cobra: lo usan empleados y supervisores, no el administrador. */}
        {usuario.rol.nombre !== 'admin' && <CampoPin tienePin={usuario.pinClave !== null} />}
      </section>
      <Link href="/acceso/cambiar-contrasena" className="self-start rounded-full border border-border bg-surface px-5 py-2.5 text-sm hover:bg-surface-muted">Cambiar mi contraseña</Link>
    </main>
  )
}

export const metadata = { title: 'Perfil' }
