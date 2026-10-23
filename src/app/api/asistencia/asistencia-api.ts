import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { crearControladorAsistencia } from '@/lib/asistencia/controlador'

export const asistencia = crearControladorAsistencia(prisma, () => getServerSession(authOptions))
