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

    try {
      const resultado = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (!resultado || resultado.error || !resultado.ok) {
        // Un fallo del servidor no significa que la contraseña sea incorrecta.
        setError(resultado?.error === 'CredentialsSignin'
          ? 'Email o contraseña incorrectos'
          : 'No se pudo iniciar sesión por un problema del sistema. Intentá nuevamente más tarde.')
        return
      }

      const sesion = await getSession()
      if (!sesion?.user) {
        setError('No se pudo confirmar la sesión. Intentá ingresar nuevamente.')
        return
      }

      router.push(sesion.user.debeCambiarContrasena
        ? '/acceso/cambiar-contrasena'
        : '/dashboard')
    } catch {
      setError('No se pudo conectar con el sistema. Intentá nuevamente más tarde.')
    } finally {
      setCargando(false)
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
