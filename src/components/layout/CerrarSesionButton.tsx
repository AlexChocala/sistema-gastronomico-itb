'use client'

// Botón de cierre de sesión, reutilizable en cualquier pantalla del panel (dashboard,
// pedidos, productos, etc.). Tiene que ser un Client Component porque `signOut()` corre
// en el navegador: borra la cookie de sesión y después redirige. El estilo lo pone el
// Button genérico de components/ui — acá solo va la lógica de qué hace el click.

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/Button'

export function CerrarSesionButton() {
  return (
    // Button trae `w-full` fijo en su base (así se usa en los forms, adentro de un Card
    // angosto). Acá no hay ningún Card conteniéndolo, así que sin este override el botón
    // se estira al ancho de toda la pantalla. El "!" fuerza la anulación de w-full sin
    // depender del orden en que Tailwind genere las clases (concatenar className a mano,
    // sin una librería tipo tailwind-merge, no garantiza que la última clase gane).
    <Button
      variant="secundario"
      className="w-auto!"
      onClick={() => signOut({ callbackUrl: '/acceso/login' })}
    >
      Cerrar sesión
    </Button>
  )
}
