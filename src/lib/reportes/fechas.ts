// Atajos de fecha de Reportes. Las fechas son días de calendario en hora de Argentina
// ('AAAA-MM-DD'), como las espera GET /api/reportes.

export type Atajo = 'hoy' | 'semana' | 'mes'

const DIA_MS = 24 * 60 * 60 * 1000

// 'en-CA' formatea como AAAA-MM-DD.
const formatoArgentina = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

export function hoyEnArgentina() {
  return formatoArgentina.format(new Date())
}

// Desde el primer día del período hasta hoy. La semana empieza el lunes.
export function fechasDelAtajo(atajo: Atajo) {
  const hoy = hoyEnArgentina()
  if (atajo === 'mes') return { desde: hoy.slice(0, 8) + '01', hasta: hoy }
  if (atajo === 'semana') {
    const fecha = new Date(hoy + 'T00:00:00Z')
    const lunes = new Date(fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * DIA_MS)
    return { desde: lunes.toISOString().slice(0, 10), hasta: hoy }
  }
  return { desde: hoy, hasta: hoy }
}
