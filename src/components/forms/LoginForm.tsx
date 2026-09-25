'use client'

// Formulario de login: email + password. Usa `signIn` de NextAuth en modo `redirect:
// false` para poder mostrar el error nosotros mismos y decidir a dónde redirigir según
// `debeCambiarContrasena`.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, getSession } from 'next-auth/react'
import { CampoAcceso } from '@/components/acceso/CampoAcceso'
import { AvisoError, claseBotonAcento, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { ArrowRight, LockKeyhole, Mail, UtensilsCrossed } from '@/components/icons'

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
    <TarjetaAcceso
      icono={UtensilsCrossed}
      titulo="Ingresá a tu cuenta"
      descripcion="Usá el email y la contraseña que te dio el administrador."
    >
      <form onSubmit={manejarSubmit} className="flex flex-col gap-5">
        <CampoAcceso
          id="email"
          label="Email"
          type="email"
          icono={Mail}
          placeholder="tu@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <CampoAcceso
          id="password"
          label="Contraseña"
          type="password"
          icono={LockKeyhole}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <AvisoError>{error}</AvisoError>}

        <button type="submit" disabled={cargando} className={claseBotonAcento}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
          {!cargando && <ArrowRight className="size-4" />}
        </button>

        <Link
          href="/acceso/recuperar-contrasena"
          className="self-center text-sm text-muted transition-colors hover:text-accent"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </TarjetaAcceso>
  )
}
