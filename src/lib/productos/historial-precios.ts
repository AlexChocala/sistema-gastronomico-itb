import type { Prisma } from '@prisma/client'

export type HistorialPrecios = {
  producto: { idProducto: number; nombre: string; precio: number; activo: boolean }
  registros: { idHistorial: number; precioAnterior: number | null; precioNuevo: number; fechaCambio: string }[]
  pagina: number; porPagina: number; totalRegistros: number; totalPaginas: number
}

// El trigger de Supabase es AFTER UPDATE OF precio, no de alta. Cuando está
// habilitado, él registra el cambio; sin trigger se conserva el registro de la app.
export async function triggerHistorialActivo(tx: Prisma.TransactionClient) {
  const filas = await tx.$queryRaw<{ activo: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public."Producto"'::regclass
        AND tgname = 'trg_historial_precio_producto' AND NOT tgisinternal
        AND (tgenabled = 'A'
          OR (tgenabled = 'O' AND current_setting('session_replication_role') <> 'replica')
          OR (tgenabled = 'R' AND current_setting('session_replication_role') = 'replica'))
    ) AS activo
  `
  return filas[0]?.activo === true
}
