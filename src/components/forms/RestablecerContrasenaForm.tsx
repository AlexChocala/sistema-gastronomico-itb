'use client'

// Pide la nueva contraseña y llama a /api/auth/restablecer-contrasena con el token recibido
// por props. La página servidor (app/acceso/restablecer-contrasena/page.tsx) ya validó
// ese token con verificarTokenReset antes de renderizar este componente, así que acá
// no hace falta re-chequear si vino vacío o inválido.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CampoAcceso } from '@/components/acceso/CampoAcceso'
import { AvisoError, claseBotonAcento, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { ArrowRight, CircleCheck, KeyRound, LockKeyhole } from '@/components/icons'

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

    const respuesta = await fetch('/api/auth/restablecer-contrasena', {
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
      <TarjetaAcceso
        icono={CircleCheck}
        tono="exito"
        titulo="¡Contraseña actualizada!"
        descripcion="Ya podés ingresar con tu nueva contraseña."
      >
        <button type="button" onClick={() => router.push('/acceso/login')} className={claseBotonAcento}>
          Ingresar nuevamente
          <ArrowRight className="size-4" />
        </button>
      </TarjetaAcceso>
    )
  }

  return (
    <TarjetaAcceso
      icono={KeyRound}
      titulo="Creá una nueva contraseña"
      descripcion="Elegí una contraseña de al menos 6 caracteres."
    >
      <form onSubmit={manejarSubmit} className="flex flex-col gap-5">
        <CampoAcceso
          id="password"
          label="Nueva contraseña"
          type="password"
          icono={LockKeyhole}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <AvisoError>{error}</AvisoError>}

        <button type="submit" disabled={cargando} className={claseBotonAcento}>
          {cargando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </TarjetaAcceso>
  )
}
