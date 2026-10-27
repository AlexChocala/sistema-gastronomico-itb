import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { idValido } from '@/lib/usuarios/usuarios-validacion'

export type DatosCambioContrasena = { actual: string; nueva: string; confirmacion: string }
export type ResultadoCambioContrasena = { error?: string }
type Sesion = { user: { idUsuario: number } } | null

// La cuenta siempre sale de la sesión, nunca de un identificador del formulario.
export async function cambiarContrasenaPropia(
  db: PrismaClient, sesion: Sesion, datos: unknown,
): Promise<ResultadoCambioContrasena> {
  if (!sesion || !idValido(sesion.user?.idUsuario)) return { error: 'Iniciá sesión para cambiar tu contraseña.' }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { error: 'Completá los tres campos de contraseña.' }
  const campos = datos as Record<string, unknown>
  if (Object.keys(campos).some(campo => !['actual', 'nueva', 'confirmacion'].includes(campo))) {
    return { error: 'Los datos del cambio de contraseña no son válidos.' }
  }
  const { actual, nueva, confirmacion } = campos
  if (typeof actual !== 'string' || !actual || Buffer.byteLength(actual, 'utf8') > 72) {
    return { error: 'Ingresá tu contraseña actual (máximo 72 bytes).' }
  }
  if (typeof nueva !== 'string' || nueva.length < 6 || Buffer.byteLength(nueva, 'utf8') > 72) {
    return { error: 'La nueva contraseña debe tener al menos 6 caracteres y un máximo de 72 bytes.' }
  }
  if (nueva !== confirmacion) return { error: 'Las contraseñas nuevas no coinciden.' }
  if (actual === nueva) return { error: 'Elegí una contraseña diferente de la actual.' }

  try {
    const usuario = await db.usuario.findUnique({
      where: { idUsuario: sesion.user.idUsuario },
      select: { activo: true, passwordHash: true },
    })
    if (!usuario?.activo) return { error: 'Tu cuenta no está disponible. Volvé a iniciar sesión.' }
    if (!await bcrypt.compare(actual, usuario.passwordHash)) return { error: 'La contraseña actual no es correcta.' }
    const passwordHash = await bcrypt.hash(nueva, 10)
    // Si otro proceso la restableció o archivó la cuenta mientras verificábamos,
    // no sobrescribimos ese cambio con una contraseña anterior.
    const actualizado = await db.usuario.updateMany({
      where: { idUsuario: sesion.user.idUsuario, activo: true, passwordHash: usuario.passwordHash },
      data: { passwordHash, debeCambiarContrasena: false },
    })
    if (actualizado.count !== 1) return { error: 'Tu cuenta cambió durante la operación. Volvé a iniciar sesión e intentá nuevamente.' }
    return {}
  } catch {
    return { error: 'No se pudo actualizar la contraseña. Intentá nuevamente.' }
  }
}
