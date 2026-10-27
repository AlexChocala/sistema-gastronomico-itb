'use client'

// Botón de cierre de sesión, reutilizable en cualquier pantalla del panel (dashboard,
// pedidos, productos, etc.). Tiene que ser un Client Component porque `signOut()` corre
// en el navegador: borra la cookie de sesión y después redirige. Se ve como un ítem más
// del menú, con el mismo estilo que los links del sidebar.

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { LogOut } from '@/components/icons'
import { confirmarSalidaConCambios, cancelarSalidaConCambios } from '@/lib/utils/salida-con-cambios'

// `className` permite usarlo fuera del sidebar (ej: pantalla de configuración inicial).
export function CerrarSesionButton({
  className = 'nav-item cursor-pointer text-left text-muted hover:bg-surface-muted hover:text-danger',
}: { className?: string }) {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  return (
    <>
    <button
      type="button"
      onClick={async () => {
        if (ocupado || !confirmarSalidaConCambios()) return
        setError(''); setOcupado(true)
        try { await signOut({ callbackUrl: '/acceso/login' }) }
        catch {
          cancelarSalidaConCambios()
          setError('No pudimos confirmar el cierre de sesión. Revisá tu conexión e intentá nuevamente.')
        } finally { setOcupado(false) }
      }}
      disabled={ocupado}
      className={className}
    >
      <LogOut strokeWidth={1.75} className="size-(--sidebar-icono) shrink-0" />
      Cerrar sesión
    </button>
    {error && <Aviso tipo="error" onCerrar={() => setError('')}>{error}</Aviso>}
    </>
  )
}
