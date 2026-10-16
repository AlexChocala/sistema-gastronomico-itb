'use client'

import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ambitoParaRuta, type AmbitoTema, type Tema } from '@/lib/tema/tema'
import {
  aplicarTema, escucharTema, escucharTemaAplicado, guardarTema, leerTema, leerTemaAplicado,
} from '@/lib/tema/tema-navegador'

type ContextoTema = { tema: Tema; ambito: AmbitoTema; elegirTema: (tema: Tema) => void }
const Contexto = createContext<ContextoTema | null>(null)
const temaDelServidor = (): Tema => 'claro'

export function ProveedorTema({ children }: { children: ReactNode }) {
  const ruta = usePathname()
  const ambito = ambitoParaRuta(ruta ?? '/')
  const tema = useSyncExternalStore(escucharTema, () => leerTema(ambito), temaDelServidor)

  useLayoutEffect(() => {
    // Se relee la preferencia para conservar el tema del script inicial durante la
    // hidratación y aplicar el ámbito correcto al navegar con el router.
    aplicarTema(leerTema(ambito), ambito)
  }, [ambito, tema])

  return (
    <Contexto.Provider value={{ tema, ambito, elegirTema: elegido => guardarTema(ambito, elegido) }}>
      {children}
    </Contexto.Provider>
  )
}

export function useTema() {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useTema necesita ProveedorTema.')
  return contexto
}

export function useTemaAplicado() {
  return useSyncExternalStore(escucharTemaAplicado, leerTemaAplicado, temaDelServidor)
}
