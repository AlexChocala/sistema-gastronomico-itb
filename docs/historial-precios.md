# Historial de precios de productos

Productos incorpora un botón Historial de precios en cada tarjeta, también para productos inactivos. Muestra fecha y hora de Argentina, precio anterior y precio nuevo, con 30 registros por página. Precio inicial significa que el precio anterior es nulo.

Además del precio base, se puede elegir cada variación del producto. Su historial guarda el precio final que paga el cliente (precio base + adicional de la variación), tanto cuando se modifica el adicional como cuando cambia el precio base. Los extras no forman parte de este historial porque se eligen por separado en cada pedido.

GET /api/productos/gestion/[id]/historial-precios?pagina=1 usa los permisos existentes de administración de productos: administrador y supervisor activos, con contraseña vigente. Empleados y visitantes no acceden. Para consultar una variación se agrega `&variacion=<idVariacion>`. Solo devuelve registros del producto solicitado, ordenados por fecha e identificador descendentes. No modifica datos al consultar.

El 28/10/2026 se verificó con una transacción de solo lectura que el trigger public.Producto.trg_historial_precio_producto ya estaba activado (O). Es AFTER UPDATE OF precio y registra OLD.precio, NEW.precio y NOW() si los precios son distintos. No se ejecutó ALTER TABLE ni se cambiaron precios o registros reales.

La edición detecta si ese trigger está activo en la sesión y evita insertar un segundo historial desde Prisma. Si falta o está deshabilitado en otra base, conserva el registro manual dentro de la misma transacción. Crear/importar un producto conserva su precio inicial: el trigger existente solo atiende UPDATE. Cambiar un precio por el mismo valor no crea un movimiento nuevo. Los registros anteriores no se eliminan ni se modifican.

La migración `20261105120000_historial_precios_variaciones` agrega la tabla de historial de variaciones y dos triggers de Supabase: uno para cambios de precio base y otro para altas o cambios del adicional. No se invoca desde el navegador ni se expone una credencial. Los precios de cambios anteriores a esta migración no se inventan: cada variación empieza a registrar desde que la migración se aplique.
