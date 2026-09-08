import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Roles
  const admin = await prisma.rol.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: { nombre: 'admin' },
  })
  await prisma.rol.upsert({
    where: { nombre: 'supervisor' },
    update: {},
    create: { nombre: 'supervisor' },
  })
  await prisma.rol.upsert({
    where: { nombre: 'empleado' },
    update: {},
    create: { nombre: 'empleado' },
  })

  // Usuario admin inicial
  const passwordHash = await bcrypt.hash('asd123', 10)
  await prisma.usuario.upsert({
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

  // Categorías y productos de ejemplo
  const bebidas = await prisma.categoria.upsert({
    where: { nombre: 'Bebidas' },
    update: {},
    create: { nombre: 'Bebidas', orden: 1 },
  })
  const hamburguesas = await prisma.categoria.upsert({
    where: { nombre: 'Hamburguesas' },
    update: {},
    create: { nombre: 'Hamburguesas', orden: 2 },
  })

  console.log('Datos de ejemplo cargados correctamente')
}

main()