'use client'

import { Moon, Sun } from '@/components/icons'
import { useTema } from './ProveedorTema'

const opciones = [
  { valor: 'claro', texto: 'Claro', descripcion: 'Fondos claros y texto oscuro.', icono: Sun },
  { valor: 'oscuro', texto: 'Oscuro', descripcion: 'Fondos oscuros y texto claro.', icono: Moon },
] as const

export function ConfiguracionApariencia() {
  const { tema, elegirTema } = useTema()

  return (
    <section aria-labelledby="titulo-apariencia" className="flex flex-col gap-5 rounded-3xl bg-surface p-6 shadow-sm">
      <div>
        <h2 id="titulo-apariencia" className="font-semibold">Apariencia</h2>
        <p className="mt-1 text-sm text-muted">Elegí cómo ver el sistema. Tu elección se guarda en este navegador y se aplica a las pantallas del personal.</p>
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Tema de la aplicación</legend>
        {opciones.map(({ valor, texto, descripcion, icono: Icono }) => (
          <label
            key={valor}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-border p-4 transition-colors hover:border-accent/50 has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio" name="tema" value={valor} checked={tema === valor}
              onChange={() => elegirTema(valor)} className="sr-only"
            />
            <Icono className="size-6 shrink-0 text-accent" aria-hidden="true" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{texto}</span>
              <span className="text-xs text-muted">{descripcion}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  )
}
