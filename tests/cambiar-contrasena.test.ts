import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcrypt'
import type { PrismaClient } from '@prisma/client'
import { cambiarContrasenaPropia } from '../src/lib/auth/cambiar-contrasena'

const datos = { actual: 'ActualSoloPrueba', nueva: 'NuevaSoloPrueba', confirmacion: 'NuevaSoloPrueba' }
async function escenario() {
  const estado = { activo: true, existe: true, pendiente: true, hash: await bcrypt.hash(datos.actual, 4), escrituras: 0, cambioConcurrente: false, falla: false }
  const db = { usuario: {
    findUnique: async ({ where }: { where: { idUsuario: number } }) => {
      assert.equal(where.idUsuario, 2)
      if (estado.falla) throw Error('NO DEBE SALIR AL CLIENTE')
      return estado.existe ? { activo: estado.activo, passwordHash: estado.hash } : null
    },
    updateMany: async ({ where, data }: { where: { idUsuario: number; activo: boolean; passwordHash: string }; data: { passwordHash: string; debeCambiarContrasena: boolean } }) => {
      assert.equal(where.idUsuario, 2); assert.equal(where.activo, true); assert.equal(where.passwordHash, estado.hash)
      if (estado.cambioConcurrente) return { count: 0 }
      estado.escrituras++; estado.hash = data.passwordHash; estado.pendiente = data.debeCambiarContrasena
      return { count: 1 }
    },
  } } as unknown as PrismaClient
  return { estado, cambiar: (cuerpo: unknown = datos, sesion: { user: { idUsuario: number } } | null = { user: { idUsuario: 2 } }) => cambiarContrasenaPropia(db, sesion, cuerpo) }
}
test('verifica la actual, guarda hash de la nueva y resuelve cambio obligatorio sin exponer secretos', async () => {
  const e = await escenario()
  assert.deepEqual(await e.cambiar(), {})
  assert.equal(e.estado.escrituras, 1); assert.equal(e.estado.pendiente, false)
  assert.equal(await bcrypt.compare(datos.nueva, e.estado.hash), true)
  assert.equal(await bcrypt.compare(datos.actual, e.estado.hash), false)
  assert.equal(typeof (await e.cambiar()).error, 'string', 'la contraseña anterior deja de servir')
  assert.equal(e.estado.escrituras, 1)
})
test('rechaza actual incorrecta y nunca actualiza la contraseña', async () => {
  const e = await escenario()
  assert.match((await e.cambiar({ ...datos, actual: 'Incorrecta' })).error!, /actual no es correcta/)
  assert.equal(e.estado.escrituras, 0)
})
test('validación del servidor rechaza omisión, contraseñas distintas, reutilización y claves de más de 72 bytes', async () => {
  const e = await escenario()
  const invalidos = [null, [], {}, 'NuevaSoloPrueba', { nueva: datos.nueva, confirmacion: datos.nueva },
    { ...datos, confirmacion: 'Diferente' }, { ...datos, nueva: 'corta', confirmacion: 'corta' },
    { ...datos, nueva: datos.actual, confirmacion: datos.actual }, { ...datos, actual: 123 },
    { ...datos, nueva: 'á'.repeat(37), confirmacion: 'á'.repeat(37) },
    { ...datos, actual: 'a'.repeat(73) }, { ...datos, idUsuario: 3 }]
  for (const cuerpo of invalidos) assert.equal(typeof (await e.cambiar(cuerpo)).error, 'string')
  assert.equal(e.estado.escrituras, 0)
})
test('requiere sesión válida y cuenta activa tanto en cambio voluntario como obligatorio', async () => {
  const e = await escenario()
  for (const sesion of [null, { user: { idUsuario: 0 } }, { user: { idUsuario: NaN } }]) assert.ok((await e.cambiar(datos, sesion)).error)
  e.estado.activo = false; assert.ok((await e.cambiar()).error)
  e.estado.activo = true; e.estado.existe = false; assert.ok((await e.cambiar()).error)
  assert.equal(e.estado.escrituras, 0)
})
test('el cambio voluntario no requiere intervención de un administrador ni cambio pendiente', async () => {
  const e = await escenario(); e.estado.pendiente = false
  assert.deepEqual(await e.cambiar(), {})
  assert.equal(e.estado.escrituras, 1)
})
test('no sobrescribe un restablecimiento o archivo concurrente de la cuenta', async () => {
  const e = await escenario(); e.estado.cambioConcurrente = true
  assert.match((await e.cambiar()).error!, /cambió durante/)
  assert.equal(e.estado.escrituras, 0)
})
test('los errores internos no exponen hashes ni información de base de datos', async () => {
  const e = await escenario(); e.estado.falla = true
  assert.deepEqual(await e.cambiar(), { error: 'No se pudo actualizar la contraseña. Intentá nuevamente.' })
  assert.equal(e.estado.escrituras, 0)
})
