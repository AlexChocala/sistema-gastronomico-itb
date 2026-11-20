import type { ReactNode } from 'react'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export const metadata = { title: 'Entregas' }

export default function EntregasLayout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor>{children}</ProveedorSucursalServidor>
}
