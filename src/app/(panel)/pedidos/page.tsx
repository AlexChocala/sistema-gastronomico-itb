import { GestionPedidos } from '@/components/pedidos/GestionPedidos'

// La sesión la valida el layout de (panel). Todos los roles ven Pedidos: el mostrador
// es quien entrega y cobra.
export default function PedidosPage() {
  return (
    <main className="p-6" lang="es">
      <GestionPedidos />
    </main>
  )
}
