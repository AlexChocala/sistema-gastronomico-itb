import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcrypt'
import type { PrismaClient } from '@prisma/client'
import { crearControladorUsuarios } from '../src/lib/usuarios/usuarios-administracion'

function escenario() {
  const estado = { sesion: true, rol: 'admin', activo: true, pendiente: false, escrituras: 0, hashes: new Map<number, string>() }
  const db = { usuario: {
    findUnique: async () => ({ activo: estado.activo, debeCambiarContrasena: estado.pendiente, rol: { nombre: estado.rol } }),
    update: async ({ where, data, select }: { where: { idUsuario: number }; data: { passwordHash: string; debeCambiarContrasena: boolean }; select: Record<string, unknown> }) => {
      if (![2, 3].includes(where.idUsuario)) throw { code: 'P2025' }
      assert.equal(select.passwordHash, undefined)
      assert.equal(data.debeCambiarContrasena, true)
      estado.escrituras++; estado.hashes.set(where.idUsuario, data.passwordHash)
      return { idUsuario: where.idUsuario, nombre: 'Admin', apellido: 'Prueba', activo: true }
    },
  } } as unknown as PrismaClient
  const controlador = crearControladorUsuarios(db, async () => estado.sesion ? { user: { idUsuario: 2, rol: 'admin' } } : null)
  return { estado, controlador }
}
function request(origen = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/usuarios/3/restablecer-contrasena', { method: 'POST', headers: { origin: origen } })
}
test('admin restablece otra cuenta y genera una temporal que obliga a cambiarla', async () => {
  const e = escenario()
  const respuesta = await e.controlador.restablecerContrasena(request(), '3')
  assert.equal(respuesta.status, 200)
  assert.equal(respuesta.headers.get('Cache-Control'), 'no-store')
  const datos = await respuesta.json()
  assert.equal(datos.passwordGenerada.length, 10)
  assert.equal(await bcrypt.compare(datos.passwordGenerada, e.estado.hashes.get(3)!), true)
  assert.equal(datos.usuario.passwordHash, undefined)
  assert.equal(e.estado.escrituras, 1)
})
test('el administrador no puede saltarse la contraseña actual mediante el restablecimiento propio', async () => {
  const e = escenario()
  assert.equal((await e.controlador.restablecerContrasena(request(), '2')).status, 400)
  assert.equal(e.estado.escrituras, 0)
})
for (const rol of ['empleado', 'supervisor']) {
  test(`${rol} no puede restablecer ninguna cuenta aunque la sesión contenga un rol anterior de admin`, async () => {
    const e = escenario(); e.estado.rol = rol
    for (const destino of ['2', '3']) assert.equal((await e.controlador.restablecerContrasena(request(), destino)).status, 403)
    assert.equal(e.estado.escrituras, 0)
  })
}
test('restablecer exige sesión, cuenta activa, cambio pendiente resuelto y origen de la aplicación', async () => {
  const e = escenario()
  e.estado.sesion = false; assert.equal((await e.controlador.restablecerContrasena(request(), '3')).status, 401)
  e.estado.sesion = true; e.estado.activo = false; assert.equal((await e.controlador.restablecerContrasena(request(), '3')).status, 403)
  e.estado.activo = true; e.estado.pendiente = true; assert.equal((await e.controlador.restablecerContrasena(request(), '3')).status, 403)
  e.estado.pendiente = false; assert.equal((await e.controlador.restablecerContrasena(request('https://otro.example'), '3')).status, 403)
  assert.equal(e.estado.escrituras, 0)
})
test('un identificador inválido o inexistente no modifica ninguna contraseña', async () => {
  const e = escenario()
  assert.equal((await e.controlador.restablecerContrasena(request(), '0')).status, 400)
  assert.equal((await e.controlador.restablecerContrasena(request(), '999')).status, 404)
  assert.equal(e.estado.escrituras, 0)
})
