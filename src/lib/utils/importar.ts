import Papa from 'papaparse'

export type ErrorFila = { fila: number; campo: string; mensaje: string }
export type FilaImportada = {
  fila: number
  formato: 'csv' | 'json'
  datos: Record<string, unknown>
}

const formatos = {
  productos: {
    columnas: ['ID', 'Nombre', 'Descripción', 'Categoría', 'Precio', 'Estado', 'Sucursales'],
    campos: ['idProducto', 'nombre', 'descripcion', 'categoria', 'precio', 'activo', 'sucursales'],
  },
  usuarios: {
    columnas: ['ID', 'Nombre', 'Apellido', 'Email', 'Rol', 'Sucursal', 'Estado'],
    campos: ['idUsuario', 'nombre', 'apellido', 'email', 'rol', 'sucursal', 'activo'],
  },
}

export class ErrorImportacion extends Error {
  constructor(public errores: ErrorFila[]) {
    super('No se importó ningún registro.')
  }
}

export function verificarErrores(errores: ErrorFila[]) {
  if (errores.length) throw new ErrorImportacion(errores)
}

export function normalizarNombre(valor: string) {
  return valor.trim().normalize('NFC').toLocaleLowerCase('es-AR')
}

export function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

// Un nombre ambiguo nunca se resuelve eligiendo silenciosamente el primer registro.
export function buscarPorNombre<T extends { nombre: string }>(
  valor: unknown, registros: T[], fila: number, campo: string, errores: ErrorFila[],
  alias?: (registro: T) => string,
): T | undefined {
  const nombre = typeof valor === 'string' ? normalizarNombre(valor) : ''
  const encontrados = nombre ? registros.filter((registro) =>
    normalizarNombre(registro.nombre) === nombre || (alias && normalizarNombre(alias(registro)) === nombre),
  ) : []
  if (encontrados.length !== 1) {
    errores.push({ fila, campo, mensaje: encontrados.length > 1
      ? `El nombre de ${campo.toLowerCase()} es ambiguo. Usá un nombre único.`
      : `El nombre de ${campo.toLowerCase()} no existe.` })
    return undefined
  }
  return encontrados[0]
}

// Se llama al validador existente campo por campo para devolver todos los errores.
export function validarCampos<T extends object>(
  datos: Record<string, unknown>, validar: (datos: unknown, parcial: boolean) => T,
  etiquetas: Record<string, string>, fila: number, errores: ErrorFila[],
): T {
  const resultado = {} as T
  for (const [campo, valor] of Object.entries(datos)) {
    try {
      Object.assign(resultado, validar({ [campo]: valor }, true))
    } catch (error) {
      if (!(error instanceof Error) || !('estado' in error) || error.estado !== 400) throw error
      errores.push({ fila, campo: etiquetas[campo] ?? campo, mensaje: error.message })
    }
  }
  return resultado
}

export function estadoImportado(valor: unknown, formato: 'csv' | 'json'): unknown {
  if (formato === 'json' || typeof valor !== 'string') return valor
  const estado = normalizarNombre(valor)
  return estado === 'activo' ? true : estado === 'inactivo' ? false : valor
}

// Los errores técnicos quedan a cargo del proteger() del controlador.
export function responderErrorImportacion(error: unknown): Response {
  let errores: ErrorFila[]
  if (error instanceof ErrorImportacion) {
    errores = error.errores
  } else if (esRegistro(error) && ['P2002', 'P2003', 'P2034'].includes(String(error.code))) {
    errores = [{ fila: 1, campo: 'archivo', mensaje: 'Los datos cambiaron durante la importación. No se guardó ningún registro; revisá el archivo e intentá nuevamente.' }]
  } else {
    throw error
  }
  return Response.json({ errores: errores.sort((a, b) => a.fila - b.fila) }, {
    status: 400, headers: { 'Cache-Control': 'no-store' },
  })
}

function errorArchivo(mensaje: string, fila = 1): never {
  throw new ErrorImportacion([{ fila, campo: 'archivo', mensaje }])
}

// JSON.parse valida la sintaxis. Este recorrido solamente ubica la línea física de
// cada elemento del array, también en JSON con sangría, cadenas escapadas o anidados.
function lineasJson(texto: string): number[] {
  const lineas: number[] = []
  let linea = 1
  let profundidad = 0
  let cadena = false
  let escapado = false
  let esperandoElemento = false
  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i]
    if (caracter === '\n' || (caracter === '\r' && texto[i + 1] !== '\n')) linea++
    if (cadena) {
      if (escapado) escapado = false
      else if (caracter === '\\') escapado = true
      else if (caracter === '"') cadena = false
      continue
    }
    if (/\s/.test(caracter)) continue
    if (profundidad === 1 && esperandoElemento && caracter !== ']') {
      lineas.push(linea)
      esperandoElemento = false
    }
    if (caracter === '"') cadena = true
    else if (caracter === '[' || caracter === '{') {
      profundidad++
      if (profundidad === 1) esperandoElemento = true
    } else if (caracter === ']' || caracter === '}') profundidad--
    else if (caracter === ',' && profundidad === 1) esperandoElemento = true
  }
  return lineas
}

/** Contrato de subida: multipart/form-data, un archivo .csv o .json en `archivo`. */
export async function leerImportacion(request: Request, entidad: keyof typeof formatos) {
  let formulario: FormData
  try {
    formulario = await request.formData()
  } catch {
    return errorArchivo('Enviá un archivo CSV o JSON como multipart/form-data, en el campo archivo.')
  }
  const archivos = formulario.getAll('archivo')
  const archivo = archivos[0]
  if (archivos.length !== 1 || !archivo || typeof archivo === 'string') {
    return errorArchivo('Adjuntá un único archivo en el campo archivo.')
  }
  const extension = archivo.name.split('.').pop()?.toLowerCase()
  if (extension !== 'csv' && extension !== 'json') return errorArchivo('El archivo debe ser CSV o JSON.')
  const texto = (await archivo.text()).replace(/^\uFEFF/, '')
  if (!texto.trim()) return errorArchivo('El archivo está vacío.')
  const filas: FilaImportada[] = []
  const errores: ErrorFila[] = []

  if (extension === 'json') {
    let datos: unknown
    try {
      datos = JSON.parse(texto)
    } catch {
      return errorArchivo('El archivo no contiene JSON válido.')
    }
    if (!Array.isArray(datos)) return errorArchivo('El JSON debe contener una lista de registros, como el archivo exportado.')
    const lineas = lineasJson(texto)
    if (datos.length > 1000) return errorArchivo('El máximo es de 1000 filas por archivo.', lineas[1000])
    datos.forEach((dato, indice) => {
      const fila = lineas[indice]
      if (!esRegistro(dato)) errores.push({ fila, campo: 'archivo', mensaje: 'Cada registro debe ser un objeto JSON.' })
      else filas.push({ fila, formato: 'json', datos: dato })
    })
  } else {
    const { columnas, campos } = formatos[entidad]
    let cursor = 0
    let linea = 1
    let primera = true
    let cantidad = 0
    Papa.parse<string[]>(texto, {
      delimiter: ',',
      skipEmptyLines: false,
      step(resultado, parser) {
        const fila = linea
        linea += (texto.slice(cursor, resultado.meta.cursor).match(/\r\n|\r|\n/g) ?? []).length
        cursor = resultado.meta.cursor
        if (resultado.errors.length) {
          errores.push({ fila, campo: 'archivo', mensaje: 'CSV inválido: revisá las comillas y los separadores de esta fila.' })
        }
        const valores = resultado.data
        if (valores.length === 1 && !valores[0].trim()) return
        if (primera) {
          primera = false
          if (valores.length === columnas.length && valores.every((valor, i) => normalizarNombre(valor) === normalizarNombre(columnas[i]))) return
        }
        cantidad++
        if (cantidad > 1000) {
          parser.abort()
          return errorArchivo('El máximo es de 1000 filas por archivo.', fila)
        }
        if (valores.length !== columnas.length) {
          errores.push({ fila, campo: 'archivo', mensaje: `La fila debe tener ${columnas.length} columnas: ${columnas.join(', ')}.` })
        } else {
          filas.push({ fila, formato: 'csv', datos: Object.fromEntries(campos.map((campo, i) => [campo, valores[i]])) })
        }
      },
    })
  }
  if (!filas.length && !errores.length) return errorArchivo('El archivo no contiene registros para importar.')
  return { filas, errores }
}
