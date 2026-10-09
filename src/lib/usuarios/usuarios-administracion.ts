import {
  leerImportacion, buscarPorNombre, validarCampos, verificarErrores, estadoImportado,
  normalizarNombre, esRegistro, responderErrorImportacion,
} from '@/lib/utils/importar'
import type { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'
import { ErrorUsuario, idValido, leerId, leerCuerpo, validarUsuario } from './usuarios-validacion'
import { rolSinSucursal, etiquetaRol } from './roles'
import { ErrorImagen, subirImagen, quitarImagen, urlImagenPublica } from '@/lib/storage/imagenes'

type Sesion = { user: { idUsuario: number } } | null

const camposUsuario = {
  idUsuario: true, nombre: true, apellido: true, email: true, activo: true, fotoPerfilPath: true,
  idRol: true, rol: { select: { idRol: true, nombre: true } },
  idSucursal: true, sucursal: { select: { idSucursal: true, nombre: true } },
} satisfies Prisma.UsuarioSelect

function generarPasswordAleatoria(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return password
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

function responderError(error: unknown) {
  if (error instanceof ErrorUsuario || error instanceof ErrorImagen) return responder({ error: error.message }, error.estado)
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  if (codigo === 'P2025') return responder({ error: 'No se encontró el registro solicitado.' }, 404)
  if (codigo === 'P2002') return responder({ error: 'El email ya está en uso.' }, 409)
  if (codigo === 'P2003' || codigo === 'P2034') {
    return responder({ error: 'Los datos cambiaron durante la operación. Actualizá e intentá nuevamente.' }, 409)
  }
  return responder({ error: 'No se pudo completar la operación. Intentá nuevamente más tarde.' }, 500)
}

// Devuelve el nombre del rol (para saber si lleva sucursal).
async function rolActivo(tx: Prisma.TransactionClient, idRol: number) {
  const rol = await tx.rol.findUnique({ where: { idRol }, select: { nombre: true } })
  if (!rol) throw new ErrorUsuario(400, 'El rol indicado no existe.')
  return rol.nombre
}

async function sucursalActiva(tx: Prisma.TransactionClient, idSucursal: number) {
  const sucursal = await tx.sucursal.findUnique({ where: { idSucursal }, select: { activa: true } })
  if (!sucursal?.activa) throw new ErrorUsuario(400, 'La sucursal debe existir y estar activa.')
}

// Sucursal que queda guardada según el rol final. El admin trabaja con todas (la elige
// en la barra superior), así que no guarda ninguna. Supervisor y empleado necesitan una:
// la que llega o, al editar sin mandarla, la que ya tenían.
async function sucursalSegunRol(
  tx: Prisma.TransactionClient,
  nombreRol: string,
  enviada: number | null | undefined,
  actual: number | null,
) {
  if (rolSinSucursal(nombreRol)) return null
  const idSucursal = enviada === undefined ? actual : enviada
  if (idSucursal === null) throw new ErrorUsuario(400, 'Elegí la sucursal donde trabaja.')
  if (enviada !== undefined) await sucursalActiva(tx, idSucursal)
  return idSucursal
}

export function crearControladorUsuarios(db: PrismaClient, leerSesion: () => Promise<Sesion>) {
  async function proteger(
    request: Request,
    rolesPermitidos: string[],
    escritura: boolean,
    accion: (idUsuarioSesion: number) => Promise<Response>
  ) {
    try {
      // La sesión identifica al usuario; los permisos se vuelven a leer de la base.
      const sesion = await leerSesion()
      if (!sesion || !idValido(sesion.user?.idUsuario)) {
        throw new ErrorUsuario(401, 'Iniciá sesión para administrar usuarios.')
      }
      const usuario = await db.usuario.findUnique({
        where: { idUsuario: sesion.user.idUsuario },
        select: { activo: true, debeCambiarContrasena: true, rol: { select: { nombre: true } } },
      })
      if (!usuario?.activo || !rolesPermitidos.includes(usuario.rol.nombre)) {
        throw new ErrorUsuario(403, 'No tenés permiso para administrar usuarios.')
      }
      if (usuario.debeCambiarContrasena) {
        throw new ErrorUsuario(403, 'Primero tenés que cambiar tu contraseña.')
      }
      if (escritura) {
        const origen = request.headers.get('origin')
        if ((origen && origen !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ErrorUsuario(403, 'La solicitud debe realizarse desde esta aplicación.')
        }
      }
      return await accion(sesion.user.idUsuario)
    } catch (error) {
      return responderError(error)
    }
  }

  async function gestionarFoto(request: Request, id: string, borrar: boolean) {
    const idUsuario = leerId(id)
    const actual = await db.usuario.findUnique({ where: { idUsuario }, select: { fotoPerfilPath: true } })
    if (!actual) throw new ErrorUsuario(404, 'No se encontró el usuario solicitado.')
    const guardar = async (esperada: string | null, nueva: string | null) => {
      const resultado = await db.usuario.updateMany({
        where: { idUsuario, fotoPerfilPath: esperada }, data: { fotoPerfilPath: nueva },
      })
      return resultado.count === 1
    }
    if (borrar) await quitarImagen('avatares', actual.fotoPerfilPath, guardar)
    else await subirImagen(request, 'avatares', idUsuario, actual.fotoPerfilPath, guardar)
    const usuario = await db.usuario.findUniqueOrThrow({ where: { idUsuario }, select: camposUsuario })
    return responder({
      mensaje: borrar ? 'Foto de perfil eliminada.' : 'Foto de perfil guardada.',
      imagen: { ruta: usuario.fotoPerfilPath, url: urlImagenPublica(usuario.fotoPerfilPath) },
      usuario,
    })
  }

  return {
    importar: (request: Request) => proteger(request, ['admin'], true, async () => {
      try {
        const archivo = await leerImportacion(request, 'usuarios')
        async function preparar(tx: Prisma.TransactionClient) {
          const errores = [...archivo.errores]
          const [roles, sucursales] = await Promise.all([
            tx.rol.findMany({ select: { idRol: true, nombre: true } }),
            tx.sucursal.findMany({ select: { idSucursal: true, nombre: true, activa: true } }),
          ])
          const emailsArchivo = new Set<string>()
          const usuarios = archivo.filas.map(({ fila, formato, datos }) => {
            const rol = buscarPorNombre(datos.rol, roles, fila, 'Rol', errores, (r) => etiquetaRol(r.nombre))
            const sinSucursal = rol && rolSinSucursal(rol.nombre)
            const nombre = formato === 'json' && esRegistro(datos.sucursal) ? datos.sucursal.nombre : datos.sucursal
            const vacia = nombre === null || nombre === ''
            const todas = formato === 'csv' && typeof nombre === 'string' && normalizarNombre(nombre) === 'todas las sucursales'
            let idSucursal: number | null = null
            if (sinSucursal && (vacia || todas)) {
              idSucursal = null
            } else {
              const sucursal = buscarPorNombre(nombre, sucursales, fila, 'Sucursal', errores,
                formato === 'csv' ? (s) => s.nombre.replace('Prueba - ', '') : undefined)
              if (sucursal && !sucursal.activa) errores.push({ fila, campo: 'Sucursal', mensaje: 'La sucursal debe estar activa.' })
              if (sucursal && !sinSucursal) idSucursal = sucursal.idSucursal
            }
            const validado = validarCampos({
              nombre: datos.nombre, apellido: datos.apellido, email: datos.email,
              ...(rol ? { idRol: rol.idRol } : {}), idSucursal,
              activo: estadoImportado(datos.activo, formato),
            }, validarUsuario, {
              nombre: 'Nombre', apellido: 'Apellido', email: 'Email', idRol: 'Rol', idSucursal: 'Sucursal', activo: 'Estado',
            }, fila, errores)
            if (validado.email) {
              if (emailsArchivo.has(validado.email)) errores.push({ fila, campo: 'Email', mensaje: 'El email se repite dentro del archivo.' })
              emailsArchivo.add(validado.email)
            }
            return { fila, datos: validado }
          })
          const existentes = emailsArchivo.size ? await tx.usuario.findMany({
            where: { OR: [...emailsArchivo].map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })) },
            select: { email: true },
          }) : []
          const emailsExistentes = new Set(existentes.map((u) => u.email.toLowerCase()))
          for (const { fila, datos } of usuarios) {
            if (datos.email && emailsExistentes.has(datos.email)) errores.push({ fila, campo: 'Email', mensaje: 'El email ya existe en la base de datos.' })
          }
          verificarErrores(errores)
          return usuarios
        }

        const usuarios = await preparar(db)
        // El hash se calcula fuera de la transacción, con concurrencia limitada.
        // Cada cuenta tiene una contraseña diferente que nunca sale de este método.
        const hashes: string[] = []
        for (let i = 0; i < usuarios.length; i += 4) {
          hashes.push(...await Promise.all(usuarios.slice(i, i + 4).map(() => bcrypt.hash(generarPasswordAleatoria(), 10))))
        }
        const creados = await db.$transaction(async (tx) => {
          // Revalidar evita guardar con referencias o emails que cambiaron mientras
          // calculábamos los hashes. Todos los registros se guardan juntos.
          const confirmados = await preparar(tx)
          const resultado = await tx.usuario.createMany({
            data: confirmados.map(({ datos }, indice) => {
              const { activo, ...alta } = datos
              const validado = validarUsuario(alta, false)
              return {
                nombre: validado.nombre!, apellido: validado.apellido!, email: validado.email!,
                idRol: validado.idRol!, idSucursal: validado.idSucursal ?? null, activo,
                passwordHash: hashes[indice], debeCambiarContrasena: true,
              }
            }),
          })
          return resultado.count
        }, { isolationLevel: 'Serializable', timeout: 60000 })
        return responder({ creados }, 201)
      } catch (error) {
        return responderErrorImportacion(error)
      }
    }),


    // Ver el listado: solo admin.
    listar: (request: Request) => proteger(request, ['admin'], false, async (idUsuarioSesion) => {
      const parametros = new URL(request.url).searchParams
      if ([...parametros.keys()].some((clave) => clave !== 'estado' || parametros.getAll(clave).length > 1)) {
        throw new ErrorUsuario(400, 'Los parámetros del listado no son válidos.')
      }
      const estado = parametros.get('estado') ?? 'activos'
      if (!['activos', 'archivados'].includes(estado)) {
        throw new ErrorUsuario(400, 'El estado debe ser activos o archivados.')
      }
      const sesionCompleta = await db.usuario.findUnique({
        where: { idUsuario: idUsuarioSesion },
        select: { rol: { select: { nombre: true } } },
      })
      const [usuarios, roles, sucursales] = await db.$transaction([
        db.usuario.findMany({
          where: { activo: estado === 'activos' },
          select: camposUsuario,
          orderBy: [{ nombre: 'asc' }, { idUsuario: 'asc' }],
        }),
        db.rol.findMany({ select: { idRol: true, nombre: true }, orderBy: { idRol: 'asc' } }),
        db.sucursal.findMany({
          where: { activa: true },
          select: { idSucursal: true, nombre: true },
          orderBy: [{ nombre: 'asc' }, { idSucursal: 'asc' }],
        }),
      ])
      return responder({
        usuarios, roles, sucursales,
        esAdmin: sesionCompleta?.rol.nombre === 'admin',
        idUsuarioSesion,
      })
    }),

    // Crear, editar y desactivar/activar: solo admin.
    crear: (request: Request) => proteger(request, ['admin'], true, async () => {
      const datos = validarUsuario(await leerCuerpo(request), false)
      const passwordGenerada = generarPasswordAleatoria()
      const passwordHash = await bcrypt.hash(passwordGenerada, 10)

      const usuario = await db.$transaction(async (tx) => {
        const nombreRol = await rolActivo(tx, datos.idRol!)
        const idSucursal = await sucursalSegunRol(tx, nombreRol, datos.idSucursal ?? null, null)
        return tx.usuario.create({
          data: {
            nombre: datos.nombre!,
            apellido: datos.apellido!,
            email: datos.email!,
            passwordHash,
            idRol: datos.idRol!,
            idSucursal,
            debeCambiarContrasena: true,
          },
          select: camposUsuario,
        })
      }, { isolationLevel: 'Serializable' })

      return responder({ usuario, passwordGenerada }, 201)
    }),

    editar: (request: Request, id: string) => proteger(request, ['admin'], true, async () => {
      const idUsuario = leerId(id)
      const datos = validarUsuario(await leerCuerpo(request), true)

      const usuario = await db.$transaction(async (tx) => {
        const actual = await tx.usuario.findUnique({
          where: { idUsuario },
          select: { idSucursal: true, rol: { select: { nombre: true } } },
        })
        if (!actual) throw new ErrorUsuario(404, 'Usuario no encontrado.')
        const nombreRol = datos.idRol !== undefined ? await rolActivo(tx, datos.idRol) : actual.rol.nombre
        const idSucursal = await sucursalSegunRol(tx, nombreRol, datos.idSucursal, actual.idSucursal)
        return tx.usuario.update({ where: { idUsuario }, data: { ...datos, idSucursal }, select: camposUsuario })
      }, { isolationLevel: 'Serializable' })

      return responder({ usuario })
    }),

    desactivar: (request: Request, id: string) => proteger(request, ['admin'], true, async (idUsuarioSesion) => {
      const idUsuario = leerId(id)
      if (idUsuario === idUsuarioSesion) {
        throw new ErrorUsuario(400, 'No podés desactivar tu propio usuario.')
      }
      // No borramos el registro: sigue disponible para el historial de pedidos.
      const usuario = await db.usuario.update({
        where: { idUsuario }, data: { activo: false }, select: camposUsuario,
      })
      return responder({ mensaje: 'Usuario desactivado.', usuario })
    }),

    activar: (request: Request, id: string) => proteger(request, ['admin'], true, async () => {
      const usuario = await db.usuario.update({
        where: { idUsuario: leerId(id) }, data: { activo: true }, select: camposUsuario,
      })
      return responder({ mensaje: 'Usuario activado.', usuario })
    }),

    // Restablecer la contraseña de otro usuario: solo admin.
    restablecerContrasena: (request: Request, id: string) => proteger(request, ['admin'], true, async (idUsuarioSesion) => {
      const idUsuario = leerId(id)
      if (idUsuario === idUsuarioSesion) {
        throw new ErrorUsuario(400, 'No podés restablecer tu propia contraseña. Usá la opción de cambiar contraseña.')
      }
      const passwordGenerada = generarPasswordAleatoria()
      const passwordHash = await bcrypt.hash(passwordGenerada, 10)
      // Los enlaces de recupero pendientes se firman con el passwordHash anterior
      // (ver api/auth/recuperar-contrasena), así que al cambiarlo dejan de ser válidos.
      const usuario = await db.usuario.update({
        where: { idUsuario },
        data: { passwordHash, debeCambiarContrasena: true },
        select: camposUsuario,
      })
      return responder({ mensaje: 'Contraseña restablecida.', usuario, passwordGenerada })
    }),

    // Administrar la foto de perfil de cualquier usuario: solo admin.
    subirFotoPerfil: (request: Request, id: string) => proteger(request, ['admin'], true, () => gestionarFoto(request, id, false)),

    quitarFotoPerfil: (request: Request, id: string) => proteger(request, ['admin'], true, () => gestionarFoto(request, id, true)),
  }
}
