// Envío de emails del sistema con Nodemailer y Gmail (contraseña de aplicación).
// No usa Prisma ni rutas: funciona igual en local, con Supabase y en Vercel.

import nodemailer from 'nodemailer'

// El transporter se crea una sola vez y se reutiliza en cada envío.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const texto = [
    'Recibimos un pedido para restablecer tu contraseña.',
    '',
    'Abrí este link para elegir una nueva:',
    resetLink,
    '',
    'Este link vence en 30 minutos.',
    'Si no pediste este cambio, ignorá este mail.',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1c1917;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">Restablecer contraseña</h2>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5;">
        Recibimos un pedido para restablecer tu contraseña. Tocá el botón para elegir una nueva.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${resetLink}"
          style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 15px;">
          Restablecer contraseña
        </a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #57534e;">Si el botón no funciona, copiá y pegá este link en el navegador:</p>
      <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all;">${resetLink}</p>
      <p style="margin: 0 0 4px; font-size: 13px; color: #57534e;">Este link vence en 30 minutos.</p>
      <p style="margin: 0; font-size: 13px; color: #57534e;">Si no pediste este cambio, ignorá este mail.</p>
    </div>
  `

  await transporter.sendMail({
    from: `"Sistema Gastronómico" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Restablecer contraseña - Sistema Gastronómico',
    text: texto,
    html,
  })
}