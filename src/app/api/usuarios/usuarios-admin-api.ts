import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { crearControladorUsuarios } from '@/lib/usuarios-administracion'

export const usuariosAdmin = crearControladorUsuarios(prisma, () => getServerSession(authOptions))