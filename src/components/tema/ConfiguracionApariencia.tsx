'use client'

// Selector Claro/Oscuro del encabezado de Configuración. Se aplica al instante: no
// pasa por el botón Guardar del formulario del negocio.

import { Moon, Sun } from '@/components/icons'
import { useTema } from './ProveedorTema'

const opciones = [
  { valor: 'claro', texto: 'Claro', icono: Sun },
  { valor: 'oscuro', texto: 'Oscuro', icono: Moon },
] as const

export function ConfiguracionApariencia() {
  const { tema, elegirTema } = useTema()

  return (
    <fieldset
      title="Tu elección se guarda en este navegador y se aplica a las pantallas del personal."
      className="flex shrink-0 gap-1 rounded-full border border-border bg-surface p-1"
    >
      <legend className="sr-only">Apariencia del sistema</legend>
      {opciones.map(({ valor, texto, icono: Icono }) => (
        <label
          key={valor}
          className="group flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors hover:bg-accent-soft/60 has-checked:bg-brand has-checked:text-on-brand has-checked:hover:bg-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio" name="tema" value={valor} checked={tema === valor}
            onChange={() => elegirTema(valor)} className="sr-only"
          />
          <Icono className="size-4 shrink-0 text-accent group-has-checked:text-on-brand" aria-hidden="true" />
          {texto}
        </label>
      ))}
    </fieldset>
  )
}
