// Espacio de la foto de un producto. Mientras no haya imagen (Supabase Storage todavía no
// está conectado) muestra un fondo neutro con el ícono de su categoría; cuando llegue la
// URL se muestra sola.

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
        // TODO: con Supabase Storage, pasar a next/image (requiere el dominio en next.config.ts).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagenUrl} alt={nombre} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted/40" aria-hidden="true">
          <IconoCategoria categoria={categoria} className="size-1/3 max-h-24 max-w-24" strokeWidth={1.25} />
        </div>
      )}
    </div>
  )
}
