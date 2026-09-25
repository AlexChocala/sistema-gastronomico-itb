import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Mail, ShieldCheck, Store, User, type LucideIcon } from '@/components/icons'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function iniciales(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

function Dato({ icono: Icono, label, children }: { icono: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-bg p-4">
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
      nombre: true, apellido: true, email: true, fotoPerfilPath: true,
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
        <div className="flex items-center gap-4">
          {/* Cuando se conecte Supabase Storage, si hay fotoPerfilPath se arma la URL
              pública desde esa ruta y se muestra la imagen. Por ahora, siempre las iniciales. */}
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl font-semibold text-accent">
            {iniciales(usuario.nombre, usuario.apellido) || <User className="size-8" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg">{usuario.nombre} {usuario.apellido}</p>
            <p className="text-sm capitalize text-muted">{usuario.rol.nombre}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Dato icono={User} label="Nombre">{usuario.nombre}</Dato>
          <Dato icono={User} label="Apellido">{usuario.apellido}</Dato>
          <Dato icono={Mail} label="Email">{usuario.email}</Dato>
          <Dato icono={ShieldCheck} label="Rol"><span className="capitalize">{usuario.rol.nombre}</span></Dato>
          <Dato icono={Store} label="Sucursal">
            {usuario.sucursal ? usuario.sucursal.nombre.replace('Prueba - ', '') : 'Sin sucursal asignada'}
          </Dato>
        </div>
      </section>
    </main>
  )
}
