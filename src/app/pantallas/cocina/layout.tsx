import type { ReactNode } from 'react'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export default function CocinaLayout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor>{children}</ProveedorSucursalServidor>
}
