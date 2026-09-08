// Conecta la configuración de lib/auth.ts con el sistema de rutas de Next.js.
// NextAuth necesita responder tanto a GET (por ejemplo, para pedir la sesión actual)
// como a POST (para login/logout); el mismo handler sirve para los dos verbos.

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
