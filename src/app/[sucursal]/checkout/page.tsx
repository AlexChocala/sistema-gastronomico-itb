// Checkout de una sucursal (/{slug}/checkout). El servidor valida la sucursal y pasa lo
// que el formulario necesita: formas de entrega, zonas de delivery, WhatsApp y si se
// acepta transferencia. Los datos de la cuenta NO se mandan acá: llegan en la respuesta del
// pedido ya creado. El envío y la confirmación viven en CheckoutForm.

import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/carta/checkout/CheckoutForm'
import { EncabezadoPaso } from '@/components/carta/compartidos/EncabezadoSucursal'
import { obtenerSucursalOFallar, productosDelMenu } from '../datos'

export async function generateMetadata({ params }: PageProps<'/[sucursal]/checkout'>): Promise<Metadata> {
  const { sucursal, negocio } = await obtenerSucursalOFallar((await params).sucursal)
  return { title: `Finalizar pedido · ${sucursal.nombre} · ${negocio.nombre}` }
}

export default async function PaginaCheckout({ params }: PageProps<'/[sucursal]/checkout'>) {
  const { sucursal, negocio } = await obtenerSucursalOFallar((await params).sucursal)
  const productos = await productosDelMenu(sucursal.idSucursal)

  return (
    <div className="flex flex-1 flex-col bg-bg text-text">
      <EncabezadoPaso titulo="Finalizar pedido" volverA={`/${sucursal.slug}/carrito`} textoVolver="Volver al carrito" sucursal={sucursal.nombre} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 pb-12 lg:max-w-4xl">
        <CheckoutForm
          slug={sucursal.slug}
          sucursal={{
            nombre: sucursal.nombre,
            direccion: sucursal.direccion,
            localidad: sucursal.localidad,
            provincia: sucursal.provincia,
            whatsapp: sucursal.whatsapp,
            ofreceRetiro: sucursal.ofreceRetiro,
            ofreceDelivery: sucursal.ofreceDelivery,
            localidadesDelivery: sucursal.localidadesDelivery,
          }}
          // Solo si se ofrece: los datos de la cuenta se muestran recién con el pedido creado.
          aceptaTransferencia={negocio.transferencia !== null}
          productos={productos}
        />
      </main>
    </div>
  )
}
