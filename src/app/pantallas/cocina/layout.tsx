import type { ReactNode } from 'react'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export const metadata = { title: 'Cocina' }

export default function CocinaLayout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor pantalla="cocina">{children}</ProveedorSucursalServidor>
}
