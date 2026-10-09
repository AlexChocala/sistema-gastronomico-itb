// Lectura de los datos del negocio para mostrar (menú digital, Configuración). Solo
// corre en el servidor: usa Prisma.

import { prisma } from '@/lib/db/prisma'
import { formatearCuit } from '@/lib/negocio/negocio-validacion'
import { urlImagenPublica } from '@/lib/storage/imagenes'

// URL pública del logo; la base conserva únicamente su ruta dentro del bucket.
export function urlLogoNegocio(logoPath: string | null): string | null {
  return urlImagenPublica(logoPath)
}

// `cuit` ya viene con guiones (20-12345678-9), listo para mostrar.
export type DatosTransferencia = { alias: string; cuit: string; titular: string }

// Datos para pagar por transferencia, o null si no alcanzan: hacen falta titular, alias y
// CUIT/CUIL. Con null el menú no ofrece esa forma de pago y la API de pedidos la rechaza.
export function datosTransferencia(negocio: {
  transferenciaAlias: string | null
  transferenciaCuit: string | null
  transferenciaTitular: string | null
}): DatosTransferencia | null {
  const { transferenciaAlias: alias, transferenciaCuit: cuit, transferenciaTitular: titular } = negocio
  if (!titular || !alias || !cuit) return null
  return { alias, cuit: formatearCuit(cuit), titular }
}

export type NegocioPublico = {
  nombre: string
  descripcion: string | null
  logoUrl: string | null
  instagram: string | null
  tiktok: string | null
  facebook: string | null
  transferencia: DatosTransferencia | null
}

// Datos que se pueden mostrar sin sesión. null si todavía no se hizo la configuración inicial.
export async function obtenerNegocioPublico(): Promise<NegocioPublico | null> {
  const negocio = await prisma.negocio.findUnique({
    where: { idNegocio: 1 },
    select: {
      nombre: true, descripcion: true, logoPath: true, instagram: true, tiktok: true, facebook: true,
      transferenciaAlias: true, transferenciaCuit: true, transferenciaTitular: true,
    },
  })
  if (!negocio) return null
  const { logoPath, transferenciaAlias, transferenciaCuit, transferenciaTitular, ...resto } = negocio
  return {
    ...resto,
    logoUrl: urlLogoNegocio(logoPath),
    transferencia: datosTransferencia({ transferenciaAlias, transferenciaCuit, transferenciaTitular }),
  }
}
