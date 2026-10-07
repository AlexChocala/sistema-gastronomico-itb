import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorUsuarios } from '@/lib/usuarios/usuarios-administracion'

export const usuariosAdmin = crearControladorUsuarios(prisma, () => getServerSession(authOptions))