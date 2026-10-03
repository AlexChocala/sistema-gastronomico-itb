// Nombre de cada rol para mostrar en pantalla. En la base y en el código el rol sigue
// siendo un código ('admin', 'supervisor', 'empleado'): los permisos se comparan contra
// ese código, así que cambiar cómo se ve nunca toca permisos.

const ETIQUETAS_ROL: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  empleado: 'Empleado',
}

// Un rol desconocido se muestra tal cual, con la primera letra en mayúscula.
export function etiquetaRol(nombre: string) {
  return ETIQUETAS_ROL[nombre] ?? nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

// El admin trabaja con todas las sucursales (elige cuál desde la barra superior): no
// tiene una asignada. Supervisor y empleado sí, siempre una.
export function rolSinSucursal(nombre: string) {
  return nombre === 'admin'
}
