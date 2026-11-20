// Página pública de privacidad: qué datos se piden al hacer un pedido online y para qué se usan.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacidad' }

export default function PrivacidadPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 text-text">
      <h1 className="page-title">Privacidad</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Qué datos pedimos</h2>
        <ul className="list-disc pl-5 text-muted">
          <li>Nombre y apellido.</li>
          <li>Celular.</li>
          <li>Dirección, solo si elegís delivery.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Para qué los usamos</h2>
        <p className="text-muted">
          Solo para preparar y entregar tu pedido y para avisarte si hay algún problema con él.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Quién los ve</h2>
        <p className="text-muted">
          El local donde hiciste el pedido. No los compartimos con terceros ni los usamos para publicidad.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Tus derechos</h2>
        <p className="text-muted">
          Podés pedirle al local que corrija o borre tus datos.
        </p>
      </section>

      <Link href="/" className="text-accent hover:underline">Volver al inicio</Link>
    </main>
  )
}
