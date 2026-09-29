// Instancia única de PrismaClient para toda la aplicación.
//
// En desarrollo, Next.js recarga módulos en cada cambio de archivo (Fast Refresh).
// Si cada recarga volviera a ejecutar "new PrismaClient()", se abriría una conexión
// nueva a Postgres por cada recarga sin cerrar las anteriores. Para evitarlo, guardamos
// la instancia en el objeto global de Node, que persiste entre recargas de módulos.

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function crearPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? crearPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
