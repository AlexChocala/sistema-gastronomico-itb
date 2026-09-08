'use client'

// Pide el email y llama a /api/auth/forgot-password. Siempre muestra el mismo mensaje
// de éxito, exista o no el email (ver el comentario sobre enumeración de usuarios en
// esa API).

import { useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function RecuperarContrasenaForm() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setCargando(true)

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setCargando(false)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <Card>
        <p className="text-center text-sm text-neutral-700">
          Si el email existe, vas a recibir un link de recupero. Revisá la consola del
          servidor (todavía no hay un proveedor de email real configurado).
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={manejarSubmit} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Recuperar contraseña</h2>

        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Button type="submit" disabled={cargando}>
          {cargando ? 'Enviando...' : 'Enviar link de recupero'}
        </Button>
      </form>
    </Card>
  )
}
