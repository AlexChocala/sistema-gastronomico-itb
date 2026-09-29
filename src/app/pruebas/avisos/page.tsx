import { notFound } from 'next/navigation'
import { Aviso } from '@/components/ui/Aviso'
import { MENSAJES } from '@/lib/utils/mensajes'
import { DemoAvisoFlotante, DemoAvisosInteractivos } from './DemoAvisoFlotante'

// Guía de avisos para el equipo y el diseñador. Pantalla disponible solo durante el desarrollo.

const cuandoUsar = [
  { que: 'Aviso', cuando: 'Algo sobre la pantalla o el formulario que estás viendo', donde: 'Fijo en la pantalla', ejemplo: '"Cambios guardados."' },
  { que: 'AvisoFlotante', cuando: 'Confirma una acción rápida que acabás de hacer', donde: 'Abajo, se va solo', ejemplo: '"Quitaste la hamburguesa · Deshacer"' },
  { que: 'Confirmación', cuando: 'Antes de una acción que no se puede revertir', donde: 'Ventana en el centro', ejemplo: 'Se unifica en la fase 2' },
  { que: 'Notificaciones', cuando: 'Algo que pasó sin que vos hicieras nada', donde: 'Campanita con contador', ejemplo: 'Funcionalidad futura' },
]

// Clases literales para que Tailwind las genere.
const paleta = [
  { color: 'bg-success', fondo: 'bg-success-surface', variables: ['--success', '--success-surface'] },
  { color: 'bg-danger', fondo: 'bg-danger-surface', variables: ['--danger', '--danger-surface'] },
  { color: 'bg-warning', fondo: 'bg-warning-surface', variables: ['--warning', '--warning-surface'] },
  { color: 'bg-info', fondo: 'bg-info-surface', variables: ['--info', '--info-surface'] },
  { color: 'bg-toast', fondo: 'bg-on-toast', variables: ['--toast', '--on-toast'] },
]

const gruposMensajes = [
  { titulo: 'Panel (directo, impersonal)', clave: 'MENSAJES.panel', textos: MENSAJES.panel },
  { titulo: 'Cliente (cálido, en plural)', clave: 'MENSAJES.cliente', textos: MENSAJES.cliente },
]

const tarjeta = 'flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm'

export default function GuiaAvisosPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="min-h-screen bg-bg px-4 py-8 pb-28 text-text">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="page-title">Guía de avisos</h1>
          <p className="text-muted">
            Cómo le avisamos a la persona qué pasó. Usá esta página para elegir el componente correcto y
            para ajustar los colores en styles/globals.css.
          </p>
        </header>

        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">¿Qué uso?</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Componente</th>
                  <th className="py-2 pr-4 font-medium">Cuándo</th>
                  <th className="py-2 pr-4 font-medium">Dónde aparece</th>
                  <th className="py-2 font-medium">Ejemplo</th>
                </tr>
              </thead>
              <tbody className="font-normal">
                {cuandoUsar.map((fila) => (
                  <tr key={fila.que} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-semibold">{fila.que}</td>
                    <td className="py-2 pr-4">{fila.cuando}</td>
                    <td className="py-2 pr-4">{fila.donde}</td>
                    <td className="py-2 text-muted">{fila.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">Aviso</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Aviso tipo="exito">{MENSAJES.panel.cambiosGuardados}</Aviso>
            <Aviso tipo="exito" titulo="Producto creado">Ya aparece en Caja y en el menú digital.</Aviso>
            <Aviso tipo="error">{MENSAJES.panel.errorGenerico}</Aviso>
            <Aviso tipo="error" titulo="No se pudo guardar">Revisá los campos marcados.</Aviso>
            <Aviso tipo="advertencia">La sucursal está cerrada: los pedidos nuevos no van a entrar.</Aviso>
            <Aviso tipo="advertencia" titulo="Stock bajo">Quedan 3 unidades de Coca-Cola 500 ml.</Aviso>
            <Aviso tipo="info">Los cambios se ven en el menú digital al instante.</Aviso>
            <Aviso tipo="info" titulo="Sugerencia">Podés ordenar las categorías arrastrándolas.</Aviso>
          </div>
          <h3 className="font-semibold">Con X y con acción</h3>
          <DemoAvisosInteractivos />
        </section>

        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">AvisoFlotante</h2>
          <p className="text-sm font-normal text-muted">
            Aparece abajo al centro y se va solo a los 5 segundos. Con el mouse encima o el foco de teclado adentro, espera.
          </p>
          <DemoAvisoFlotante />
        </section>

        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">Paleta</h2>
          <p className="text-sm font-normal text-muted">
            Pares color + fondo. Para cambiarlos, editá estas variables en styles/globals.css.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {paleta.map((par) => (
              <li key={par.variables[0]} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <span aria-hidden className={`size-10 shrink-0 rounded-full ${par.color}`} />
                <span aria-hidden className={`size-10 shrink-0 rounded-full border border-border ${par.fondo}`} />
                <code className="flex flex-col text-xs">
                  <span>{par.variables[0]}</span>
                  <span>{par.variables[1]}</span>
                </code>
              </li>
            ))}
          </ul>
        </section>

        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">Textos comunes</h2>
          <p className="text-sm font-normal text-muted">En src/lib/utils/mensajes.ts. Las pantallas nuevas los usan.</p>
          <div className="grid gap-6 md:grid-cols-2">
            {gruposMensajes.map((grupo) => (
              <div key={grupo.clave} className="flex flex-col gap-2">
                <h3 className="font-semibold">{grupo.titulo}</h3>
                <dl className="flex flex-col gap-2 text-sm">
                  {Object.entries(grupo.textos).map(([clave, texto]) => (
                    <div key={clave}>
                      <dt><code className="text-xs text-muted">{grupo.clave}.{clave}</code></dt>
                      <dd className="font-normal">{texto}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
