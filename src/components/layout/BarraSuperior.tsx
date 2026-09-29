import { MenuUsuario } from '@/components/layout/MenuUsuario'
import { Campanita } from '@/components/notificaciones/Campanita'
import { SelectorSucursal } from '@/components/sucursal/SucursalActiva'

// Parte del marco fijo del panel, como el sidebar: fondo blanco y pegada arriba al
// desplazar la página. A la izquierda el contexto (sucursal activa, alineada con el
// título de cada página); a la derecha lo del usuario. Todos los roles del panel operan
// Pedidos (y confirman transferencias): la campanita va siempre.
export function BarraSuperior({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 bg-surface px-6">
      <div className="w-60">
        <SelectorSucursal />
      </div>
      <div className="flex items-center gap-3">
        <Campanita />
        <MenuUsuario nombre={nombre} rol={rol} />
      </div>
    </div>
  )
}
