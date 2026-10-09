'use client'

// Foto de perfil de la cuenta, en la pantalla Perfil. Solo el dueño la sube; sube y quita
// por /api/usuarios/:id/foto-perfil. Al terminar vuelve a pedir los datos del servidor
// para que la barra superior también muestre la foto nueva, sin recargar la página.

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ImagePlus, Trash2, User } from '@/components/icons'
import { AvisoFlotante } from '@/components/ui/AvisoFlotante'
import {
  TEXTO_FORMATOS_IMAGEN, TIPOS_IMAGEN, quitarImagen, subirImagen, validarImagen,
} from '@/lib/storage/imagenes-cliente'

// Respuesta de POST y DELETE /api/usuarios/:id/foto-perfil.
type RespuestaFoto = { mensaje: string; usuario: { fotoPerfilUrl: string | null } }

const claseBotonSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50'

interface CampoFotoPerfilProps {
  idUsuario: number
  iniciales: string
  fotoUrl: string | null
}

export function CampoFotoPerfil({ idUsuario, iniciales, fotoUrl: fotoUrlInicial }: CampoFotoPerfilProps) {
  const router = useRouter()
  const endpoint = `/api/usuarios/${idUsuario}/foto-perfil`
  const [fotoUrl, setFotoUrl] = useState(fotoUrlInicial)
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState(false)
  // Vista previa local mientras se sube: se ve la foto nueva al instante, atenuada.
  const [previa, setPrevia] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const ocupado = subiendo || quitando

  async function subir(archivo?: File) {
    if (input.current) input.current.value = ''
    if (!archivo) return
    setError('')
    setAviso('')
    const invalida = validarImagen(archivo)
    if (invalida) {
      setError(invalida)
      return
    }
    const urlPrevia = URL.createObjectURL(archivo)
    setPrevia(urlPrevia)
    setSubiendo(true)
    try {
      const data = await subirImagen<RespuestaFoto>(endpoint, archivo)
      setFotoUrl(data.usuario.fotoPerfilUrl)
      setAviso('Foto guardada.')
      router.refresh()
    } catch (e) {
      // Si falla, queda la foto anterior (el servidor no la tocó).
      setError(e instanceof Error ? e.message : 'No se pudo guardar la foto.')
    } finally {
      setPrevia(null)
      URL.revokeObjectURL(urlPrevia)
      setSubiendo(false)
    }
  }

  async function quitar() {
    setError('')
    setAviso('')
    setQuitando(true)
    try {
      const data = await quitarImagen<RespuestaFoto>(endpoint)
      setFotoUrl(data.usuario.fotoPerfilUrl)
      setAviso('Foto quitada.')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar la foto.')
    } finally {
      setQuitando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {previa || fotoUrl ? (
        // URL del bucket o vista previa local: no pasan por next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previa ?? fotoUrl ?? undefined}
          alt={previa ? 'Foto nueva, subiendo' : 'Tu foto de perfil'}
          className={`size-20 shrink-0 rounded-full object-cover transition-opacity ${previa ? 'opacity-50' : ''}`}
        />
      ) : (
        <span
          aria-label="Sin foto: se muestran tus iniciales"
          role="img"
          className="flex size-20 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl font-semibold text-accent"
        >
          {iniciales || <User className="size-8" />}
        </span>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input} type="file" accept={TIPOS_IMAGEN.join(',')} className="sr-only" tabIndex={-1}
            aria-label="Elegir foto de perfil" onChange={(e) => void subir(e.currentTarget.files?.[0])}
          />
          <button
            type="button" onClick={() => input.current?.click()} disabled={ocupado}
            aria-describedby="foto-perfil-ayuda" className={claseBotonSecundario}
          >
            <ImagePlus className="size-4" />
            {subiendo ? 'Subiendo...' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {fotoUrl && (
            <button
              type="button" onClick={quitar} disabled={ocupado}
              className={`${claseBotonSecundario} text-danger hover:bg-danger/10`}
            >
              <Trash2 className="size-4" />
              {quitando ? 'Quitando...' : 'Quitar foto'}
            </button>
          )}
        </div>
        <p id="foto-perfil-ayuda" className="text-xs text-muted">
          {TEXTO_FORMATOS_IMAGEN}. Se ve redonda: usá una imagen cuadrada.
          {!fotoUrl && ' Sin foto se muestran tus iniciales.'}
        </p>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
      {aviso && <AvisoFlotante mensaje={aviso} onCerrar={() => setAviso('')} />}
    </div>
  )
}
