import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Comprueba la estructura y los datos necesarios sin escribir en la base.
  if (process.argv.includes('--check')) {
    const [usuario, usernameOcupado] = await Promise.all([
      prisma.usuario.findUnique({
        where: { email: 'admin@burguer.com' },
        include: { rol: true },
      }),
      prisma.usuario.findUnique({
        where: { username: 'admin' },
        select: { email: true },
      }),
    ])
    await prisma.rol.count()
    await prisma.categoria.count()
    await prisma.sucursal.findFirst()
    await prisma.producto.findFirst({ include: { sucursales: true } })
    if (!usuario && usernameOcupado) {
      throw new Error('El nombre admin ya pertenece a otro email. Revisá el seed antes de cargarlo.')
    }
    console.log('Conexión y consultas del seed: correctas.')
    console.log(usuario
      ? 'El usuario inicial ya existe; se conservarán sus datos y contraseña.'
      : 'El usuario inicial todavía no existe; se creará al ejecutar db:seed.')
    return
  }

  // Si algo falla, se deshace la carga completa para no dejar datos a medias.
  const sucursales = await prisma.$transaction(async (tx) => {
    // Roles
    const admin = await tx.rol.upsert({
      where: { nombre: 'admin' },
      update: {},
      create: { nombre: 'admin' },
    })
    await tx.rol.upsert({
      where: { nombre: 'supervisor' },
      update: {},
      create: { nombre: 'supervisor' },
    })
    await tx.rol.upsert({
      where: { nombre: 'empleado' },
      update: {},
      create: { nombre: 'empleado' },
    })

    // Usuario admin inicial
    const passwordHash = await bcrypt.hash('asd123', 10)
    await tx.usuario.upsert({
      where: { email: 'admin@burguer.com' },
      update: {},
      create: {
        nombre: 'Alex',
        apellido: 'Chocala',
        email: 'admin@burguer.com',
        username: 'admin',
        passwordHash,
        idRol: admin.idRol,
        debeCambiarContrasena: true,
      },
    })

    // Conservamos las categorías y datos existentes.
    const bebidas = await tx.categoria.upsert({
      where: { nombre: 'Bebidas' },
      update: {},
      create: { nombre: 'Bebidas', orden: 1 },
    })
    const hamburguesas = await tx.categoria.upsert({
      where: { nombre: 'Hamburguesas' },
      update: {},
      create: { nombre: 'Hamburguesas', orden: 2 },
    })

    const oculta = await tx.categoria.upsert({
      where: { nombre: 'Prueba - Categoría inactiva' },
      update: {},
      create: { nombre: 'Prueba - Categoría inactiva', orden: 99, activa: false },
    })
    const provincia = await tx.provincia.upsert({
      where: { nombre: 'Buenos Aires' }, update: {}, create: { nombre: 'Buenos Aires' },
    })
    const sucursales = []
    for (const nombre of ['Avellaneda', 'Quilmes']) {
      const localidad = await tx.localidad.upsert({
        where: { nombre_idProvincia: { nombre, idProvincia: provincia.idProvincia } },
        update: {}, create: { nombre, idProvincia: provincia.idProvincia },
      })
      // Estos nombres identifican ejemplos; no reemplazan sucursales del negocio.
      const datos = {
        nombre: 'Prueba - ' + nombre,
        direccion: 'Dirección ficticia para pruebas',
        idLocalidad: localidad.idLocalidad,
      }
      const sucursal = await tx.sucursal.findFirst({ where: datos })
        ?? await tx.sucursal.create({ data: datos })
      sucursales.push(sucursal)
    }

    const ejemplos = [
      { nombre: 'Prueba - Bebida', precio: 1500, idCategoria: bebidas.idCategoria,
        activo: true, disponibilidad: [true, true] },
      { nombre: 'Prueba - Hamburguesa', precio: 6000, idCategoria: hamburguesas.idCategoria,
        activo: true, disponibilidad: [true, null] },
      { nombre: 'Prueba - Producto desactivado', precio: 2000, idCategoria: bebidas.idCategoria,
        activo: false, disponibilidad: [true, true] },
      { nombre: 'Prueba - Producto no disponible', precio: 2500, idCategoria: bebidas.idCategoria,
        activo: true, disponibilidad: [false, false] },
      { nombre: 'Prueba - Producto de categoría inactiva', precio: 3000, idCategoria: oculta.idCategoria,
        activo: true, disponibilidad: [true, true] },
    ]
    for (const ejemplo of ejemplos) {
      const { disponibilidad, ...datos } = ejemplo
      const descripcion = 'Dato ficticio del seed para probar la carta por sucursal.'
      const producto = await tx.producto.findFirst({ where: { nombre: datos.nombre, descripcion } })
        ?? await tx.producto.create({ data: { ...datos, descripcion } })
      for (const [indice, sucursal] of sucursales.entries()) {
        const disponible = disponibilidad[indice]
        // null significa que el producto no pertenece a esa sucursal.
        if (disponible === null) continue
        await tx.sucursalProducto.upsert({
          where: { idSucursal_idProducto: {
            idSucursal: sucursal.idSucursal, idProducto: producto.idProducto,
          } },
          update: {},
          create: { idSucursal: sucursal.idSucursal, idProducto: producto.idProducto, disponible },
        })
      }
    }
    return sucursales
  }, { isolationLevel: 'Serializable', timeout: 15000 })
  console.log('Datos iniciales y ejemplos preparados. Los registros existentes se conservaron.')
  for (const sucursal of sucursales) {
    console.log(sucursal.nombre + ': /api/productos?idSucursal=' + sucursal.idSucursal)
  }
}

main()
  .catch((error: unknown) => {
    // Mostramos solo el código del fallo, sin datos de conexión.
    const codigo = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'SIN_CODIGO'
    console.error('No se pudo completar el seed. Código:', codigo)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
