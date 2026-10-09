import type { ReactNode } from 'react'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export default function EntregasLayout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor>{children}</ProveedorSucursalServidor>
}
