'use client'

// Campos que se repiten en las pantallas de caja: monto con puntos de miles y PIN.

export const claseCampoCaja =
  'w-full rounded-full border border-border bg-surface px-4 py-2.5 text-lg outline-none focus:border-accent'

// Botón principal de las ventanas de caja: redondeado como el resto de las pantallas.
export const claseBotonCaja =
  'inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-brand py-3.5 text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'

export function conPuntos(digitos: string) {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Se escribe solo con números y se muestra con puntos de miles. `valor` son los dígitos.
export function CampoMonto({
  id, etiqueta, valor, onCambiar, placeholder = '0',
}: { id: string; etiqueta: string; valor: string; onCambiar: (digitos: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">{etiqueta}</label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-muted">$</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={conPuntos(valor)}
          onChange={(e) => onCambiar(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9))}
          placeholder={placeholder}
          className={`${claseCampoCaja} pl-9`}
        />
      </div>
    </div>
  )
}

export function CampoPinCaja({
  id, valor, onCambiar, etiqueta = 'Tu PIN',
}: { id: string; valor: string; onCambiar: (pin: string) => void; etiqueta?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">{etiqueta}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={valor}
        onChange={(e) => onCambiar(e.target.value.replace(/\D/g, ''))}
        placeholder="4 números"
        className={claseCampoCaja}
      />
    </div>
  )
}
