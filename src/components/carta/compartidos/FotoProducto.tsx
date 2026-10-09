// Espacio de la foto de un producto: la imagen de Supabase Storage si tiene, o un fondo
// neutro con el ícono de su categoría si no.

import { IconoCategoria } from '@/components/icons/IconoCategoria'

export function FotoProducto({
  nombre,
  categoria,
  imagenUrl = null,
  className = '',
}: {
  nombre: string
  categoria: string
  imagenUrl?: string | null
  className?: string
}) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-bg ${className}`}>
      {imagenUrl ? (
        // <img> y no next/image: las fotos ya vienen livianas (máximo 2 MB) desde el bucket.
        // Entera (contain), sin recortar: con PNG/WebP de fondo transparente el plato "flota".
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagenUrl} alt={nombre} loading="lazy" decoding="async" className="size-full object-contain p-1" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted/40" aria-hidden="true">
          <IconoCategoria categoria={categoria} className="size-1/3 max-h-24 max-w-24" strokeWidth={1.25} />
        </div>
      )}
    </div>
  )
}
