// Validación de los datos del negocio (tabla Negocio, fila única). Sin imports de
// servidor: la usan la API de configuración inicial y la de Configuración, y sus
// límites los reflejan los formularios del cliente.

export class ErrorConfiguracion extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje)
  }
}

export const MAX_NOMBRE_NEGOCIO = 100
export const MAX_DESCRIPCION_NEGOCIO = 150
export const MAX_LINK_RED_SOCIAL = 200

type DatosNegocioInicial = {
  nombre: string
  descripcion: string | null
}

export type RedSocial = 'instagram' | 'tiktok' | 'facebook'

// Dominios aceptados por red (se comparan en minúsculas, tal como los deja URL). Así el
// menú digital nunca muestra un "Instagram" que en realidad lleva a otro sitio.
export const REDES_SOCIALES: Record<RedSocial, { etiqueta: string; dominios: string[]; ejemplo: string }> = {
  instagram: {
    etiqueta: 'Instagram',
    dominios: ['instagram.com', 'www.instagram.com'],
    ejemplo: 'https://instagram.com/tu-local',
  },
  tiktok: {
    etiqueta: 'TikTok',
    dominios: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
    ejemplo: 'https://tiktok.com/@tu-local',
  },
  facebook: {
    etiqueta: 'Facebook',
    dominios: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'],
    ejemplo: 'https://facebook.com/tu-local',
  },
}

export const MAX_TITULAR_TRANSFERENCIA = 100

type DatosNegocio = {
  nombre?: string
  descripcion?: string | null
  transferenciaAlias?: string | null
  transferenciaCuit?: string | null
  transferenciaTitular?: string | null
} & Partial<Record<RedSocial, string | null>>

// Texto opcional: null o vacío se guardan como null.
function textoOpcional(valor: unknown, mensaje: string): string {
  if (valor === null) return ''
  if (typeof valor !== 'string') throw new ErrorConfiguracion(400, mensaje)
  return valor.trim()
}

// Alias de transferencia: 6 a 20 caracteres entre letras, números, punto y guion. Los
// bancos no distinguen mayúsculas, así que se guarda en minúsculas.
export function validarAlias(valor: unknown): string | null {
  const texto = textoOpcional(valor, 'El alias debe ser texto o null.').toLowerCase()
  if (!texto) return null
  if (!/^[a-z0-9.-]{6,20}$/.test(texto)) {
    throw new ErrorConfiguracion(400, 'El alias debe tener entre 6 y 20 caracteres: letras, números, punto o guion.')
  }
  return texto
}

// CUIT o CUIL (AFIP): 11 dígitos. Los 2 primeros son el tipo (20/23/24/27 personas,
// 30/33/34 empresas) y el último es el verificador: pesos 5,4,3,2,7,6,5,4,3,2 sobre los
// 10 primeros, y 11 - (suma % 11). Si da 11 es 0; si da 10, el número no existe.
const TIPOS_CUIT = ['20', '23', '24', '27', '30', '33', '34']

export function cuitValido(digitos: string) {
  if (!/^\d{11}$/.test(digitos) || !TIPOS_CUIT.includes(digitos.slice(0, 2))) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((total, peso, indice) => total + peso * Number(digitos[indice]), 0)
  const verificador = 11 - (suma % 11)
  if (verificador === 10) return false
  return (verificador === 11 ? 0 : verificador) === Number(digitos[10])
}

// '20123456789' → '20-12345678-9' (como lo muestran los bancos).
export function formatearCuit(digitos: string) {
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`
}

// Se carga y se guarda solo con dígitos; los guiones se agregan al mostrárselo al cliente.
export function validarCuit(valor: unknown): string | null {
  const digitos = textoOpcional(valor, 'El CUIT/CUIL debe ser texto o null.')
  if (!digitos) return null
  if (!/^\d{11}$/.test(digitos)) {
    throw new ErrorConfiguracion(400, 'El CUIT/CUIL tiene que tener 11 números, sin guiones ni espacios.')
  }
  if (!cuitValido(digitos)) throw new ErrorConfiguracion(400, 'El CUIT/CUIL no es válido. Revisá que esté bien escrito.')
  return digitos
}

export function validarTitular(valor: unknown): string | null {
  const texto = textoOpcional(valor, 'El titular debe ser texto o null.')
  if (!texto) return null
  if (texto.length > MAX_TITULAR_TRANSFERENCIA) {
    throw new ErrorConfiguracion(400, `El titular puede tener hasta ${MAX_TITULAR_TRANSFERENCIA} caracteres.`)
  }
  return texto
}

function objetoNegocio(cuerpo: unknown) {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorConfiguracion(400, 'Enviá un objeto JSON con los datos del negocio.')
  }
  return cuerpo as Record<string, unknown>
}

function validarNombre(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > MAX_NOMBRE_NEGOCIO) {
    throw new ErrorConfiguracion(400, `El nombre del negocio debe tener entre 1 y ${MAX_NOMBRE_NEGOCIO} caracteres.`)
  }
  return valor.trim()
}

function validarDescripcion(valor: unknown): string | null {
  if (valor === null) return null
  if (typeof valor !== 'string' || valor.trim().length > MAX_DESCRIPCION_NEGOCIO) {
    throw new ErrorConfiguracion(400, `La descripción debe ser texto de hasta ${MAX_DESCRIPCION_NEGOCIO} caracteres o null.`)
  }
  // Una descripción vacía o solo con espacios se guarda como null.
  return valor.trim() || null
}

// Devuelve el link normalizado (siempre https://...) o null si viene vacío.
export function normalizarRedSocial(red: RedSocial, valor: unknown): string | null {
  const { etiqueta, dominios, ejemplo } = REDES_SOCIALES[red]
  if (valor === null) return null
  if (typeof valor !== 'string') {
    throw new ErrorConfiguracion(400, `El link de ${etiqueta} debe ser texto o null.`)
  }
  const texto = valor.trim()
  if (!texto) return null
  if (texto.length > MAX_LINK_RED_SOCIAL) {
    throw new ErrorConfiguracion(400, `El link de ${etiqueta} puede tener hasta ${MAX_LINK_RED_SOCIAL} caracteres.`)
  }
  const invalido = new ErrorConfiguracion(400, `El link de ${etiqueta} no es válido (ej: ${ejemplo}).`)
  if (/\s/.test(texto)) throw invalido

  // Sin esquema se asume https ("instagram.com/tu-local"). Si trae uno, tiene que ser
  // https: así quedan afuera http:, javascript:, data:, etc.
  const tieneEsquema = /^[a-z][a-z0-9+.-]*:/i.test(texto)
  let url: URL
  try {
    url = new URL(tieneEsquema ? texto : `https://${texto}`)
  } catch {
    throw invalido
  }
  if (url.protocol !== 'https:') {
    throw new ErrorConfiguracion(400, `El link de ${etiqueta} tiene que empezar con https:// (ej: ${ejemplo}).`)
  }
  if (url.username || url.password || url.port) throw invalido
  if (!dominios.includes(url.hostname)) {
    throw new ErrorConfiguracion(400, `El link de ${etiqueta} tiene que ser de ${dominios[0]} (ej: ${ejemplo}).`)
  }
  // Un link a la página de inicio de la red no le sirve al cliente: tiene que llevar al perfil.
  if (!url.pathname.replace(/\//g, '')) {
    throw new ErrorConfiguracion(400, `El link de ${etiqueta} tiene que llevar a tu perfil (ej: ${ejemplo}).`)
  }
  // Al agregar https:// o normalizar la URL puede crecer: el tope vale para lo que se guarda.
  if (url.href.length > MAX_LINK_RED_SOCIAL) {
    throw new ErrorConfiguracion(400, `El link de ${etiqueta} puede tener hasta ${MAX_LINK_RED_SOCIAL} caracteres.`)
  }
  return url.href
}

export function validarNegocioInicial(cuerpo: unknown): DatosNegocioInicial {
  const datos = objetoNegocio(cuerpo)
  const permitidos = ['nombre', 'descripcion']
  if (Object.keys(datos).some((c) => !permitidos.includes(c))) {
    throw new ErrorConfiguracion(400, 'Los datos del negocio tienen campos que no se reconocen.')
  }
  return {
    nombre: validarNombre(datos.nombre),
    descripcion: 'descripcion' in datos ? validarDescripcion(datos.descripcion) : null,
  }
}

// Edición desde Configuración. El logo no pasa por acá: tiene su propio endpoint.
export function validarNegocio(cuerpo: unknown, parcial: boolean): DatosNegocio {
  const datos = objetoNegocio(cuerpo)
  const redes = Object.keys(REDES_SOCIALES) as RedSocial[]
  const transferencia = ['transferenciaAlias', 'transferenciaCuit', 'transferenciaTitular']
  const permitidos = ['nombre', 'descripcion', ...redes, ...transferencia]
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((c) => !permitidos.includes(c))) {
    throw new ErrorConfiguracion(400, 'Enviá al menos un campo válido del negocio.')
  }
  const salida: DatosNegocio = {}
  if (!parcial || 'nombre' in datos) salida.nombre = validarNombre(datos.nombre)
  if ('descripcion' in datos) salida.descripcion = validarDescripcion(datos.descripcion)
  for (const red of redes) {
    if (red in datos) salida[red] = normalizarRedSocial(red, datos[red])
  }
  // Datos para transferencias: todos opcionales. Si queda alguno sin cargar (titular,
  // alias o CUIT/CUIL), el menú simplemente no ofrece pagar por transferencia.
  if ('transferenciaAlias' in datos) salida.transferenciaAlias = validarAlias(datos.transferenciaAlias)
  if ('transferenciaCuit' in datos) salida.transferenciaCuit = validarCuit(datos.transferenciaCuit)
  if ('transferenciaTitular' in datos) salida.transferenciaTitular = validarTitular(datos.transferenciaTitular)
  return salida
}
