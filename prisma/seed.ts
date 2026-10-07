import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Seed mínimo: deja el sistema como lo recibe un cliente nuevo. Solo roles, tipos de
// entrega y un admin, sin negocio ni sucursales, para que el primer ingreso pase por la pre-configuración.

async function main() {
  // Comprueba la estructura y los datos necesarios sin escribir en la base.
  if (process.argv.includes('--check')) {
    const usuario = await prisma.usuario.findUnique({
      where: { email: 'admin@burguer.com' },
      include: { rol: true },
    })
    await prisma.rol.count()
    await prisma.negocio.findFirst()
    console.log('Conexión y consultas del seed: correctas.')
    console.log(usuario
      ? 'El usuario inicial ya existe; se conservarán sus datos y contraseña.'
      : 'El usuario inicial todavía no existe; se creará al ejecutar db:seed.')
    return
  }

  // Si algo falla, se deshace la carga completa para no dejar datos a medias.
  await prisma.$transaction(async (tx) => {
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

    // Tipos de entrega: los usa el pedido online (lib/pedidos/pedidos-online.ts) buscándolos por nombre.
    for (const nombre of ['retiro', 'delivery']) {
      await tx.tipoEntrega.upsert({ where: { nombre }, update: {}, create: { nombre } })
    }

    // Usuario admin inicial: debe cambiar la contraseña en el primer ingreso.
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
  }, { isolationLevel: 'Serializable', timeout: 15000 })
  console.log('Roles, tipos de entrega y usuario admin preparados. Los registros existentes se conservaron.')
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
