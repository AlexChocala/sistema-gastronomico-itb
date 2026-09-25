import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Comprueba la estructura y los datos necesarios sin escribir en la base.
  if (process.argv.includes('--check')) {
    const usuario = await prisma.usuario.findUnique({
      where: { email: 'admin@burguer.com' },
      include: { rol: true },
    })
    await prisma.rol.count()
    await prisma.categoria.count()
    await prisma.sucursal.findFirst()
    await prisma.producto.findFirst({ include: { sucursales: true } })
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
    const supervisor = await tx.rol.upsert({
      where: { nombre: 'supervisor' },
      update: {},
      create: { nombre: 'supervisor' },
    })
    const empleado = await tx.rol.upsert({
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
    const pizzas = await tx.categoria.upsert({
      where: { nombre: 'Pizzas' },
      update: {},
      create: { nombre: 'Pizzas', orden: 3 },
    })
    const empanadas = await tx.categoria.upsert({
      where: { nombre: 'Empanadas' },
      update: {},
      create: { nombre: 'Empanadas', orden: 4 },
    })
    const platos = await tx.categoria.upsert({
      where: { nombre: 'Platos' },
      update: {},
      create: { nombre: 'Platos', orden: 5 },
    })
    const postres = await tx.categoria.upsert({
      where: { nombre: 'Postres' },
      update: {},
      create: { nombre: 'Postres', orden: 6 },
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

    // Usuarios de ejemplo para el panel de Usuarios (contraseña fija para todos: "prueba123")
    const passwordEjemplos = await bcrypt.hash('prueba123', 10)
    const usuariosEjemplo = [
      { nombre: 'Esteban', apellido: 'Car', email: 'esteban.car@ejemplo.com', idRol: supervisor.idRol },
      { nombre: 'Carlos', apellido: 'Trip', email: 'carlos.trip@ejemplo.com', idRol: admin.idRol },
      { nombre: 'Santiago', apellido: 'Carles', email: 'santiago.carles@ejemplo.com', idRol: empleado.idRol },
    ]
    for (const [indice, u] of usuariosEjemplo.entries()) {
      await tx.usuario.upsert({
        where: { email: u.email },
        update: {},
        create: {
          nombre: u.nombre,
          apellido: u.apellido,
          email: u.email,
          passwordHash: passwordEjemplos,
          idRol: u.idRol,
          idSucursal: sucursales[indice % sucursales.length].idSucursal,
          debeCambiarContrasena: true,
        },
      })
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

    const productosCaja = [
      { nombre: 'Hamburguesa simple', categoria: hamburguesas, precio: 7500, disponible: true },
      { nombre: 'Hamburguesa doble completa', categoria: hamburguesas, precio: 11200, disponible: true },
      { nombre: 'Hamburguesa triple simple', categoria: hamburguesas, precio: 12900, disponible: false },
      { nombre: 'Pizza muzzarella', categoria: pizzas, precio: 9800, disponible: true },
      { nombre: 'Pizza jamón y morrón', categoria: pizzas, precio: 11500, disponible: true },
      { nombre: 'Pizza fugazzeta', categoria: pizzas, precio: 10900, disponible: true },
      { nombre: 'Empanada de carne', categoria: empanadas, precio: 1600, disponible: true },
      { nombre: 'Empanada de jamón y queso', categoria: empanadas, precio: 1600, disponible: false },
      { nombre: 'Milanesa napolitana con papas', categoria: platos, precio: 13500, disponible: true },
      { nombre: 'Ensalada César', categoria: platos, precio: 8200, disponible: true },
      { nombre: 'Coca-Cola 500 ml', categoria: bebidas, precio: 2500, disponible: true },
      { nombre: 'Agua sin gas 500 ml', categoria: bebidas, precio: 1800, disponible: true },
      { nombre: 'Flan con dulce de leche', categoria: postres, precio: 4200, disponible: true },
      { nombre: 'Helado 2 gustos', categoria: postres, precio: 3900, disponible: false },
    ]
    for (const datos of productosCaja) {
      const producto = await tx.producto.findFirst({
        where: { nombre: datos.nombre, idCategoria: datos.categoria.idCategoria },
      }) ?? await tx.producto.create({
        data: {
          nombre: datos.nombre,
          descripcion: 'Producto de ejemplo para la pantalla de Caja.',
          precio: datos.precio,
          idCategoria: datos.categoria.idCategoria,
        },
      })
      for (const sucursal of sucursales) {
        await tx.sucursalProducto.upsert({
          where: { idSucursal_idProducto: {
            idSucursal: sucursal.idSucursal,
            idProducto: producto.idProducto,
          } },
          update: {},
          create: {
            idSucursal: sucursal.idSucursal,
            idProducto: producto.idProducto,
            disponible: datos.disponible,
          },
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
