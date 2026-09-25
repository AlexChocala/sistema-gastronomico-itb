// Recibe el token de recupero por query string (?token=...) y lo valida ACÁ, del lado
// del servidor, antes de mostrar nada — así evitamos que alguien escriba una contraseña
// nueva para descubrir recién al final que el link ya no sirve. searchParams es una
// Promise desde Next.js 15+, por eso la página es async
// (node_modules/next/dist/docs/.../page.md).
//
// Esta validación es solo para la UX (decide qué mostrar). La que de verdad protege el
// cambio de contraseña sigue siendo la de POST /api/auth/restablecer-contrasena: el token
// igual se puede vencer o invalidar en el rato entre que se carga esta página y se
// aprieta "Guardar" (por ejemplo, si se pide otro link de recupero en el medio), así
// que el submit vuelve a llamar a verificarTokenReset por su cuenta.

import Link from 'next/link'
import { claseBotonAcento, TarjetaAcceso } from '@/components/acceso/ElementosAcceso'
import { RestablecerContrasenaForm } from '@/components/forms/RestablecerContrasenaForm'
import { TriangleAlert } from '@/components/icons'
import { verificarTokenReset } from '@/app/api/auth/recuperar-contrasena/route'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  const idUsuario = token ? await verificarTokenReset(token) : null

  if (!idUsuario) {
    return (
      <TarjetaAcceso
        icono={TriangleAlert}
        tono="peligro"
        titulo="El link es inválido o expiró"
        descripcion="Los links de recupero se pueden usar una sola vez y vencen después de un tiempo. Pedí uno nuevo."
      >
        <Link href="/acceso/recuperar-contrasena" className={claseBotonAcento}>
          Pedir un nuevo link
        </Link>
      </TarjetaAcceso>
    )
  }

  return <RestablecerContrasenaForm token={token!} />
}
