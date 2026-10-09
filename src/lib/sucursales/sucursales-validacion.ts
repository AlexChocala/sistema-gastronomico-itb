export class ErrorSucursal extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje)
  }
}

// Tope de sucursales por negocio. Cuenta también las desactivadas: si no, se podría
// desactivar y crear sin límite.
export const MAX_SUCURSALES = 20

// WhatsApp en formato nacional argentino: código de área + número, sin 0 ni 15.
// Siempre son 10 dígitos (ej: 1123493023). El código de país lo agrega linkWhatsapp.
export const MENSAJE_WHATSAPP = 'Ingresá el código de área y el número, sin 0 ni 15 (10 dígitos). Ej: 1123493023.'

export function whatsappValido(digitos: string) {
  return /^[1-9]\d{9}$/.test(digitos)
}

// Link para abrir el chat: 54 (Argentina) + 9 (celular) + número nacional.
export function linkWhatsapp(numero: string) {
  return `https://wa.me/549${numero}`
}

// Segmentos que ya usa la aplicación en la raíz de la URL: una sucursal no puede tomar
// ninguno como slug, porque su menú público vive en /{slug}. Son las carpetas reales de
// primer nivel de src/app; (panel) es un route group, así que sus páginas (dashboard,
// pedidos, etc.) también cuelgan de la raíz. Si se agrega una ruta nueva de primer nivel,
// hay que sumarla acá (y revisar que ninguna sucursal existente ya tenga ese slug).
export const SLUGS_RESERVADOS = [
  'acceso', 'api', 'pantallas', 'pruebas', 'configuracion-inicial', 'configuracion',
  'dashboard', 'pedidos', 'productos', 'usuarios', 'sucursales', 'reportes', 'perfil',
]

export const MAX_SLUG = 60

// Slug base a partir del nombre: "Prueba - San Martín" → "prueba-san-martin". Puede
// quedar vacío (nombre sin letras ni números); elegirSlug lo resuelve.
export function generarSlug(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes y diéresis (la ñ queda como n + virgulilla)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '')
}

// Primer slug libre a partir de la base: la base misma, o base-2, base-3... si está
// reservada o ya la usa otra sucursal. Sin base (nombre sin letras ni números) se usa "sucursal".
export function elegirSlug(base: string, usados: Set<string>) {
  const raiz = base || 'sucursal'
  const libre = (slug: string) => !SLUGS_RESERVADOS.includes(slug) && !usados.has(slug)
  if (libre(raiz)) return raiz
  for (let numero = 2; ; numero++) {
    const candidato = `${raiz}-${numero}`
    if (libre(candidato)) return candidato
  }
}

export function idValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 && valor <= 2147483647
}

export function leerId(valor: string): number {
  const id = Number(valor)
  if (!/^[1-9]\d*$/.test(valor) || !idValido(id)) {
    throw new ErrorSucursal(400, 'El identificador debe ser un entero mayor que cero.')
  }
  return id
}

type DatosSucursal = {
  nombre?: string
  slug?: string
  direccion?: string
  whatsapp?: string | null
  horario?: string | null
  idLocalidad?: number
  activa?: boolean
  ofreceRetiro?: boolean
  ofreceDelivery?: boolean
}

// En un alta (parcial = false) los campos obligatorios siempre vienen validados.
type DatosSucursalNueva = DatosSucursal & {
  nombre: string
  direccion: string
  idLocalidad: number
  ofreceRetiro: boolean
  ofreceDelivery: boolean
}

export const MENSAJE_SIN_ENTREGA = 'La sucursal tiene que ofrecer al menos retiro en el local o delivery.'

export function validarSucursal(cuerpo: unknown, parcial: false): DatosSucursalNueva
export function validarSucursal(cuerpo: unknown, parcial: boolean): DatosSucursal
export function validarSucursal(cuerpo: unknown, parcial: boolean): DatosSucursal {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorSucursal(400, 'Enviá un objeto JSON con los datos de la sucursal.')
  }
  const datos = cuerpo as Record<string, unknown>
  // En el alta el slug no viene: lo genera el servidor a partir del nombre. En la edición
  // el admin lo puede cambiar (el anterior queda redirigiendo, ver cambiarSlug).
  const permitidos = [
    'nombre', 'direccion', 'whatsapp', 'horario', 'idLocalidad', 'ofreceRetiro', 'ofreceDelivery',
    ...(parcial ? ['activa', 'slug'] : []),
  ]
  if (Object.keys(datos).length === 0 || Object.keys(datos).some((c) => !permitidos.includes(c))) {
    throw new ErrorSucursal(400, 'Enviá al menos un campo válido de la sucursal.')
  }
  const salida: DatosSucursal = {}
  if (!parcial || 'nombre' in datos) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 100) {
      throw new ErrorSucursal(400, 'El nombre debe tener entre 1 y 100 caracteres.')
    }
    salida.nombre = datos.nombre.trim()
  }
  if ('slug' in datos) {
    if (typeof datos.slug !== 'string') throw new ErrorSucursal(400, 'El link de la carta debe ser texto.')
    // Se normaliza igual que al crearlo: "Palermo Soho" → "palermo-soho".
    const slug = generarSlug(datos.slug)
    if (!slug) throw new ErrorSucursal(400, 'El link de la carta tiene que tener al menos una letra o un número.')
    if (SLUGS_RESERVADOS.includes(slug)) {
      throw new ErrorSucursal(400, `"/${slug}" lo usa el sistema. Elegí otro link para la carta.`)
    }
    salida.slug = slug
  }
  if (!parcial || 'direccion' in datos) {
    if (typeof datos.direccion !== 'string' || !datos.direccion.trim() || datos.direccion.trim().length > 200) {
      throw new ErrorSucursal(400, 'La dirección debe tener entre 1 y 200 caracteres.')
    }
    salida.direccion = datos.direccion.trim()
  }
  if ('whatsapp' in datos) {
    if (datos.whatsapp !== null && typeof datos.whatsapp !== 'string') {
      throw new ErrorSucursal(400, 'El WhatsApp debe ser texto o null.')
    }
    // Se aceptan espacios, guiones o paréntesis al escribir, pero se guardan solo los dígitos.
    const texto = typeof datos.whatsapp === 'string' ? datos.whatsapp.trim() : ''
    const digitos = texto.replace(/[\s\-()]/g, '')
    if (texto && !whatsappValido(digitos)) {
      throw new ErrorSucursal(400, MENSAJE_WHATSAPP)
    }
    salida.whatsapp = digitos || null
  }
  if ('horario' in datos) {
    if (datos.horario !== null && (typeof datos.horario !== 'string' || datos.horario.length > 100)) {
      throw new ErrorSucursal(400, 'El horario debe ser texto de hasta 100 caracteres o null.')
    }
    const horarioLimpio = typeof datos.horario === 'string' ? datos.horario.trim() : ''
    if (horarioLimpio && !/\d/.test(horarioLimpio)) {
      throw new ErrorSucursal(400, 'El horario debe incluir al menos un número (ej: "9 a 22hs").')
    }
    salida.horario = horarioLimpio || null
  }
  if (!parcial || 'idLocalidad' in datos) {
    if (!idValido(datos.idLocalidad)) throw new ErrorSucursal(400, 'Indicá una localidad válida.')
    salida.idLocalidad = datos.idLocalidad
  }
  if ('activa' in datos) {
    if (typeof datos.activa !== 'boolean') throw new ErrorSucursal(400, 'Activa debe ser true o false.')
    salida.activa = datos.activa
  }
  for (const campo of ['ofreceRetiro', 'ofreceDelivery'] as const) {
    if (campo in datos) {
      if (typeof datos[campo] !== 'boolean') throw new ErrorSucursal(400, 'Las formas de entrega deben ser true o false.')
      salida[campo] = datos[campo]
    } else if (!parcial) {
      // En un alta, si no se indica, la sucursal ofrece las dos.
      salida[campo] = true
    }
  }
  // En una edición parcial puede venir una sola: la regla completa la revisa el servidor
  // contra la fila actual (ver editar en sucursales-administracion).
  if (salida.ofreceRetiro === false && salida.ofreceDelivery === false) {
    throw new ErrorSucursal(400, MENSAJE_SIN_ENTREGA)
  }
  return salida
}

export async function leerCuerpo(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ErrorSucursal(415, 'Enviá los datos como application/json.')
  }
  try {
    return await request.json()
  } catch {
    throw new ErrorSucursal(400, 'El cuerpo de la solicitud no es un JSON válido.')
  }
}