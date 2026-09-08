// Pantalla de bienvenida de la sección de acceso: título y un botón que lleva
// al formulario de login.

import Link from 'next/link'

export default function AccesoPage() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h2 className="text-2xl font-semibold">Sistema Restaurante</h2>
      <Link
        href="/acceso/login"
        className="rounded-md bg-neutral-900 px-6 py-2 font-medium text-white hover:bg-neutral-700"
      >
        Ingresar
      </Link>
    </div>
  )
}
