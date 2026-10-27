import type { ReactNode } from 'react'
import { ControlAccesoPantalla } from '@/components/asistencia/ControlAccesoPantalla'
import { ProveedorSucursalServidor } from '@/components/sucursal/ProveedorSucursalServidor'

export default function EntregasLayout({ children }: { children: ReactNode }) {
  return <ProveedorSucursalServidor><ControlAccesoPantalla>{children}</ControlAccesoPantalla></ProveedorSucursalServidor>
}
