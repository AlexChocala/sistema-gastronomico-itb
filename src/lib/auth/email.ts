// TODO: reemplazar por un servicio real de email (ej: Resend, Nodemailer) cuando el equipo decida cuál usar.
// Por ahora, en vez de enviar un email de verdad, imprimimos el link de recupero en la
// consola del servidor. Esto permite probar el flujo completo (pedir recupero, recibir
// el link, resetear la contraseña) sin depender de ningún proveedor externo todavía.

export function enviarEmailRecupero(email: string, link: string) {
  console.log('\n📧 Email de recupero de contraseña')
  console.log(`   Para: ${email}`)
  console.log(`   Link: ${link}\n`)
}
