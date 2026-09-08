// Tipos compartidos del dominio de la aplicación.
// Se basan en los modelos de prisma/schema.prisma, pero no dependen del cliente de
// Prisma generado, para poder usarse tanto en componentes de servidor como de cliente
// (el cliente de Prisma no puede importarse en código que corre en el navegador).

// Nombres de rol reales, cargados por prisma/seed.ts. Al no haber un enum en el schema
// (Rol.nombre es un string con @unique), este tipo documenta los valores válidos que
// usa la aplicación.
export type RolNombre = 'admin' | 'supervisor' | 'empleado'

export interface Usuario {
  idUsuario: number
  nombre: string
  apellido: string
  email: string
  username: string
  debeCambiarContrasena: boolean
  activo: boolean
  idRol: number
  // Nombre del rol (no el objeto de relación completo de Prisma). Se resuelve con un
  // include: { rol: true } en la consulta y sirve para chequear permisos por nombre
  // ('admin', 'supervisor') en vez de por idRol, sin depender del orden en que se
  // hayan creado los roles en la base.
  rol: RolNombre
  idSucursal: number | null
}

export interface Sucursal {
  idSucursal: number
  nombre: string
  telefono: string | null
  direccion: string
  horario: string | null
  activa: boolean
  idLocalidad: number
}
