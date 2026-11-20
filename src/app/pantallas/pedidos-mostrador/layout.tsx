import type { ReactNode } from 'react'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export const metadata = { title: 'Pantalla del cliente' }

// El equipo del monitor entra con su link de acceso; el personal, con su sesión.
export default function Layout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor pantalla="mostrador">{children}</ProveedorSucursalServidor>
}
