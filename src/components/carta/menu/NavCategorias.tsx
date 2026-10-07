'use client'

// Chips de categorías, fijos arriba al scrollear el menú. Tocar uno lleva a su sección; al
// scrollear, se resalta la categoría que se está viendo y su chip se acomoda a la vista.

import { useEffect, useRef, useState, type MouseEvent } from 'react'

export function idSeccion(idCategoria: number) {
  return `categoria-${idCategoria}`
}

function sinAnimacion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function NavCategorias({ categorias }: { categorias: { idCategoria: number; nombre: string }[] }) {
  const [activa, setActiva] = useState<number | null>(categorias[0]?.idCategoria ?? null)
  const contenedor = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const secciones = categorias
      .map((categoria) => document.getElementById(idSeccion(categoria.idCategoria)))
      .filter((seccion): seccion is HTMLElement => seccion !== null)
    // La franja "activa" es la parte de arriba de la pantalla, debajo de los chips.
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (!visible) return
        const id = Number(visible.target.getAttribute('data-categoria'))
        setActiva(id)
        const chip = contenedor.current?.querySelector<HTMLElement>(`[data-chip="${id}"]`)
        if (chip && contenedor.current) {
          contenedor.current.scrollTo({
            left: chip.offsetLeft - 16,
            behavior: sinAnimacion() ? 'auto' : 'smooth',
          })
        }
      },
      { rootMargin: '-72px 0px -65% 0px' },
    )
    secciones.forEach((seccion) => observador.observe(seccion))
    return () => observador.disconnect()
  }, [categorias])

  function irA(evento: MouseEvent<HTMLAnchorElement>, idCategoria: number) {
    const seccion = document.getElementById(idSeccion(idCategoria))
    if (!seccion) return
    evento.preventDefault()
    seccion.scrollIntoView({ behavior: sinAnimacion() ? 'auto' : 'smooth', block: 'start' })
    // El foco acompaña al scroll (teclado y lectores de pantalla), sin volver a mover la página.
    seccion.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    history.replaceState(null, '', `#${idSeccion(idCategoria)}`)
    setActiva(idCategoria)
  }

  return (
    <nav aria-label="Categorías del menú" className="sticky top-0 z-20 border-b border-border/60 bg-bg/95 backdrop-blur">
      <ul ref={contenedor} className="scrollbar-oculta relative mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3">
        {categorias.map((categoria) => {
          const esActiva = categoria.idCategoria === activa
          return (
            <li key={categoria.idCategoria} data-chip={categoria.idCategoria} className="shrink-0">
              <a
                href={`#${idSeccion(categoria.idCategoria)}`}
                onClick={(evento) => irA(evento, categoria.idCategoria)}
                aria-current={esActiva ? 'true' : undefined}
                className={`flex min-h-11 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  esActiva ? 'bg-accent text-on-accent shadow-sm' : 'bg-surface text-text hover:bg-accent-soft'
                }`}
              >
                {categoria.nombre}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
