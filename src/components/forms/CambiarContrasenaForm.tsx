'use client'

// Formulario de cambio de contraseña forzado (primer login). Recibe la Server Action
// `accion` por props (definida en app/acceso/cambiar-contrasena/page.tsx) y la llama
// directamente, sin pasar por fetch/API.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CampoAcceso } from '@/components/acceso/CampoAcceso'
import { AvisoError, claseBotonAcento, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { LockKeyhole, ShieldCheck } from '@/components/icons'

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
    <TarjetaAcceso
      icono={ShieldCheck}
      titulo="Cambiá tu contraseña"
      descripcion="Es tu primer ingreso: definí una contraseña nueva de al menos 6 caracteres antes de continuar."
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

        <CampoAcceso
          id="confirmacion"
          label="Confirmar contraseña"
          type="password"
          icono={LockKeyhole}
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          minLength={6}
          required
        />

        {error && <AvisoError>{error}</AvisoError>}

        <button type="submit" disabled={cargando} className={claseBotonAcento}>
          {cargando ? 'Guardando...' : 'Guardar y continuar'}
        </button>
      </form>
    </TarjetaAcceso>
  )
}
