// Pre-configuración inicial del sistema. "Configurado" no se guarda en ninguna tabla:
// se calcula cada vez (existe la fila de Negocio y hay al menos una sucursal activa),
// así nunca queda desincronizado si después se desactivan todas las sucursales.
//
// Solo corre en el servidor: usa Prisma y el redirect de Next.

import { redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export async function sistemaConfigurado(db: Prisma.TransactionClient) {
  const [negocio, activas] = await Promise.all([
    db.negocio.findUnique({ where: { idNegocio: 1 }, select: { idNegocio: true } }),
    db.sucursal.count({ where: { activa: true } }),
  ])
  return negocio !== null && activas >= 1
}

// Guardia de los layouts del panel y de las pantallas (Caja, Cocina). Se llama después
// de verificar que hay sesión. Vuelve a leer el usuario de la base (no del token) para
// que una baja o un cambio de contraseña pendiente se respeten en la próxima carga.
export async function exigirSistemaListo(sesion: Session) {
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.user.idUsuario },
    select: { activo: true, debeCambiarContrasena: true },
  })

  if (!usuario?.activo) redirect('/acceso/login')
  if (usuario.debeCambiarContrasena) redirect('/acceso/cambiar-contrasena')
  if (!(await sistemaConfigurado(prisma))) redirect('/configuracion-inicial')
}
