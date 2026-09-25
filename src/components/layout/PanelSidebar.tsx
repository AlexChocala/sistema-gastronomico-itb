'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CerrarSesionButton } from '@/components/layout/CerrarSesionButton'
import {
  BookOpen, ChartColumn, ChefHat, ChevronDown, ClipboardList, ExternalLink, LayoutDashboard,
  Monitor, MonitorPlay, Package, Settings, Store, User, Users, UtensilsCrossed, Wallet,
  type LucideIcon,
} from '@/components/icons'

type Enlace = { href: string; texto: string; icono: LucideIcon; roles?: string[] }
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
      { href: '/productos/menu', texto: 'Consultar menú', icono: BookOpen, roles: ['empleado'] },
    ],
    pendientes: [{ texto: 'Pedidos', icono: ClipboardList }],
    conPantallas: true,
  },
  {
    titulo: 'Operaciones',
    roles: ['admin', 'supervisor'],
    enlaces: [{ href: '/productos', texto: 'Productos', icono: Package }],
    pendientes: [{ texto: 'Reportes', icono: ChartColumn }],
  },
  {
    titulo: 'Administración',
    roles: ['admin'],
    enlaces: [
      { href: '/usuarios', texto: 'Usuarios', icono: Users },
      { href: '/sucursales', texto: 'Sucursales', icono: Store },
    ],
    pendientes: [{ texto: 'Configuración', icono: Settings }],
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

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('')
}

const claseItem = 'nav-item'
const claseSubItem = 'flex items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2 text-(length:--sidebar-texto) transition-colors'
const claseIcono = 'size-(--sidebar-icono) shrink-0'
const trazoIcono = 1.75

export function PanelSidebar({ nombre, rol }: { nombre: string; rol: string }) {
  const rutaActual = usePathname()
  const seccionesVisibles = secciones.filter((seccion) => esVisible(seccion.roles, rol))

  return (
    <aside className="flex flex-col gap-8 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto scrollbar-oculta">
      <div className="flex items-center gap-3 px-2 pt-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-on-accent">
          <UtensilsCrossed size={18} strokeWidth={2} />
        </span>
        <span className="font-semibold tracking-tight">Mise</span>
      </div>

      <nav aria-label="Menú principal" className="flex flex-col gap-6">
        {seccionesVisibles.map((seccion) => (
          <div key={seccion.titulo} className="flex flex-col gap-1">
            <p className="section-label mb-1 px-4">{seccion.titulo}</p>
            {seccion.enlaces.filter((enlace) => esVisible(enlace.roles, rol)).map((enlace) => {
              const activo = rutaActual === enlace.href || rutaActual.startsWith(enlace.href + '/')
              const Icono = enlace.icono
              return (
                <Link key={enlace.href} href={enlace.href} aria-current={activo ? 'page' : undefined} className={claseItem + ' ' + (activo ? 'bg-surface-muted font-medium text-text' : 'text-muted hover:bg-surface-muted/60 hover:text-text')}>
                  <Icono strokeWidth={trazoIcono} className={claseIcono + ' ' + (activo ? 'text-accent' : '')} />
                  {enlace.texto}
                </Link>
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
            {seccion.conPantallas && (
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
                      <a key={pantalla.href} href={pantalla.href} target="_blank" rel="noopener noreferrer" className={claseSubItem + ' text-muted hover:bg-surface-muted/60 hover:text-text'}>
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

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            {iniciales(nombre)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{nombre}</p>
            <p className="text-xs capitalize text-muted">{rol}</p>
          </div>
        </div>
        <nav aria-label="Menú de usuario" className="flex flex-col gap-1">
          <p className="section-label mb-1 px-4">General</p>
          <span className={claseItem + ' cursor-not-allowed text-muted opacity-50'} aria-disabled="true">
            <User strokeWidth={trazoIcono} className={claseIcono} />
            Perfil
          </span>
          <CerrarSesionButton />
        </nav>
      </div>
    </aside>
  )
}