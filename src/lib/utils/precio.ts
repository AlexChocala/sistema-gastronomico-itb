// Formato de precios en pesos para el menú digital (sin centavos, como en Caja).
// Sin imports de servidor: lo usan tanto páginas como componentes de cliente.

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatearPrecio(valor: number) {
  return formatoPrecio.format(valor)
}
