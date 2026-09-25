'use client'

// Pide el email y llama a /api/auth/recuperar-contrasena. Siempre muestra el mismo mensaje
// de éxito, exista o no el email (ver el comentario sobre enumeración de usuarios en
// esa API).

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CampoAcceso } from '@/components/acceso/CampoAcceso'
import {
  claseBotonAcento, claseEnlaceSecundario, TarjetaAcceso,
} from '@/components/acceso/ElementosAcceso'
import { ArrowLeft, KeyRound, Mail, MailCheck } from '@/components/icons'

function VolverAlLogin() {
  return (
    <Link href="/acceso/login" className={`${claseEnlaceSecundario} w-full`}>
      <ArrowLeft className="size-4" />
      Volver a ingresar
    </Link>
  )
}

export function RecuperarContrasenaForm() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    setCargando(true)

    await fetch('/api/auth/recuperar-contrasena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setCargando(false)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <TarjetaAcceso
        icono={MailCheck}
        tono="exito"
        titulo="Revisá tu email"
        descripcion={
          <>
            Si <strong className="text-text">{email}</strong> está registrado, vas a recibir un link
            para restablecer tu contraseña. Por ahora el link se muestra en la consola del servidor
            (todavía no hay un proveedor de email real configurado).
          </>
        }
      >
        <VolverAlLogin />
      </TarjetaAcceso>
    )
  }

  return (
    <TarjetaAcceso
      icono={KeyRound}
      titulo="Recuperá tu contraseña"
      descripcion="Ingresá tu email y te enviamos un link para crear una nueva."
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

        <button type="submit" disabled={cargando} className={claseBotonAcento}>
          {cargando ? 'Enviando...' : 'Enviar link de recupero'}
        </button>

        <VolverAlLogin />
      </form>
    </TarjetaAcceso>
  )
}
