// Layout de 2 columnas para toda la sección pública de acceso (bienvenida, login,
// recupero de contraseña, cambio forzado). Columna izquierda: contenido de cada
// página hija. Columna derecha: identidad del sistema.

import type { ReactNode } from 'react'

export default function AccesoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col items-center justify-center p-6 md:w-1/2">
        {children}
      </div>

      <div className="hidden w-1/2 flex-col items-center justify-center bg-neutral-900 text-white md:flex">
        <h1 className="text-3xl font-bold">Sistema Restaurante</h1>
        <p className="mt-2 text-neutral-400">Gestión de pedidos y sucursales</p>
      </div>
    </div>
  )
}
