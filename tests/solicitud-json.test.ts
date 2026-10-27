import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ErrorSolicitud, mensajeErrorSolicitud, solicitarJson } from '../src/lib/utils/solicitud-json'

const esError = (tipo: string, texto?: RegExp) => (e: unknown) => {
  assert.ok(e instanceof ErrorSolicitud)
  assert.equal(e.tipo, tipo)
  if (texto) assert.match(e.message, texto)
  return true
}

test('éxito JSON conserva los datos y usa no-store', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.cache, 'no-store')
    return Response.json({ registros: [], totalRegistros: 0 })
  })
  assert.deepEqual(await solicitarJson('/api/asistencia'), { registros: [], totalRegistros: 0 })
  assert.equal(fetch.mock.callCount(), 1)
})

test('red caída no muestra Failed to fetch ni detalles de la excepción', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch postgresql://dato-privado') })
  await assert.rejects(solicitarJson('/api/asistencia', undefined, { accion: 'cargar la asistencia' }), e => {
    esError('conexion', /Problema de conexión.*cargar la asistencia/)(e)
    assert.doesNotMatch((e as Error).message, /Failed to fetch|postgresql|dato-privado/)
    return true
  })
})

test('no se reenvían escrituras fallidas y se pide comprobar el resultado antes de repetir', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('NetworkError') })
  for (const method of ['POST', 'PUT']) {
    await assert.rejects(solicitarJson('/api/asistencia', { method }, { accion: 'registrar la salida' }), esError('conexion', /comprobar si la operación quedó registrada antes de repetirla/))
  }
  assert.equal(fetch.mock.callCount(), 2)
})

test('espera agotada interrumpe la solicitud y diferencia el mensaje de un error de permisos', async t => {
  t.mock.method(globalThis, 'fetch', (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  await assert.rejects(solicitarJson('/api/asistencia', { method: 'PUT' }, { accion: 'guardar el horario', tiempoMaximo: 5 }), esError('tiempo', /tiempo de espera.*guardar el horario.*comprobar/))
})

test('cancelar una consulta por desmontaje no se presenta como caída del servidor', async t => {
  const control = new AbortController()
  t.mock.method(globalThis, 'fetch', (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  const consulta = solicitarJson('/api/asistencia', { signal: control.signal })
  control.abort()
  await assert.rejects(consulta, esError('cancelada'))
})

for (const [estado, tipo, texto] of [
  [401, 'sesion', /Volvé a iniciar sesión/],
  [403, 'permisos', /No tenés permiso.*Solo el administrador/],
  [404, 'permisos', /dentro de tus permisos/],
  [400, 'datos', /Revisá los datos ingresados.*La tolerancia/],
  [422, 'datos', /Revisá los datos ingresados/],
  [409, 'estado', /No pudimos guardar el horario.*El horario cambió/],
  [415, 'datos', /información no se pudo enviar/],
  [429, 'limite', /Esperá unos momentos/],
  [503, 'servidor', /sistema no pudo guardar el horario.*administrador/],
  [504, 'tiempo', /tardó demasiado/],
] as const) {
  test(`HTTP ${estado}: explica ${tipo} sin atribuirlo a la conexión`, async t => {
    const error = estado === 403 ? 'Solo el administrador puede asignar horarios.' : estado === 409 ? 'El horario cambió. Actualizá la ficha.' : 'La tolerancia debe estar entre 0 y 120 minutos.'
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error }, { status: estado }))
    await assert.rejects(solicitarJson('/api/asistencia', undefined, { accion: 'guardar el horario' }), e => {
      esError(tipo, texto)(e); assert.equal((e as ErrorSolicitud).estado, estado); return true
    })
  })
}

test('un error 500 no expone SQL, rutas, contraseñas ni mensajes internos', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Prisma P1000 password=privado SELECT * FROM Usuario C:/servidor' }, { status: 500 }))
  await assert.rejects(solicitarJson('/api/asistencia'), e => {
    esError('servidor')(e)
    assert.doesNotMatch((e as Error).message, /Prisma|P1000|password|SELECT|C:/)
    return true
  })
})

test('HTML o JSON inválido en un 401/503 respeta el estado HTTP, no culpa a los datos del usuario', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  for (const [estado, tipo] of [[401, 'sesion'], [503, 'servidor']] as const) {
    fetch.mock.mockImplementation(async () => new Response('<html>Información interna</html>', { status: estado }))
    await assert.rejects(solicitarJson('/api/asistencia'), esError(tipo))
  }
})

test('una respuesta 200 ilegible o vacía no se presenta como éxito o falta de Internet', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  for (const respuesta of [new Response('<html>Privado</html>'), Response.json(null), Response.json('dato incompleto'), Response.json([])]) {
    fetch.mock.mockImplementation(async () => respuesta)
    await assert.rejects(solicitarJson('/api/asistencia', { method: 'PUT' }), esError('respuesta', /comprobar si la operación quedó registrada/))
  }
})

test('rechaza HTML y detalles malformados en errores esperados', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  for (const error of ['<script>privado</script>', 'x'.repeat(401), { texto: 'privado' }, 'Privado\nStack']) {
    fetch.mock.mockImplementation(async () => Response.json({ error }, { status: 400 }))
    await assert.rejects(solicitarJson('/api/asistencia'), e => {
      esError('datos')(e); assert.doesNotMatch((e as Error).message, /script|Privado|privado|Stack/); return true
    })
  }
})

test('redirección al login identifica sesión vencida aunque el servidor responda HTML con 200', async t => {
  const respuesta = new Response('<html>Login</html>')
  Object.defineProperties(respuesta, { redirected: { value: true }, url: { value: 'https://ejemplo.test/acceso/login?callbackUrl=asistencia' } })
  t.mock.method(globalThis, 'fetch', async () => respuesta)
  await assert.rejects(solicitarJson('/api/asistencia'), esError('sesion'))
})

test('el menú puede mostrar errores públicos de la solicitud sin mostrar excepciones de generación', () => {
  assert.equal(mensajeErrorSolicitud(new ErrorSolicitud('permisos', 'No tenés permiso.')), 'No tenés permiso.')
  assert.equal(mensajeErrorSolicitud(new Error('Ruta interna, token privado'), 'No pudimos generar el archivo.'), 'No pudimos generar el archivo.')
})


test('un problema conocido de configuración pide ayuda al administrador, sin pedir revisar Internet', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ codigo: 'ASISTENCIA_NO_CONFIGURADA', error: 'P2021 detalle interno' }, { status: 503 }))
  await assert.rejects(solicitarJson('/api/asistencia'), e => {
    esError('servidor', /problema de configuración.*administrador/)(e)
    assert.doesNotMatch((e as Error).message, /P2021|detalle interno|conexión/)
    return true
  })
})
