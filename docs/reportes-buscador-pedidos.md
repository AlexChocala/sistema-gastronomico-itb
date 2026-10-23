# Búsqueda en el detalle de pedidos

En **Reportes → Detalle de pedidos**, el buscador filtra por producto, cliente, persona que registró el pedido, número y sucursal. No distingue mayúsculas ni tildes. Se pueden combinar palabras, por ejemplo `hamburguesa Nicolás`.

Busca dentro del rango de fechas y sucursales autorizado. No solicita datos adicionales al escribir. La actualización periódica conserva la búsqueda; cambiar de pestaña también. Cambiar la sucursal activa de la barra superior reinicia el reporte, como antes.

La tabla incorpora los nombres de los productos y conserva la cantidad total en una columna separada. Se muestran el contador de coincidencias, el botón para limpiar y un mensaje cuando no hay resultados.

La búsqueda afecta el listado y sus exportaciones PDF, CSV y JSON. En Excel, solo se filtra la hoja **Detalle de pedidos**; el resumen y los otros reportes mantienen los datos del período completo. El archivo incluye una nota con la búsqueda aplicada al detalle. Sin búsqueda, las descargas contienen todos los pedidos del período.

Las tarjetas superiores y los demás gráficos mantienen los totales del rango y la sucursal seleccionados. Los pedidos pendientes siguen apareciendo en el detalle sin sumarse como vendidos.

No requiere migraciones, cambios en Supabase, variables nuevas ni dependencias.

Para probar: buscar un producto, un empleado con/sin tildes, un cliente y `#` seguido del número de pedido; combinar producto y empleado; probar una búsqueda sin coincidencias; limpiar; cambiar fechas/sucursal y comprobar las descargas.
