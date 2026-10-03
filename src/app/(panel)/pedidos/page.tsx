import { getServerSession } from 'next-auth'
import { GestionPedidos } from '@/components/pedidos/GestionPedidos'
import { authOptions } from '@/lib/auth/auth'

// La sesión la valida el layout de (panel). Supervisor y empleado operan los pedidos (el
// mostrador es quien entrega y cobra); el admin solo los ve, para no cambiar uno por error.
export default async function PedidosPage() {
  const sesion = await getServerSession(authOptions)

  return (
    <main className="p-6" lang="es">
      <GestionPedidos soloLectura={sesion?.user.rol === 'admin'} />
    </main>
  )
}
