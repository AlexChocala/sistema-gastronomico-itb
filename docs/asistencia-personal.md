# Asistencia del personal

El administrador puede usar el botón **Ver historial** de la columna Acciones en **Usuarios** para consultar la asistencia y configurar días de trabajo, entrada, salida y tolerancia (10 minutos sugeridos). El supervisor tiene **Personal → Usuarios**, limitado a su sucursal, con el mismo botón para consultar horarios e historial. Los nombres ya no son enlaces. La ficha no muestra «Volver al personal». Para el administrador, la antigua lista de asistencia redirige a Usuarios, evitando duplicar el listado; el supervisor conserva su vista de Usuarios limitada a su sucursal. El botón también está disponible en cuentas archivadas. Cada persona tiene **Mi asistencia** en su menú y perfil, además de **Iniciar turno / Finalizar turno** en el dashboard.

La entrada y salida se marcan expresamente: iniciar sesión o cerrar el navegador no registra ni finaliza una jornada. Las marcas usan la hora del servidor y se muestran en hora de Argentina. Solo se puede marcar la propia asistencia.

## Historial y reglas

- Se muestran horario asignado, entrada, salida, tiempo trabajado, puntualidad y cumplimiento, con un calendario desplegable de rango (primer clic: inicio; segundo clic: fin), flechas **Anterior / Siguiente** en la misma tabla. La vista inicial permite recorrer todo el historial; un rango del calendario muestra todos los resultados de esas fechas. Se consultan 30 jornadas por página desde el servidor, ordenadas de la más reciente a la más antigua. **Puntualidad** permite elegir Puntual o Llegada tarde; **Jornada** permite Turno abierto, Jornada completa, Salida anticipada u Horas incompletas. Ambos desplegables se combinan con las fechas y filtran todos los registros antes de paginar. Cambiar cualquier filtro vuelve a la primera página. **Quitar filtro** limpia fechas y estados y vuelve a todo el historial. Los rangos pueden superar un año; cambiar las fechas o el modo vuelve a la primera página.
- Un horario por día, con turnos de menos de 24 horas. Si la salida es menor que la entrada, termina al día siguiente. No se admiten horarios superpuestos.
- Una jornada registrada por usuario y fecha de inicio. No se permite abrir dos turnos. Un turno abierto debe finalizarse antes de iniciar otro. Finalizar pide confirmación. Si se cerró por accidente, **Reanudar turno** corrige ese mismo registro, conservando la entrada, horario y sucursal originales; solo se permite dentro del horario original, en la misma sucursal activa y sin otro turno abierto. No crea una segunda asistencia ni registra una pausa. Al llegar la salida prevista, ya no se puede reanudar. La API valida la identidad de sesión y la versión de la salida para impedir que una pantalla desactualizada reabra un cierre posterior. No requiere migración.
- La tolerancia solo determina puntualidad; no reduce la duración prevista. Ejemplo: 09:00–17:00, entrada 09:05 y salida 17:00 resulta puntual pero con tiempo incompleto; salida 17:05 completa la duración. Llegar tarde y compensar los minutos conserva la etiqueta de llegada tarde.
- Finalizar antes de la salida prevista se informa como salida anticipada. No hay cierre automático al salir de la aplicación.
- Cada marca conserva su horario, tolerancia y sucursal originales aunque después se edite la configuración.
- Admin consulta todo; supervisor, personal y registros de su sucursal; empleado, solo lo propio. Los usuarios archivados conservan su historial.
- No se generan ausencias automáticamente. No incluye pausas, liquidación salarial, correcciones manuales ni auditoría de inicio de sesión.

## Turno y horario requeridos para Pantallas

Empleado y supervisor necesitan un turno abierto de su jornada y sucursal, dentro de la entrada y salida previstas. Antes de la entrada o desde la salida se apagan los accesos a Pantallas y Abrir caja, conservándolos visibles. Iniciar un turno antes de hora no permite operar antes de la entrada prevista. Un turno nocturno funciona después de medianoche hasta su salida.

Caja, Cocina y Entregas verifican el permiso al entrar por una dirección guardada y dejan de mostrar sus controles si se cierra o vence el turno. Se usan los horarios copiados al fichar, sin modificar registros históricos. La asistencia puede finalizarse desde Mi asistencia aunque ya se haya apagado el acceso a Pantallas.

GET /api/pedidos/caja informa el permiso, la hora del servidor y su vencimiento. El navegador actualiza cada 5 segundos, al recuperar el foco y al registrar asistencia en esta u otra pestaña. Un temporizador apaga el acceso al llegar la salida prevista; un error de conexión también lo bloquea.

POST /api/pedidos/caja y PATCH /api/pedidos/[id] vuelven a verificar rol, sucursal, marca y horario dentro de la transacción y antes de escribir; responden 403 con código ASISTENCIA_REQUERIDA si no hay permiso. El bloqueo compartido de la marca impide finalizarla mientras se guarda una operación. Se comprueba la hora después de esperar el bloqueo y antes de guardar datos. No hay excepción para supervisores.

El administrador conserva su vista de pedidos y sigue sin operar Pantallas. Las consultas de pedidos/dashboard y la carta de clientes mantienen su funcionamiento. El acceso al monitor de Mostrador desde el menú también se apaga; el monitor público sigue disponible para clientes. No necesita otra migración.

## Supabase

Migración `20261023180000_asistencia_personal` **aplicada en Supabase el 23/10/2026 con autorización del responsable**. Se verificaron las tablas, RLS, índices, claves foráneas y las consultas desde el cliente Prisma.

Se crearon dos tablas, sin insertar registros de prueba:

- `HorarioUsuario`: días, horas y tolerancia por usuario.
- `AsistenciaUsuario`: marcas de entrada/salida y copia del horario y sucursal correspondientes a esa jornada.

Incluye claves foráneas, validaciones, un horario por día, una asistencia por jornada y un índice que impide turnos abiertos duplicados. RLS habilitado sin políticas públicas: el acceso se realiza desde el servidor con Prisma y permisos de la aplicación. No elimina datos ni modifica pedidos, productos o usuarios existentes. Los horarios deben asignarse desde la aplicación.

No ejecutar `migrate dev`, `migrate reset`, `db push` ni el seed contra Supabase. Antes de desplegar, revisar las migraciones pendientes; el responsable aplica la migración aprobada con `prisma migrate deploy`. Cada integrante actualiza su cliente local con `npx prisma generate` después de traer el código.

## API

- `GET /api/asistencia`: ficha propia. Filtros opcionales `desde` / `hasta` (`YYYY-MM-DD`), sin límite de un año; `todo=1` consulta todo hasta hoy (sin combinar con fechas). `pagina` es un entero positivo. Se pueden combinar `puntualidad=puntual|tarde` y `jornada=en_curso|completo|salida_anticipada|incompleto` con el intervalo de fechas. Los valores inválidos o repetidos devuelven 400. Los estados se calculan al consultar usando las marcas originales, sin agregar columnas ni migraciones. Sin filtros devuelve todo el historial paginado, aunque haya registros de meses o años anteriores. La respuesta incluye `pagina`, `porPagina` (30), `totalRegistros`, `totalPaginas` y `todo`. El total y los registros respetan el mismo usuario y sucursal autorizados. Una página posterior a la última se ajusta a la última disponible. El historial completo y la vista inicial devuelven `desde: null`; `todo` indica que no hay un intervalo de fechas activo. No requiere migración adicional.
- `POST /api/asistencia`: JSON `{ "accion": "iniciar" }`, `{ "accion": "finalizar", "idAsistencia": 123 }` (identificador opcional para compatibilidad) o `{ "accion": "reanudar", "idAsistencia": 123, "salidaRegistrada": "ISO devuelto por el servidor" }`. La salida previa funciona como versión para detectar conflictos; no permite elegir la hora de una marca. Solo se modifica la asistencia propia, con la hora del servidor. El GET informa `puedeReanudarTurno` para habilitar el botón.
- `GET /api/asistencia/usuarios`: listado permitido al admin/supervisor.
- `GET /api/asistencia/usuarios/[id]`: ficha autorizada del usuario.
- `PUT /api/asistencia/usuarios/[id]`: solo admin. JSON con `horario` (arreglo de `diaSemana`, `entrada`, `salida`, `toleranciaMinutos`) y `versionHorario` obtenida del GET; devuelve 409 si otro administrador cambió el horario.

Errores: 400 datos inválidos; 401 sin sesión; 403 sin permiso; 404 usuario fuera del alcance; 409 conflicto de jornada/versión; 415 formato incorrecto; 503 migración pendiente.

## Verificación

Verificación realizada: esquema Prisma válido; TypeScript y ESLint sin errores; 38 pruebas de asistencia/tema/permisos aprobadas; componentes probados en navegador aislado con datos simulados, modo claro/oscuro y móvil sin desbordes.

Pruebas de asistencia: `node --import tsx --test tests/asistencia.test.ts` (reglas y controlador con base simulada, sin tocar Supabase).

Después de aplicar la migración: asignar un horario a una cuenta de prueba, iniciar turno desde esa cuenta, consultar el historial como admin/supervisor autorizado y finalizar. Verificar llegada tarde, salida anticipada, turno nocturno, conservación del historial al cambiar horarios y rechazo de accesos a otra sucursal. Probar en tema claro/oscuro y pantalla móvil.


### Exportar el historial

El botón **Exportar** del historial permite descargar PDF, Excel, CSV, CSV sin encabezado y JSON. Incluye todas las jornadas que coincidan con las fechas, puntualidad y jornada seleccionadas, aunque ocupen varias páginas de 30. Sin filtros descarga el historial completo de esa persona.

Las fechas y horas del PDF, Excel y CSV se muestran en hora de Argentina, con fecha completa para los turnos nocturnos. Los minutos asignados y trabajados son numéricos en Excel; un turno abierto figura como «En curso». JSON conserva los instantes ISO y la zona horaria. PDF y Excel identifican al usuario, período y filtros.

Las consultas GET `/api/asistencia/exportar` y `/api/asistencia/usuarios/[id]/exportar` reutilizan los permisos del historial: empleado propio, supervisor dentro de su sucursal y administrador con acceso al personal. La descarga usa una instantánea consistente, no altera registros ni requiere migraciones o cambios en Supabase.


### Cambios del horario sin guardar

Al editar un horario, se pide confirmación antes de abandonar la ficha mediante un enlace del sistema o cerrar sesión. Cancelar conserva el borrador y la sesión. Al recargar o cerrar la pestaña se utiliza la advertencia nativa del navegador; su texto depende del navegador. Atrás/Adelante también se protegen cuando el navegador admite cancelar la navegación con Navigation API. En navegadores antiguos, la protección de navegación interna se limita a los enlaces.

Guardar correctamente, descartar los cambios o volver a los valores originales retira la advertencia. Si el guardado falla, el borrador sigue protegido. Los filtros y la exportación del historial, los enlaces a otras pestañas y las descargas no descartan el horario ni requieren confirmación. No se agregan escrituras ni cambios en Supabase.


### Errores y recuperación

La asistencia, los horarios, el listado del personal y sus descargas distinguen conexión interrumpida, espera agotada, sesión vencida, permisos insuficientes, datos inválidos, conflicto de estado y problemas del servidor. El mensaje explica cómo continuar sin mostrar errores internos ni HTML. Los detalles de validación del servidor se mantienen para poder corregir los datos.

Si no llega una confirmación de guardado o de entrada/salida, se indica actualizar la ficha para comprobar el resultado antes de repetir la operación. No se reenvían escrituras automáticamente ni se borra el borrador. El menú Exportar muestra la causa dentro del menú, además de Reintentar. Un cierre de sesión fallido también informa el problema. No requiere migraciones ni cambios en Supabase.
