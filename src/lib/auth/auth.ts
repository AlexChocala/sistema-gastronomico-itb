// Configuración central de NextAuth (v4, estable: la npm-latest 4.24.15 declara soporte
// peer explícito para Next 16; la v5/Auth.js sigue en beta). Define cómo se autentica un
// usuario (Credentials Provider: email + password contra la base) y qué datos viajan en
// la sesión.

import type { AuthOptions, DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/db/prisma'
import type { RolNombre } from '@/types'
import {
  MAX_INTENTOS_FALLIDOS, MINUTOS_BLOQUEO, estaBloqueado, limpiarIntentos, normalizarEmail, registrarFallo,
} from './limite-intentos'

// Mensaje del error que lanza `authorize` cuando el email está bloqueado: llega al
// formulario de login como `resultado.error`.
export const ERROR_DEMASIADOS_INTENTOS = 'DEMASIADOS_INTENTOS'

export const authOptions: AuthOptions = {
  // No hay modelos Session/Account en el schema, así que la sesión se guarda en un
  // JWT firmado dentro de una cookie, no en la base de datos.
  session: {
    strategy: 'jwt',
  },

  pages: {
    // Página propia de login en vez de la pantalla por defecto de NextAuth.
    signIn: '/acceso/login',
  },

  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Tras varios intentos fallidos con el mismo email se bloquea un rato (el login
        // muestra un mensaje propio al recibir este error).
        const claveIntentos = normalizarEmail(credentials.email)
        if (estaBloqueado(claveIntentos)) {
          throw new Error(ERROR_DEMASIADOS_INTENTOS)
        }

        // Usuario.rol es una relación a la tabla Rol, no un string directo: hace falta
        // el include para poder armar el campo `rol` (nombre) que usa el resto de la app.
        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          include: { rol: true },
        })

        // También se cuentan los emails que no existen (en memoria), para no revelar cuáles sí.
        if (!usuario || !usuario.activo) {
          registrarFallo(claveIntentos)
          return null
        }

        // Para un usuario real el bloqueo está en la base: vale en todas las instancias.
        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
          throw new Error(ERROR_DEMASIADOS_INTENTOS)
        }

        const passwordValida = await bcrypt.compare(credentials.password, usuario.passwordHash)
        if (!passwordValida) {
          registrarFallo(claveIntentos)
          const { intentosFallidos } = await prisma.usuario.update({
            where: { idUsuario: usuario.idUsuario },
            data: { intentosFallidos: { increment: 1 } },
            select: { intentosFallidos: true },
          })
          if (intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
            await prisma.usuario.update({
              where: { idUsuario: usuario.idUsuario },
              data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000) },
            })
          }
          return null
        }
        limpiarIntentos(claveIntentos)
        if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
          await prisma.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
        }

        // Lo que se retorna acá es lo que NextAuth pasa como `user` al callback `jwt`.
        return {
          id: String(usuario.idUsuario),
          name: `${usuario.nombre} ${usuario.apellido}`,
          email: usuario.email,
          idRol: usuario.idRol,
          rol: usuario.rol.nombre as RolNombre,
          idSucursal: usuario.idSucursal,
          debeCambiarContrasena: usuario.debeCambiarContrasena,
        }
      },
    }),
  ],

  callbacks: {
    // Se ejecuta cada vez que se crea o actualiza el JWT. `user` solo está disponible
    // en el login (viene de `authorize`); en los llamados siguientes solo hay `token`.
    async jwt({ token, user }) {
      if (user) {
        token.idUsuario = Number(user.id)
        token.idRol = user.idRol
        token.rol = user.rol
        token.idSucursal = user.idSucursal
        token.debeCambiarContrasena = user.debeCambiarContrasena
      }
      return token
    },

    // Se ejecuta cada vez que se lee la sesión (useSession, getSession, getServerSession).
    // Copiamos los datos del token a `session.user` para que estén disponibles en la app.
    async session({ session, token }) {
      session.user.idUsuario = token.idUsuario
      session.user.idRol = token.idRol
      session.user.rol = token.rol
      session.user.idSucursal = token.idSucursal
      session.user.debeCambiarContrasena = token.debeCambiarContrasena
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}

// Ampliamos los tipos de NextAuth para que `session.user`, `user` y el `token` conozcan
// los campos propios del negocio (idRol, rol, idSucursal, debeCambiarContrasena).
// Al no crear un archivo .d.ts aparte (no está en la lista de archivos permitidos),
// la ampliación se declara acá mismo, junto a la configuración que la usa.
declare module 'next-auth' {
  interface Session {
    user: {
      idUsuario: number
      idRol: number
      rol: RolNombre
      idSucursal: number | null
      debeCambiarContrasena: boolean
    } & DefaultSession['user']
  }

  interface User {
    idRol: number
    rol: RolNombre
    idSucursal: number | null
    debeCambiarContrasena: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    idUsuario: number
    idRol: number
    rol: RolNombre
    idSucursal: number | null
    debeCambiarContrasena: boolean
  }
}
