// Ícono representativo de cada categoría del menú (Caja, Productos).
import type { LucideProps } from 'lucide-react'
import {
  CupSoda, Hamburger, IceCreamCone, Pizza, Salad, Sandwich, UtensilsCrossed, type LucideIcon,
} from '@/components/icons'

const iconoPorCategoria: Record<string, LucideIcon> = {
  Hamburguesas: Hamburger,
  Pizzas: Pizza,
  Empanadas: Sandwich,
  Platos: Salad,
  Bebidas: CupSoda,
  Postres: IceCreamCone,
}

export function IconoCategoria({ categoria, ...props }: LucideProps & { categoria: string }) {
  const Icono = iconoPorCategoria[categoria] ?? UtensilsCrossed
  return <Icono {...props} />
}
