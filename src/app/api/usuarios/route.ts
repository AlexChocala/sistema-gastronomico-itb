import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

function generarPasswordAleatoria(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return password
}

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    select: {
      idUsuario: true,
      nombre: true,
      apellido: true,
      email: true,
      username: true,
      activo: true,
      idRol: true,
      rol: true,
      idSucursal: true,
      sucursal: true,
    },
  })

  return NextResponse.json(usuarios)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { nombre, apellido, email, username, idRol, idSucursal } = body

  if (!nombre || !apellido || !email || !username || !idRol) {
    return NextResponse.json(
      { error: 'Faltan datos obligatorios (nombre, apellido, email, username, idRol)' },
      { status: 400 }
    )
  }

  const passwordGenerada = generarPasswordAleatoria()
  const passwordHash = await bcrypt.hash(passwordGenerada, 10)

  try {
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        apellido,
        email,
        username,
        passwordHash,
        idRol,
        idSucursal: idSucursal ?? null,
      },
    })

    return NextResponse.json({
      usuario: {
        idUsuario: nuevoUsuario.idUsuario,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
        email: nuevoUsuario.email,
        username: nuevoUsuario.username,
      },
      passwordGenerada,
    })
  } catch (error: any) {
    console.error(error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'El email o username ya está en uso' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 })
  }
}