import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorProductos } from '@/lib/productos/productos-administracion'

export const productosAdmin = crearControladorProductos(prisma, () => getServerSession(authOptions))
