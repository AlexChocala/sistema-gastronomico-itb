// Compartido por el servidor, el navegador y el script que evita un destello claro al cargar.
export type Tema = 'claro' | 'oscuro'
export type AmbitoTema = 'personal' | 'cliente'

export const CLAVES_TEMA: Record<AmbitoTema, string> = {
  personal: 'mise:tema:personal',
  cliente: 'mise:tema:cliente',
}

const RUTAS_PERSONAL = [
  '/dashboard', '/pedidos', '/productos', '/usuarios', '/sucursales', '/reportes',
  '/perfil', '/configuracion', '/configuracion-inicial', '/acceso', '/pantallas',
]

export function esTema(valor: unknown): valor is Tema {
  return valor === 'claro' || valor === 'oscuro'
}

export function normalizarTema(valor: unknown): Tema {
  return esTema(valor) ? valor : 'claro'
}

export function ambitoParaRuta(ruta: string): AmbitoTema {
  return RUTAS_PERSONAL.some(base => ruta === base || ruta.startsWith(base + '/')) ? 'personal' : 'cliente'
}

// Solo contiene constantes propias, nunca texto del usuario. Corre en <head> antes
// de pintar: cada ámbito recupera su propia preferencia, incluso al recargar.
export const SCRIPT_TEMA_INICIAL = `(()=>{const rutas=${JSON.stringify(RUTAS_PERSONAL)};const ruta=location.pathname;const ambito=rutas.some(base=>ruta===base||ruta.startsWith(base+'/'))?'personal':'cliente';const claves=${JSON.stringify(CLAVES_TEMA)};let tema='claro';try{if(localStorage.getItem(claves[ambito])==='oscuro')tema='oscuro'}catch{}document.documentElement.dataset.tema=tema;document.documentElement.dataset.ambitoTema=ambito})()`
