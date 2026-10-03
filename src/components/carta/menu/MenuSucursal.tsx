'use client'

// Carta de una sucursal con su carrito: categorías, productos (tocar la tarjeta o
// "Agregar" abre el modal del producto para elegir opciones y cantidad) y la barra fija
// para ir al carrito. Los datos llegan del servidor (app/[sucursal]/page.tsx); acá solo
// vive la interacción.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, UtensilsCrossed } from '@/components/icons'
import { cantidadDeProducto, nombreLinea, useCarrito, type EleccionProducto } from '@/lib/pedidos/carrito'
import { MAX_CANTIDAD_ITEM, MAX_ITEMS_PEDIDO } from '@/lib/pedidos/pedidos-validacion'
import { formatearPrecio } from '@/lib/utils/precio'
import type { CategoriaMenu, ProductoMenu } from '@/lib/sucursales/sucursales-publicas'
import { AvisoQuitados } from '@/components/carta/compartidos/AvisoQuitados'
import { BarraCarrito } from '@/components/carta/compartidos/BarraCarrito'
import { FotoProducto } from '@/components/carta/compartidos/FotoProducto'
import { NavCategorias, idSeccion } from './NavCategorias'
import { ModalProducto } from './ModalProducto'

export function MenuSucursal({ slug, categorias }: { slug: string; categorias: CategoriaMenu[] }) {
  const carrito = useCarrito(slug)
  const { reconciliar } = carrito
  // Aviso visible (topes alcanzados) y anuncio solo para lectores de pantalla.
  const [aviso, setAviso] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Producto con el modal abierto, con el nombre de su categoría (null = cerrado).
  const [elegido, setElegido] = useState<{ producto: ProductoMenu; categoria: string } | null>(null)

  // Con variaciones y extras: la carta puede reconciliar también las opciones.
  const productos = useMemo(() => categorias.flatMap((categoria) => categoria.productos), [categorias])

  // Al abrir el menú, el carrito guardado se pone al día: se sacan los productos (o las
  // opciones) que ya no se ofrecen y se actualizan nombres y precios.
  useEffect(() => {
    reconciliar(productos)
  }, [reconciliar, productos])

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  function mostrarAviso(texto: string) {
    setAviso(texto)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAviso(null), 4000)
  }

  // El modal puede mandar varias opciones juntas (ej: 2 enteras y 1 media): una línea cada una.
  function agregar(producto: ProductoMenu, elecciones: EleccionProducto[]) {
    const agregadas: string[] = []
    let problema: string | null = null
    for (const eleccion of elecciones) {
      const resultado = carrito.agregar(producto, eleccion)
      if (resultado === 'agregado' || resultado === 'limitado') {
        const variacion = producto.variaciones.find((opcion) => opcion.idVariacion === eleccion.idVariacion)
        const nombre = nombreLinea({
          nombre: producto.nombre,
          variacion: variacion?.nombre ?? null,
          extras: producto.extras.filter((extra) => eleccion.extras.includes(extra.idExtra)),
        })
        agregadas.push(`${eleccion.cantidad > 1 ? `${eleccion.cantidad} × ` : ''}${nombre}`)
        if (resultado === 'limitado') {
          problema = `Podés pedir hasta ${MAX_CANTIDAD_ITEM} unidades de cada combinación: dejamos ${MAX_CANTIDAD_ITEM}.`
        }
      } else if (resultado === 'tope-cantidad') {
        problema = `Podés pedir hasta ${MAX_CANTIDAD_ITEM} unidades de cada combinación.`
      } else if (resultado === 'tope-lineas') {
        problema = `Tu pedido puede tener hasta ${MAX_ITEMS_PEDIDO} productos distintos.`
      } else {
        problema = 'No pudimos agregar ese producto. Intentá de nuevo.'
      }
    }
    if (agregadas.length > 0) setAnuncio(`Agregaste ${agregadas.join(' y ')} al carrito.`)
    if (problema) mostrarAviso(problema)
  }

  if (categorias.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted shadow-sm">
          <UtensilsCrossed className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold">Todavía no hay productos disponibles</h2>
        <p className="max-w-xs text-sm text-muted">Este local está actualizando su menú. Volvé a mirar en un rato.</p>
      </div>
    )
  }

  return (
    <>
      {categorias.length > 1 && <NavCategorias categorias={categorias} />}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-6 pb-32">
        <AvisoQuitados nombres={carrito.productosQuitados} onCerrar={carrito.descartarAviso} />

        {categorias.map((categoria) => (
          <section
            key={categoria.idCategoria}
            id={idSeccion(categoria.idCategoria)}
            data-categoria={categoria.idCategoria}
            aria-labelledby={`${idSeccion(categoria.idCategoria)}-titulo`}
            className="scroll-mt-20"
          >
            <h2
              id={`${idSeccion(categoria.idCategoria)}-titulo`}
              tabIndex={-1}
              className="mb-3 px-1 text-lg font-semibold outline-none"
            >
              {categoria.nombre}
            </h2>
            <ul className="divide-y divide-border/60 rounded-3xl bg-surface px-4 shadow-sm">
              {categoria.productos.map((producto) => {
                const enCarrito = cantidadDeProducto(carrito.items, producto.idProducto)
                // La primera variación es la principal (la que más se pide): su precio final.
                const [principal, ...otras] = producto.variaciones
                return (
                  // Toda la tarjeta abre el modal: el botón "Agregar" se estira sobre ella.
                  <li key={producto.idProducto} className="relative flex items-center gap-3 py-4">
                    <FotoProducto nombre={producto.nombre} categoria={categoria.nombre} className="size-20 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 className="leading-snug font-semibold">{producto.nombre}</h3>
                      {producto.descripcion && (
                        <p className="line-clamp-3 text-sm font-normal text-muted">{producto.descripcion}</p>
                      )}
                      <p className="font-semibold text-accent tabular-nums">
                        {formatearPrecio(producto.precio + (principal?.precioAdicional ?? 0))}
                        {principal && <span className="ml-1.5 text-sm font-normal text-muted">{principal.nombre}</span>}
                      </p>
                      {otras.length > 0 && (
                        <p className="text-xs font-normal text-muted tabular-nums">
                          También:{' '}
                          {otras.map((opcion) => `${opcion.nombre} ${formatearPrecio(producto.precio + opcion.precioAdicional)}`).join(' · ')}
                        </p>
                      )}
                      {enCarrito > 0 && (
                        <p className="self-start rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent tabular-nums">
                          {enCarrito} en tu carrito
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setElegido({ producto, categoria: categoria.nombre })}
                      aria-haspopup="dialog"
                      aria-label={`Agregar ${producto.nombre}${enCarrito > 0 ? ` (${enCarrito} en tu carrito)` : ''}`}
                      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent transition-colors after:absolute after:inset-0 after:content-[''] hover:bg-accent hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Agregar
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">{anuncio}</p>
      <BarraCarrito slug={slug} cantidadTotal={carrito.cantidadTotal} total={carrito.total} aviso={aviso} />

      {elegido && (
        <ModalProducto
          key={elegido.producto.idProducto}
          producto={elegido.producto}
          categoria={elegido.categoria}
          onAgregar={(elecciones) => agregar(elegido.producto, elecciones)}
          onCerrar={() => setElegido(null)}
        />
      )}
    </>
  )
}
