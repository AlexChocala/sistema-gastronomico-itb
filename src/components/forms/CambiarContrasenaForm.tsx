'use client'

// Formulario de cambio de contraseña forzado (primer login). Recibe la Server Action
// `accion` por props (definida en app/acceso/cambiar-contrasena/page.tsx) y la llama
// directamente, sin pasar por fetch/API.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface CambiarContrasenaFormProps {
  accion: (password: string) => Promise<void>
}

export function CambiarContrasenaForm({ accion }: CambiarContrasenaFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setError('')

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)
    try {
      await accion(password)
      router.push('/dashboard')
    } catch {
      setError('No se pudo actualizar la contraseña')
      setCargando(false)
    }
  }

  return (
    <Card>
      <form onSubmit={manejarSubmit} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Cambiá tu contraseña</h2>
        <p className="text-sm text-neutral-600">
          Es tu primer ingreso: tenés que definir una contraseña nueva antes de continuar.
        </p>

        <Input
          id="password"
          label="Nueva contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <Input
          id="confirmacion"
          label="Confirmar contraseña"
          type="password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          minLength={6}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={cargando}>
          {cargando ? 'Guardando...' : 'Guardar y continuar'}
        </Button>
      </form>
    </Card>
  )
}
