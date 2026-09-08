'use client'

// Botón de cierre de sesión, reutilizable en cualquier pantalla del panel (dashboard,
// pedidos, productos, etc.). Tiene que ser un Client Component porque `signOut()` corre
// en el navegador: borra la cookie de sesión y después redirige. El estilo lo pone el
// Button genérico de components/ui — acá solo va la lógica de qué hace el click.

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/Button'

export function CerrarSesionButton() {
  return (
    <Button variant="secundario" onClick={() => signOut({ callbackUrl: '/acceso/login' })}>
      Cerrar sesión
    </Button>
  )
}
