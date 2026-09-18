'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CerrarSesionButton } from '@/components/layout/CerrarSesionButton'

const enlaces = [
  { href: '/dashboard', texto: 'Dashboard' },
  { href: '/productos', texto: 'Productos' },
]

const seccionesPendientes = ['Pedidos', 'Reportes', 'Usuarios']

export function PanelSidebar({ nombre, rol }: { nombre: string; rol: string }) {
  const rutaActual = usePathname()

  return (
    <aside className="flex flex-col gap-6 border-b p-4 md:min-h-screen md:border-r md:border-b-0">
      <div className="rounded-lg border p-6 text-center font-semibold">
        Logo
      </div>

      <nav aria-label="Menú principal" className="flex flex-col gap-2">
        <p className="text-xs uppercase opacity-70">Menú</p>
        {enlaces.map((enlace) => {
          const activo = rutaActual === enlace.href || rutaActual.startsWith(`${enlace.href}/`)
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              aria-current={activo ? 'page' : undefined}
              className={`rounded-md border px-3 py-2 ${activo ? 'font-semibold underline underline-offset-4' : ''}`}
            >
              {enlace.texto}
            </Link>
          )
        })}
        {seccionesPendientes.map((seccion) => (
          <span key={seccion} className="px-3 py-2 opacity-60" aria-disabled="true">
            {seccion}
          </span>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="border-t pt-4">
          <p className="font-medium">{nombre}</p>
          <p className="text-sm capitalize opacity-70">{rol}</p>
        </div>
        <nav aria-label="Menú de usuario" className="flex flex-col gap-2">
          <p className="text-xs uppercase opacity-70">General</p>
          <span className="px-3 py-2 opacity-60" aria-disabled="true">Perfil</span>
          <CerrarSesionButton />
        </nav>
      </div>
    </aside>
  )
}
