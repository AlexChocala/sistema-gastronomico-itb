// Variación y extras de un producto del pedido, uno por línea: en Cocina y Entregas un
// extra pasado por alto es un pedido mal armado, y en una sola frase separada por comas
// es fácil de saltear. La variación ("Chica") va sin "+" porque no es un extra.

export function OpcionesItem({
  variacion,
  extras,
  className = '',
}: {
  variacion: string | null
  extras: string[]
  className?: string
}) {
  if (!variacion && extras.length === 0) return null
  return (
    <ul className={`mt-0.5 flex flex-col text-sm break-words text-muted ${className}`}>
      {variacion && <li>{variacion}</li>}
      {extras.map((extra, indice) => (
        <li key={indice}>+ {extra}</li>
      ))}
    </ul>
  )
}
