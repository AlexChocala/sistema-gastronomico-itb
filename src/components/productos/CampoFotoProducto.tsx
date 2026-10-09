'use client'

// Foto del producto dentro del formulario. No sube nada: solo muestra la vista previa y
// avisa qué eligió el usuario. Se guarda recién con "Crear producto" o "Guardar cambios"
// (si cancela, no se sube nada). Ver guardar() en GestionProductosForm.

import { useEffect, useMemo, useRef } from 'react'
import { ImagePlus, Trash2 } from '@/components/icons'
import { IconoCategoria } from '@/components/icons/IconoCategoria'
import { TEXTO_FORMATOS_IMAGEN, TIPOS_IMAGEN } from '@/lib/storage/imagenes-cliente'

interface CampoFotoProductoProps {
  // La foto guardada (al editar); null si no tiene.
  urlActual: string | null
  // Foto nueva elegida y todavía sin guardar.
  archivo: File | null
  // El usuario pidió quitar la foto guardada.
  quitar: boolean
  categoria: string
  onElegir: (archivo: File) => void
  onQuitar: () => void
  error: string
  deshabilitado: boolean
}

export function CampoFotoProducto({
  urlActual, archivo, quitar, categoria, onElegir, onQuitar, error, deshabilitado,
}: CampoFotoProductoProps) {
  const input = useRef<HTMLInputElement>(null)
  // Vista previa del archivo elegido; se libera al cambiarlo o al cerrar el formulario.
  const previa = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo])
  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa)
  }, [previa])

  const visible = previa ?? (quitar ? null : urlActual)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">
        Foto <span className="text-muted">(opcional)</span>
      </span>
      <div className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-bg">
          {visible ? (
            // URL del bucket o vista previa local: no pasan por next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={visible} alt="Foto del producto" className="size-full object-contain p-1" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted/50" aria-hidden="true">
              <IconoCategoria categoria={categoria} className="size-8" strokeWidth={1.25} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={input} type="file" accept={TIPOS_IMAGEN.join(',')} className="sr-only" tabIndex={-1}
            aria-label="Elegir foto del producto"
            onChange={(evento) => {
              const elegido = evento.currentTarget.files?.[0]
              evento.currentTarget.value = ''
              if (elegido) onElegir(elegido)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} disabled={deshabilitado}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50">
              <ImagePlus className="size-4" />
              {visible ? 'Cambiar foto' : 'Elegir foto'}
            </button>
            {visible && (
              <button type="button" onClick={onQuitar} disabled={deshabilitado}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="size-4" />
                Quitar
              </button>
            )}
          </div>
          <p className="text-xs text-muted">{TEXTO_FORMATOS_IMAGEN}. Se guarda al guardar el producto.</p>
          <p className="text-xs text-muted">Se ve mejor en PNG o WebP con fondo transparente.</p>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  )
}
