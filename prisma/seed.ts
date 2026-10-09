import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

// Seed mínimo: deja el sistema como lo recibe un cliente nuevo. Solo roles, tipos de
// entrega y un admin, sin negocio ni sucursales, para que el primer ingreso pase por la pre-configuración.
//
// El email y la contraseña del admin inicial se leen de SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD
// (nunca escritos en el código). La conexión usa DIRECT_URL (Session pooler de Supabase, puerto 5432);
// si no existe, usa DATABASE_URL (base local).

const esCheck = process.argv.includes('--check')

const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim() ?? ''
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? ''
const urlConexion = process.env.DIRECT_URL ?? process.env.DATABASE_URL

// Antes de conectarse: si falta algo, se corta sin crear nada.
const faltantes: string[] = []
if (!urlConexion) faltantes.push('DIRECT_URL (o DATABASE_URL)')
if (!adminEmail) faltantes.push('SEED_ADMIN_EMAIL')
if (!adminPassword) faltantes.push('SEED_ADMIN_PASSWORD')

if (faltantes.length > 0) {
  console.error(`No se puede ejecutar el seed: faltan variables en el .env: ${faltantes.join(', ')}.`)
  console.error('No se creó ni modificó nada.')
  process.exit(1)
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  console.error('No se puede ejecutar el seed: SEED_ADMIN_EMAIL no es un email válido. No se creó nada.')
  process.exit(1)
}
if (adminPassword.length < 6) {
  console.error('No se puede ejecutar el seed: SEED_ADMIN_PASSWORD debe tener al menos 6 caracteres. No se creó nada.')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: urlConexion })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Comprueba la estructura y los datos necesarios sin escribir en la base.
  if (esCheck) {
    const usuario = await prisma.usuario.findUnique({
      where: { email: adminEmail },
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
    // Si ya existe, no se toca (ni su contraseña).
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    await tx.usuario.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        nombre: 'Alex',
        apellido: 'Chocala',
        email: adminEmail,
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