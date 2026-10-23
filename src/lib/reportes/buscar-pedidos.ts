import type { PedidoReporte } from './tipos'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

// Busca solo en los pedidos que ya autorizó y filtró la consulta del reporte.
export function buscarPedidos(pedidos: PedidoReporte[], busqueda: string): PedidoReporte[] {
  const palabras = normalizar(busqueda).trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return pedidos

  return pedidos.filter((pedido) => {
    const texto = normalizar([
      `#${pedido.idPedido}`, pedido.cliente, pedido.sucursal,
      pedido.registradoPor ?? (pedido.origen === 'online' ? 'Pedido online' : 'Sin registro'),
      ...(pedido.productos ?? []),
    ].join(' '))
    return palabras.every((palabra) => texto.includes(palabra))
  })
}
