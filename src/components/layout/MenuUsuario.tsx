'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { CerrarSesionButton } from '@/components/layout/CerrarSesionButton'
import { User } from '@/components/icons'
import { useCerrarAlSalir } from '@/lib/utils/useCerrarAlSalir'

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('')
}

const claseOpcion = 'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-muted'

export function MenuUsuario({ nombre, rol }: { nombre: string; rol: string }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  useCerrarAlSalir(abierto, setAbierto, contenedor, boton)

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label="Menú de usuario"
        aria-expanded={abierto}
        className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
      >
        {iniciales(nombre)}
      </button>

      {abierto && (
        <div className="absolute top-full right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-2xl bg-surface p-2 shadow-xl">
          <div className="border-b border-border px-3 pt-1 pb-3">
            <p className="truncate text-sm font-medium">{nombre}</p>
            <p className="text-xs capitalize text-muted">{rol}</p>
          </div>
          <Link href="/perfil" onClick={() => setAbierto(false)} className={claseOpcion + ' hover:text-text'}>
            <User strokeWidth={1.75} className="size-(--sidebar-icono) shrink-0" />
            Perfil
          </Link>
          <CerrarSesionButton className={claseOpcion + ' hover:text-danger'} />
        </div>
      )}
    </div>
  )
}
