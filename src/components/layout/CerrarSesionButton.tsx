'use client'

// Botón de cierre de sesión, reutilizable en cualquier pantalla del panel (dashboard,
// pedidos, productos, etc.). Tiene que ser un Client Component porque `signOut()` corre
// en el navegador: borra la cookie de sesión y después redirige. Se ve como un ítem más
// del menú, con el mismo estilo que los links del sidebar.

import { signOut } from 'next-auth/react'
import { LogOut } from '@/components/icons'

// `className` permite usarlo fuera del sidebar (ej: pantalla de configuración inicial).
export function CerrarSesionButton({
  className = 'nav-item cursor-pointer text-left text-muted hover:bg-surface-muted hover:text-danger',
}: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/acceso/login' })}
      className={className}
    >
      <LogOut strokeWidth={1.75} className="size-(--sidebar-icono) shrink-0" />
      Cerrar sesión
    </button>
  )
}
