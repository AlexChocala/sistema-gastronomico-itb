import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { crearControladorProductos } from '@/lib/productos-administracion'

export const productosAdmin = crearControladorProductos(prisma, () => getServerSession(authOptions))
