'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMise } from '@/components/acceso/ElementosAcceso'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import {
  ChartColumn, ChefHat, ChevronDown, ClipboardList, ExternalLink, LayoutDashboard, Layers, List,
  Monitor, MonitorPlay, Package, Settings, Store, Tags, Users, Wallet,
  type LucideIcon,
} from '@/components/icons'

// subenlaces: las pantallas de una sección (ej. Productos → Categorías). Se ven como el
// grupo Pantallas: desplegados mientras estás en la sección, y la flecha los contrae.
type Subenlace = { href: string; texto: string; icono: LucideIcon }
type Enlace = { href: string; texto: string; icono: LucideIcon; roles?: string[]; subenlaces?: Subenlace[] }
type Pendiente = { texto: string; icono: LucideIcon }

type Seccion = {
  titulo: string
  roles?: string[]
  enlaces: Enlace[]
  pendientes: Pendiente[]
  conPantallas?: boolean
}

const secciones: Seccion[] = [
  {
    titulo: 'Principal',
    enlaces: [
      { href: '/dashboard', texto: 'Dashboard', icono: LayoutDashboard },
      { href: '/pedidos', texto: 'Pedidos', icono: ClipboardList },
    ],
    pendientes: [],
    conPantallas: true,
  },
  {
    titulo: 'Operaciones',
    roles: ['admin', 'supervisor'],
    enlaces: [
      {
        href: '/productos',
        texto: 'Productos',
        icono: Package,
        subenlaces: [
          { href: '/productos', texto: 'Lista de productos', icono: List },
          { href: '/productos/categorias', texto: 'Categorías', icono: Tags },
          { href: '/productos/extras', texto: 'Extras', icono: Layers },
        ],
      },
      { href: '/reportes', texto: 'Reportes', icono: ChartColumn },
    ],
    pendientes: [],
  },
  {
    titulo: 'Administración',
    roles: ['admin'],
    enlaces: [
      { href: '/usuarios', texto: 'Usuarios', icono: Users },
      { href: '/sucursales', texto: 'Sucursales', icono: Store },
      { href: '/configuracion', texto: 'Configuración', icono: Settings },
    ],
    pendientes: [],
  },
]

const pantallas = [
  { href: '/pantallas/caja', texto: 'Caja', icono: Wallet },
  { href: '/pantallas/cocina', texto: 'Cocina', icono: ChefHat },
  { href: '/pantallas/pedidos-mostrador', texto: 'Pedidos Mostrador', icono: Monitor },
]

function esVisible(roles: string[] | undefined, rol: string) {
  return !roles || roles.includes(rol)
}

const claseItem = 'nav-item'
const claseSubItem = 'flex items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2 text-(length:--sidebar-texto) transition-colors'
const claseIcono = 'size-(--sidebar-icono) shrink-0'
const trazoIcono = 1.75

export function PanelSidebar({ rol, nombreNegocio }: { rol: string; nombreNegocio: string }) {
  const rutaActual = usePathname()
  const { sucursal } = useSucursalActiva()
  const seccionesVisibles = secciones.filter((seccion) => esVisible(seccion.roles, rol))
  // Grupos con subenlaces que el usuario abrió o cerró con la flecha. Si no lo tocó, el
  // grupo está abierto mientras estás dentro de su sección.
  const [gruposTocados, setGruposTocados] = useState<Record<string, boolean>>({})

  // El monitor de Mostrador es público (sin sesión): la sucursal viaja en la URL.
  function hrefPantalla(href: string) {
    return href === '/pantallas/pedidos-mostrador' && sucursal
      ? `${href}?sucursal=${sucursal.idSucursal}`
      : href
  }

  return (
    <aside className="flex flex-col gap-8 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto scrollbar-oculta">
      <div className="px-2 pt-2">
        <LogoMise nombreNegocio={nombreNegocio} />
      </div>

      <nav aria-label="Menú principal" className="flex flex-col gap-6">
        {seccionesVisibles.map((seccion) => (
          <div key={seccion.titulo} className="flex flex-col gap-1">
            <p className="section-label mb-1 px-4">{seccion.titulo}</p>
            {seccion.enlaces.filter((enlace) => esVisible(enlace.roles, rol)).map((enlace) => {
              const activo = rutaActual === enlace.href || rutaActual.startsWith(enlace.href + '/')
              const Icono = enlace.icono
              // Con subenlaces, la página actual la marca el subenlace y no la sección.
              const esPaginaActual = activo && !enlace.subenlaces
              const abierto = gruposTocados[enlace.href] ?? activo
              const idSubenlaces = `subenlaces-${enlace.href.slice(1)}`
              return (
                <div key={enlace.href} className="flex flex-col gap-1">
                  <div className="relative">
                    <Link href={enlace.href} aria-current={esPaginaActual ? 'page' : undefined} className={claseItem + ' ' + (enlace.subenlaces ? 'pr-11 ' : '') + (activo ? 'bg-surface-muted font-medium text-text' : 'text-muted hover:bg-surface-muted/60 hover:text-text')}>
                      <Icono strokeWidth={trazoIcono} className={claseIcono + ' ' + (activo ? 'text-accent' : '')} />
                      {enlace.texto}
                    </Link>
                    {enlace.subenlaces && (
                      <button
                        type="button"
                        onClick={() => setGruposTocados((actuales) => ({ ...actuales, [enlace.href]: !abierto }))}
                        aria-expanded={abierto}
                        aria-controls={idSubenlaces}
                        aria-label={`${abierto ? 'Contraer' : 'Desplegar'} ${enlace.texto}`}
                        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <ChevronDown size={16} strokeWidth={trazoIcono} className={`transition-transform motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {abierto && enlace.subenlaces && (
                    <div id={idSubenlaces} className="ml-5 flex flex-col gap-1 border-l border-border pl-1.5">
                      {enlace.subenlaces.map((subenlace) => {
                        const subActivo = rutaActual === subenlace.href
                        const SubIcono = subenlace.icono
                        return (
                          <Link key={subenlace.href} href={subenlace.href} aria-current={subActivo ? 'page' : undefined}
                            className={claseSubItem + ' ' + (subActivo ? 'bg-surface-muted/60 font-medium text-text' : 'text-muted hover:bg-surface-muted/60 hover:text-text')}>
                            <SubIcono strokeWidth={trazoIcono} className={claseIcono + ' ' + (subActivo ? 'text-accent' : '')} />
                            {subenlace.texto}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {seccion.pendientes.map((pendiente) => {
              const Icono = pendiente.icono
              return (
                <span key={pendiente.texto} className={claseItem + ' cursor-not-allowed text-muted opacity-50'} aria-disabled="true">
                  <Icono strokeWidth={trazoIcono} className={claseIcono} />
                  {pendiente.texto}
                </span>
              )
            })}
            {/* El admin no opera pedidos: Caja y Cocina no son para él, y el monitor es para clientes. */}
            {seccion.conPantallas && rol !== 'admin' && (
              <details className="group">
                <summary className={claseItem + ' cursor-pointer list-none text-muted hover:bg-surface-muted/60 hover:text-text [&::-webkit-details-marker]:hidden'}>
                  <MonitorPlay strokeWidth={trazoIcono} className={claseIcono} />
                  Pantallas
                  <ChevronDown size={16} strokeWidth={trazoIcono} className="ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 ml-5 flex flex-col gap-1 border-l border-border pl-1.5">
                  {pantallas.map((pantalla) => {
                    const Icono = pantalla.icono
                    return (
                      <a key={pantalla.href} href={hrefPantalla(pantalla.href)} target="_blank" rel="noopener noreferrer" className={claseSubItem + ' text-muted hover:bg-surface-muted/60 hover:text-text'}>
                        <Icono strokeWidth={trazoIcono} className={claseIcono} />
                        {pantalla.texto}
                        <ExternalLink size={14} strokeWidth={trazoIcono} className="ml-auto opacity-60" />
                      </a>
                    )
                  })}
                </div>
              </details>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}