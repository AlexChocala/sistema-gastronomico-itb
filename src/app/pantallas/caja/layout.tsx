import type { ReactNode } from 'react'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export const metadata = { title: 'Caja' }

export default function CajaLayout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor>{children}</ProveedorSucursalServidor>
}
