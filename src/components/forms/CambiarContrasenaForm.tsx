'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CampoAcceso } from '@/components/acceso/CampoAcceso'
import { AvisoError, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { Button, estilosBoton } from '@/components/ui/Button'
import { LockKeyhole, ShieldCheck } from '@/components/icons'
import type { DatosCambioContrasena, ResultadoCambioContrasena } from '@/lib/auth/cambiar-contrasena'

interface CambiarContrasenaFormProps {
  accion: (datos: DatosCambioContrasena) => Promise<ResultadoCambioContrasena>
  cambioObligatorio?: boolean
}

export function CambiarContrasenaForm({ accion, cambioObligatorio = false }: CambiarContrasenaFormProps) {
  const [actual, setActual] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardada, setGuardada] = useState(false)

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    if (cargando) return
    setError('')
    if (password !== confirmacion) { setError('Las contraseñas nuevas no coinciden.'); return }
    if (actual === password) { setError('Elegí una contraseña diferente de la actual.'); return }
    setCargando(true)
    try {
      const resultado = await accion({ actual, nueva: password, confirmacion })
      if (resultado.error) { setError(resultado.error); return }
      setActual(''); setPassword(''); setConfirmacion(''); setGuardada(true)
    } catch {
      setError('No se pudo actualizar la contraseña. Intentá nuevamente.')
    } finally { setCargando(false) }
  }

  if (guardada) return (
    <TarjetaAcceso icono={ShieldCheck} titulo="Contraseña actualizada" descripcion="Tu nueva contraseña ya está guardada.">
      <Link href={cambioObligatorio ? '/dashboard' : '/perfil'} className={`${estilosBoton({ variant: 'acento' })} rounded-full!`}>
        {cambioObligatorio ? 'Continuar' : 'Volver a mi perfil'}
      </Link>
    </TarjetaAcceso>
  )

  return (
    <TarjetaAcceso
      icono={ShieldCheck}
      titulo="Cambiá tu contraseña"
      descripcion={cambioObligatorio
        ? 'Ingresá la contraseña temporal con la que accediste y elegí una nueva de al menos 6 caracteres.'
        : 'Para proteger tu cuenta, confirmá tu contraseña actual y elegí una nueva de al menos 6 caracteres.'}
    >
      <form onSubmit={manejarSubmit} className="flex flex-col gap-5">
        <CampoAcceso id="actual" label="Contraseña actual" type="password" icono={LockKeyhole}
          autoComplete="current-password" value={actual} onChange={e => setActual(e.target.value)} required disabled={cargando} />
        <CampoAcceso id="password" label="Nueva contraseña" type="password" icono={LockKeyhole}
          autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required disabled={cargando} />
        <CampoAcceso id="confirmacion" label="Confirmar nueva contraseña" type="password" icono={LockKeyhole}
          autoComplete="new-password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} minLength={6} required disabled={cargando} />
        {error && <AvisoError>{error}</AvisoError>}
        <Button type="submit" variant="acento" disabled={cargando} className="rounded-full!">
          {cargando ? 'Guardando...' : 'Guardar contraseña'}
        </Button>
        {!cambioObligatorio && <Link href="/perfil" className={`${estilosBoton({ variant: 'secundario' })} rounded-full!`}>Cancelar</Link>}
      </form>
    </TarjetaAcceso>
  )
}
