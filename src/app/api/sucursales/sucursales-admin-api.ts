import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorSucursales } from '@/lib/sucursales/sucursales-administracion'

export const sucursalesAdmin = crearControladorSucursales(prisma, () => getServerSession(authOptions))