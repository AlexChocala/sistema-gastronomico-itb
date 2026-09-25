import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { crearControladorSucursales } from '@/lib/sucursales-administracion'

export const sucursalesAdmin = crearControladorSucursales(prisma, () => getServerSession(authOptions))