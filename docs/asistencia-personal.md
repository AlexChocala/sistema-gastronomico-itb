# Asistencia del personal

El administrador puede abrir el nombre de un usuario en **Usuarios** y configurar sus días de trabajo, entrada, salida y tolerancia (10 minutos sugeridos). El supervisor tiene **Personal → Usuarios**, limitado a su sucursal. Cada persona tiene **Mi asistencia** en su menú y perfil, además de **Iniciar turno / Finalizar turno** en el dashboard.

La entrada y salida se marcan expresamente: iniciar sesión o cerrar el navegador no registra ni finaliza una jornada. Las marcas usan la hora del servidor y se muestran en hora de Argentina. Solo se puede marcar la propia asistencia.

## Historial y reglas

- Se muestran horario asignado, entrada, salida, tiempo trabajado, puntualidad y cumplimiento, con filtros de fechas (últimos 30 días por defecto; hasta 366 días).
- Un horario por día, con turnos de menos de 24 horas. Si la salida es menor que la entrada, termina al día siguiente. No se admiten horarios superpuestos.
- Una jornada registrada por usuario y fecha de inicio. No se permite abrir dos turnos ni reabrir una jornada finalizada. Un turno abierto debe finalizarse antes de iniciar otro.
- La tolerancia solo determina puntualidad; no reduce la duración prevista. Ejemplo: 09:00–17:00, entrada 09:05 y salida 17:00 resulta puntual pero con tiempo incompleto; salida 17:05 completa la duración. Llegar tarde y compensar los minutos conserva la etiqueta de llegada tarde.
- Finalizar antes de la salida prevista se informa como salida anticipada. No hay cierre automático al salir de la aplicación.
- Cada marca conserva su horario, tolerancia y sucursal originales aunque después se edite la configuración.
- Admin consulta todo; supervisor, personal y registros de su sucursal; empleado, solo lo propio. Los usuarios archivados conservan su historial.
- No se generan ausencias automáticamente. No incluye pausas, liquidación salarial, correcciones manuales ni auditoría de inicio de sesión.

## Supabase

Migración `20261023180000_asistencia_personal` **aplicada en Supabase el 23/10/2026 con autorización del responsable**. Se verificaron las tablas, RLS, índices, claves foráneas y las consultas desde el cliente Prisma.

Se crearon dos tablas, sin insertar registros de prueba:

- `HorarioUsuario`: días, horas y tolerancia por usuario.
- `AsistenciaUsuario`: marcas de entrada/salida y copia del horario y sucursal correspondientes a esa jornada.

Incluye claves foráneas, validaciones, un horario por día, una asistencia por jornada y un índice que impide turnos abiertos duplicados. RLS habilitado sin políticas públicas: el acceso se realiza desde el servidor con Prisma y permisos de la aplicación. No elimina datos ni modifica pedidos, productos o usuarios existentes. Los horarios deben asignarse desde la aplicación.

No ejecutar `migrate dev`, `migrate reset`, `db push` ni el seed contra Supabase. Antes de desplegar, revisar las migraciones pendientes; el responsable aplica la migración aprobada con `prisma migrate deploy`. Cada integrante actualiza su cliente local con `npx prisma generate` después de traer el código.

## API

- `GET /api/asistencia`: ficha propia. Filtros opcionales `desde` / `hasta` (`YYYY-MM-DD`).
- `POST /api/asistencia`: JSON `{ "accion": "iniciar" }` o `{ "accion": "finalizar" }`. No recibe usuario ni hora del navegador.
- `GET /api/asistencia/usuarios`: listado permitido al admin/supervisor.
- `GET /api/asistencia/usuarios/[id]`: ficha autorizada del usuario.
- `PUT /api/asistencia/usuarios/[id]`: solo admin. JSON con `horario` (arreglo de `diaSemana`, `entrada`, `salida`, `toleranciaMinutos`) y `versionHorario` obtenida del GET; devuelve 409 si otro administrador cambió el horario.

Errores: 400 datos inválidos; 401 sin sesión; 403 sin permiso; 404 usuario fuera del alcance; 409 conflicto de jornada/versión; 415 formato incorrecto; 503 migración pendiente.

## Verificación

Verificación realizada: esquema Prisma válido; TypeScript y ESLint sin errores; 38 pruebas de asistencia/tema/permisos aprobadas; componentes probados en navegador aislado con datos simulados, modo claro/oscuro y móvil sin desbordes.

Pruebas de asistencia: `node --import tsx --test tests/asistencia.test.ts` (reglas y controlador con base simulada, sin tocar Supabase).

Después de aplicar la migración: asignar un horario a una cuenta de prueba, iniciar turno desde esa cuenta, consultar el historial como admin/supervisor autorizado y finalizar. Verificar llegada tarde, salida anticipada, turno nocturno, conservación del historial al cambiar horarios y rechazo de accesos a otra sucursal. Probar en tema claro/oscuro y pantalla móvil.
