# Historial de precios de productos

Productos incorpora un botón Historial de precios en cada tarjeta, también para productos inactivos. Muestra fecha y hora de Argentina, precio anterior y precio nuevo, con 30 registros por página. Precio inicial significa que el precio anterior es nulo. El historial corresponde al precio base de Producto; no incluye adicionales de Variacion ni Extra.

GET /api/productos/gestion/[id]/historial-precios?pagina=1 usa los permisos existentes de administración de productos: administrador y supervisor activos, con contraseña vigente. Empleados y visitantes no acceden. Solo devuelve registros del producto solicitado, ordenados por fecha e identificador descendentes. No modifica datos al consultar.

El 28/10/2026 se verificó con una transacción de solo lectura que el trigger public.Producto.trg_historial_precio_producto ya estaba activado (O). Es AFTER UPDATE OF precio y registra OLD.precio, NEW.precio y NOW() si los precios son distintos. No se ejecutó ALTER TABLE ni se cambiaron precios o registros reales.

La edición detecta si ese trigger está activo en la sesión y evita insertar un segundo historial desde Prisma. Si falta o está deshabilitado en otra base, conserva el registro manual dentro de la misma transacción. Crear/importar un producto conserva su precio inicial: el trigger existente solo atiende UPDATE. Cambiar un precio por el mismo valor no crea un movimiento nuevo. Los registros anteriores no se eliminan ni se modifican.

No requiere nuevas tablas, migraciones ni dependencias. La función/trigger se mantiene en la base existente; no se invoca desde el navegador ni se expone una credencial. Un trigger desactivado no se habilita desde la aplicación.
