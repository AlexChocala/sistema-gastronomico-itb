'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { Button, estilosBoton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { usePermisoPantallas } from '@/lib/pedidos/pedidos-pantallas'

export function ControlAccesoPantalla({ children }: { children: ReactNode }) {
  const permiso = usePermisoPantallas()
  if (permiso.puedeRegistrar) return children
  return <main className="p-6">
    <Card className="max-w-none! rounded-3xl! border-0! flex flex-col gap-4">
      <h1 className="page-title">Pantalla no disponible</h1>
      <Aviso tipo={permiso.cargando ? 'info' : 'advertencia'}>{permiso.cargando ? 'Verificando tu turno…' : permiso.mensaje ?? 'Iniciá tu turno dentro del horario asignado para operar.'}</Aviso>
      <div className="flex flex-wrap gap-3">
        <Link href="/perfil/asistencia" target="_blank" rel="noopener noreferrer" className={`${estilosBoton({ variant: 'secundario' })} w-auto! rounded-full!`}>Mi asistencia</Link>
        <Button variant="secundario" className="w-auto! rounded-full!" onClick={() => void permiso.recargar()}>Volver a verificar</Button>
      </div>
    </Card>
  </main>
}
