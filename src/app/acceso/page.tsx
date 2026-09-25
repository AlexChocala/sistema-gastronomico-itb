// Pantalla de bienvenida de la sección de acceso: título y un botón que lleva
// al formulario de login.

import Link from 'next/link'
import { claseBotonAcento, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { ArrowRight, UtensilsCrossed } from '@/components/icons'

export default function AccesoPage() {
  return (
    <TarjetaAcceso
      icono={UtensilsCrossed}
      titulo="Bienvenido a Mise"
      descripcion="Gestioná pedidos, caja, cocina y sucursales desde un solo lugar."
    >
      <Link href="/acceso/login" className={claseBotonAcento}>
        Ingresar
        <ArrowRight className="size-4" />
      </Link>
    </TarjetaAcceso>
  )
}
