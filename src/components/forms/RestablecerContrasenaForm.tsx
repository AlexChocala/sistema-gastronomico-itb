'use client'

// Pide la nueva contraseña y llama a /api/auth/reset-password con el token recibido
// por props. La página servidor (app/acceso/restablecer-contrasena/page.tsx) ya validó
// ese token con verificarTokenReset antes de renderizar este componente, así que acá
// no hace falta re-chequear si vino vacío o inválido.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function RestablecerContrasenaForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [exito, setExito] = useState(false)

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setError('')
    setCargando(true)

    const respuesta = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      setError(datos.error ?? 'No se pudo actualizar la contraseña')
      setCargando(false)
      return
    }

    // Ya no redirigimos solos: mostramos la confirmación y dejamos que sea la persona
    // quien decida ir al login, con el botón de abajo.
    setExito(true)
  }

  if (exito) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-neutral-700">¡Contraseña actualizada con éxito!</p>
          <Button onClick={() => router.push('/acceso/login')}>Ingresar nuevamente</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={manejarSubmit} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Nueva contraseña</h2>

        <Input
          id="password"
          label="Nueva contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={cargando}>
          {cargando ? 'Guardando...' : 'Guardar contraseña'}
        </Button>
      </form>
    </Card>
  )
}
