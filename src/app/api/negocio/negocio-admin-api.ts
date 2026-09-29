import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorNegocio } from '@/lib/negocio/negocio-administracion'

export const negocioAdmin = crearControladorNegocio(prisma, () => getServerSession(authOptions))
