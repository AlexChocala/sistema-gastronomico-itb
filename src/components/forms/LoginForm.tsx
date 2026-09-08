'use client'

// Formulario de login: email + password. Usa `signIn` de NextAuth en modo `redirect:
// false` para poder mostrar el error nosotros mismos y decidir a dónde redirigir según
// `debeCambiarContrasena`.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, getSession } from 'next-auth/react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setError('')
    setCargando(true)

    const resultado = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (!resultado || resultado.error) {
      setError('Email o contraseña incorrectos')
      setCargando(false)
      return
    }

    // signIn no devuelve los datos del usuario: pedimos la sesión recién creada para
    // saber si hay que forzar el cambio de contraseña antes de entrar al panel.
    const sesion = await getSession()

    if (sesion?.user.debeCambiarContrasena) {
      router.push('/acceso/cambiar-contrasena')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <Card>
      <form onSubmit={manejarSubmit} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Ingresar</h2>

        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          id="password"
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </Button>

        <Link
          href="/acceso/recuperar-contrasena"
          className="text-center text-sm text-neutral-600 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </Card>
  )
}
