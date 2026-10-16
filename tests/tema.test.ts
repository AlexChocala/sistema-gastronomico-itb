import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import {
  ambitoParaRuta, CLAVES_TEMA, normalizarTema, SCRIPT_TEMA_INICIAL,
} from '../src/lib/tema/tema'
import { aplicarTema, escucharTema, guardarTema, leerTema } from '../src/lib/tema/tema-navegador'

// Dobles en memoria: no consulta sesiones, credenciales ni bases de datos reales.
class Ventana extends EventTarget {
  location = { pathname: '/dashboard' }
  valores = new Map<string, string>()
  bloquearLectura = false
  bloquearEscritura = false
  localStorage = {
    getItem: (clave: string) => {
      if (this.bloquearLectura) throw new Error('Almacenamiento bloqueado')
      return this.valores.get(clave) ?? null
    },
    setItem: (clave: string, valor: string) => {
      if (this.bloquearEscritura) throw new Error('Sin espacio o permiso')
      this.valores.set(clave, valor)
    },
  }
}
const globales = ['window', 'document'] as const
const originales = new Map(globales.map(clave => [clave, Object.getOwnPropertyDescriptor(globalThis, clave)]))
let ventana: Ventana
let raiz: { dataset: Record<string, string> }
function cambioStorage(clave: string | null) {
  const evento = new Event('storage')
  Object.defineProperty(evento, 'key', { value: clave })
  ventana.dispatchEvent(evento)
}
beforeEach(() => {
  ventana = new Ventana()
  raiz = { dataset: {} }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: ventana })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: raiz } })
  const dejarDeEscuchar = escucharTema(() => {})
  cambioStorage(null) // También limpia cualquier preferencia temporal de la prueba anterior.
  dejarDeEscuchar()
})
afterEach(() => {
  for (const clave of globales) {
    const descriptor = originales.get(clave)
    if (descriptor) Object.defineProperty(globalThis, clave, descriptor)
    else Reflect.deleteProperty(globalThis, clave)
  }
})

test('valores inválidos o ausentes usan claro; solo se aceptan los dos temas conocidos', () => {
  assert.equal(normalizarTema('oscuro'), 'oscuro')
  assert.equal(normalizarTema('claro'), 'claro')
  for (const valor of [null, undefined, true, 'dark', 'OSCuro', {}, '<script>']) assert.equal(normalizarTema(valor), 'claro')
})
test('las rutas internas usan personal, sin confundir un slug público de nombre parecido', () => {
  for (const ruta of ['/dashboard', '/configuracion', '/pedidos/20', '/perfil', '/usuarios/archivados', '/pantallas/caja', '/pantallas/cocina', '/pantallas/entregas', '/pantallas/pedidos-mostrador', '/acceso/login']) {
    assert.equal(ambitoParaRuta(ruta), 'personal', ruta)
  }
  for (const ruta of ['/', '/avellaneda', '/avellaneda/carrito', '/avellaneda/checkout', '/pedidos-online', '/configuracion-local']) {
    assert.equal(ambitoParaRuta(ruta), 'cliente', ruta)
  }
})
for (const ruta of ['/', '/avellaneda/checkout', '/configuracion', '/pantallas/cocina']) {
  test(`script inicial aplica el ámbito y preferencia antes de hidratar: ${ruta}`, () => {
    ventana.valores.set(CLAVES_TEMA.personal, 'oscuro')
    ventana.valores.set(CLAVES_TEMA.cliente, 'claro')
    runInNewContext(SCRIPT_TEMA_INICIAL, { location: { pathname: ruta }, localStorage: ventana.localStorage, document: { documentElement: raiz } })
    const ambito = ambitoParaRuta(ruta)
    assert.equal(raiz.dataset.ambitoTema, ambito)
    assert.equal(raiz.dataset.tema, ambito === 'personal' ? 'oscuro' : 'claro')
  })
}
test('script inicial tolera almacenamiento bloqueado sin impedir que abra la página', () => {
  ventana.bloquearLectura = true
  assert.doesNotThrow(() => runInNewContext(SCRIPT_TEMA_INICIAL, { location: ventana.location, localStorage: ventana.localStorage, document: { documentElement: raiz } }))
  assert.equal(raiz.dataset.tema, 'claro')
})
test('elegir un tema persiste y actualiza el ámbito activo, sin cambiar la preferencia del cliente', () => {
  guardarTema('personal', 'oscuro')
  assert.equal(ventana.valores.get(CLAVES_TEMA.personal), 'oscuro')
  assert.equal(leerTema('cliente'), 'claro')
  assert.equal(raiz.dataset.tema, 'oscuro')
  ventana.location.pathname = '/avellaneda'
  aplicarTema(leerTema('cliente'), 'cliente')
  assert.equal(raiz.dataset.tema, 'claro')
  guardarTema('cliente', 'oscuro')
  guardarTema('personal', 'claro')
  assert.equal(raiz.dataset.tema, 'oscuro')
  assert.equal(leerTema('personal'), 'claro')
})
test('si falla la escritura, la elección funciona aunque todavía pueda leerse un valor anterior', () => {
  ventana.valores.set(CLAVES_TEMA.personal, 'claro')
  ventana.bloquearEscritura = true
  guardarTema('personal', 'oscuro')
  assert.equal(leerTema('personal'), 'oscuro')
  assert.equal(raiz.dataset.tema, 'oscuro')
})
test('si lectura y escritura están bloqueadas, el control sigue funcionando en memoria', () => {
  ventana.bloquearLectura = true
  ventana.bloquearEscritura = true
  guardarTema('personal', 'oscuro')
  assert.equal(leerTema('personal'), 'oscuro')
  guardarTema('personal', 'claro')
  assert.equal(leerTema('personal'), 'claro')
})
test('el cambio entre pestañas actualiza el DOM antes de notificar, y permite desuscribirse', () => {
  let avisos = 0
  const dejarDeEscuchar = escucharTema(() => {
    avisos++
    assert.equal(raiz.dataset.tema, leerTema('personal'))
  })
  ventana.valores.set(CLAVES_TEMA.personal, 'oscuro')
  cambioStorage(CLAVES_TEMA.personal)
  assert.equal(raiz.dataset.tema, 'oscuro')
  assert.equal(avisos, 1)
  cambioStorage('otra-preferencia')
  assert.equal(avisos, 1)
  ventana.valores.clear()
  cambioStorage(null)
  assert.equal(raiz.dataset.tema, 'claro')
  assert.equal(avisos, 2)
  dejarDeEscuchar()
  cambioStorage(CLAVES_TEMA.personal)
  assert.equal(avisos, 2)
})

// Comprueba la página real con sus dependencias del servidor sustituidas. El caso
// no-admin debe renderizar solo apariencia y no consultar datos del negocio.
async function renderizarConfiguracion(rol: string | null) {
  let consultasNegocio = 0
  const Apariencia = () => null
  const Negocio = () => null
  const fuente = readFileSync(resolve('src/app/(panel)/configuracion/page.tsx'), 'utf8')
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports: Record<string, () => Promise<unknown>> = {}
  const dependencias: Record<string, unknown> = {
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'next-auth': { getServerSession: async () => rol ? { user: { idUsuario: 7 } } : null },
    'next/navigation': { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } },
    '@/lib/auth/auth': { authOptions: {} },
    '@/lib/db/prisma': { prisma: {
      usuario: { findUnique: async () => ({ rol: { nombre: rol } }) },
      negocio: { findUnique: async () => { consultasNegocio++; return { nombre: 'Local', logoPath: null } } },
    } },
    '@/lib/negocio/negocio': { urlLogoNegocio: () => null },
    '@/components/forms/ConfiguracionNegocioForm': { ConfiguracionNegocioForm: Negocio },
    '@/components/tema/ConfiguracionApariencia': { ConfiguracionApariencia: Apariencia },
  }
  runInNewContext(codigo, { exports, require: (nombre: string) => {
    assert.ok(nombre in dependencias, `Dependencia inesperada: ${nombre}`)
    return dependencias[nombre]
  } })
  const arbol = await exports.default()
  function contiene(nodo: unknown, tipo: unknown): boolean {
    if (!nodo || typeof nodo !== 'object') return false
    if (Array.isArray(nodo)) return nodo.some(n => contiene(n, tipo))
    const elemento = nodo as { type?: unknown; props?: { children?: unknown } }
    return elemento.type === tipo || contiene(elemento.props?.children, tipo)
  }
  return { apariencia: contiene(arbol, Apariencia), negocio: contiene(arbol, Negocio), consultasNegocio }
}
for (const rol of ['empleado', 'supervisor']) {
  test(`${rol}: Configuración muestra apariencia sin consultar ni exponer los datos del negocio`, async () => {
    const salida = await renderizarConfiguracion(rol)
    assert.deepEqual(salida, { apariencia: true, negocio: false, consultasNegocio: 0 })
  })
}
test('administrador conserva apariencia y el formulario del negocio', async () => {
  assert.deepEqual(await renderizarConfiguracion('admin'), { apariencia: true, negocio: true, consultasNegocio: 1 })
})
test('Configuración sigue requiriendo sesión', async () => {
  await assert.rejects(renderizarConfiguracion(null), /REDIRECT:\/acceso\/login/)
})

async function pasarPorProxy(ruta: string, rol: string | null) {
  type Resultado = { permitido: boolean; destino?: string }
  const fuente = readFileSync(resolve('src/proxy.ts'), 'utf8')
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports: Record<string, (request: unknown) => Promise<Resultado>> = {}
  runInNewContext(codigo, {
    exports, URL, process: { env: {} },
    require: (nombre: string) => {
      if (nombre === 'next/server') return { NextResponse: {
        next: () => ({ permitido: true }),
        redirect: (url: URL) => ({ permitido: false, destino: url.pathname }),
      } }
      if (nombre === 'next-auth/jwt') return { getToken: async () => rol ? { rol } : null }
      throw new Error(`Dependencia inesperada: ${nombre}`)
    },
  })
  const resultado = await exports.proxy({ url: `http://localhost:3000${ruta}`, nextUrl: { pathname: ruta } })
  return { permitido: resultado.permitido, destino: resultado.destino }
}
test('el proxy permite Configuración a todos los roles con sesión', async () => {
  for (const rol of ['admin', 'supervisor', 'empleado']) {
    assert.equal((await pasarPorProxy('/configuracion', rol)).permitido, true)
  }
})
test('el proxy conserva la exigencia de sesión en Configuración', async () => {
  assert.deepEqual(await pasarPorProxy('/configuracion', null), { permitido: false, destino: '/acceso/login' })
})
test('el proxy sigue reservando Usuarios al administrador', async () => {
  assert.equal((await pasarPorProxy('/usuarios', 'admin')).permitido, true)
  for (const rol of ['supervisor', 'empleado']) {
    assert.deepEqual(await pasarPorProxy('/usuarios', rol), { permitido: false, destino: '/dashboard' })
  }
})
test('el proxy conserva las restricciones de las pantallas operativas', async () => {
  for (const ruta of ['/pantallas/caja', '/pantallas/cocina', '/pantallas/entregas']) {
    assert.deepEqual(await pasarPorProxy(ruta, 'admin'), { permitido: false, destino: '/dashboard' })
    assert.equal((await pasarPorProxy(ruta, 'empleado')).permitido, true)
  }
})
