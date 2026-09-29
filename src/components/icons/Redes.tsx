// Íconos de redes sociales para el menú digital. lucide-react no trae logos de marcas,
// así que se dibujan acá con el mismo estilo (trazo, currentColor). Son decorativos: el
// texto accesible lo pone el link o botón que los contiene.

import type { SVGProps } from 'react'

type PropsIcono = SVGProps<SVGSVGElement>

const base = { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, focusable: false } as const

export function IconoInstagram(props: PropsIcono) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconoTikTok(props: PropsIcono) {
  return (
    <svg {...base} {...props}>
      <path
        d="M16 3v10.5a3.5 3.5 0 1 1-3-3.46V7a6.5 6.5 0 1 0 6.5 6.5V9.8a6.3 6.3 0 0 0 3.5 1.06V7.9A4.3 4.3 0 0 1 19 7.5c-1.3-.7-2-1.9-2-3.5h-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconoFacebook(props: PropsIcono) {
  return (
    <svg {...base} {...props}>
      <path
        d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5h2.6l.6-3.5h-3.2V9a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconoWhatsapp(props: PropsIcono) {
  return (
    <svg {...base} {...props}>
      <path
        d="M4 20l1.2-3.9A8 8 0 1 1 8 18.9L4 20Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.6c.2-.4.5-.4.8-.4h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .5-.1.6l-.4.5c.5 1 1.3 1.8 2.3 2.3l.5-.4c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.4c0 .3-.1.6-.4.8-.5.4-1.3.6-2.1.3a8 8 0 0 1-4.3-4.3c-.3-.8-.1-1.6.3-2.1Z"
        fill="currentColor"
      />
    </svg>
  )
}
