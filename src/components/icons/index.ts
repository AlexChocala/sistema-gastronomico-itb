// src/components/icons/index.ts
// Single entry point for icons: the app imports from '@/components/icons', never from
// 'lucide-react' directly. Export only icons that are actually used.

export type { LucideIcon } from 'lucide-react'

// Sidebar navigation
export {
  LayoutDashboard, ClipboardList, MonitorPlay, Wallet, ChefHat, Monitor,
  Package, BookOpen, ChartColumn, Users, Settings, User, LogOut, UtensilsCrossed,
} from 'lucide-react'

// Pantallas (cocina / mostrador)
export { Bike, ShoppingBag, CircleUserRound, Check } from 'lucide-react'

// Caja — categorías y carrito
export { Hamburger, Pizza, Sandwich, CupSoda, IceCreamCone, Salad, Search, Plus, Minus, Trash2 } from 'lucide-react'

// Caja — cobro
export { Banknote, Landmark, ArrowLeft, Printer, CircleCheck } from 'lucide-react'

// Productos — gestión
export { Pencil, Power, Store, Tags, X, ChevronLeft, ChevronRight } from 'lucide-react'

// Dashboard
export { Receipt, Flame, Globe, CalendarDays, Clock, CheckCheck } from 'lucide-react'

// Acceso (login y contraseñas)
export { Mail, MailCheck, LockKeyhole, Eye, EyeOff, ArrowRight, ShieldCheck, TriangleAlert } from 'lucide-react'

// Landing pública y menú digital
export { MapPin, ShoppingCart, Info } from 'lucide-react'

// Pedidos — datos de entrega del delivery
export { Phone } from 'lucide-react'
// Logos de redes (lucide no trae marcas): dibujados en ./Redes.tsx
export { IconoInstagram, IconoTikTok, IconoFacebook, IconoWhatsapp } from './Redes'

// Usuarios — gestión
export { KeyRound, Copy } from 'lucide-react'

// Configuración — logo del negocio
export { ImagePlus } from 'lucide-react'

// UI
export { ChevronDown, ExternalLink, RotateCcw } from 'lucide-react'

// Avisos (Aviso / AvisoFlotante)
export { CircleX } from 'lucide-react'

// Barra superior — notificaciones
export { Bell } from 'lucide-react'
