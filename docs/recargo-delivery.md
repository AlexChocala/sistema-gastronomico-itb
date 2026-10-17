# Recargo fijo de delivery

## Configuración

Solo el administrador modifica la tarifa en **Sucursales → Editar → Formas de entrega**:

- **Radio sin recargo (km):** entre 0,1 y 100 km en línea recta desde el local.
- **Recargo fijo fuera del radio ($):** pesos enteros entre 0 y 10.000.000. Se suma una sola vez por pedido, sin multiplicar por los kilómetros excedidos. Con 0 se permite delivery lejano sin adicional.

Ejemplo: radio 5 km y recargo $2.000. A 4 km el adicional es $0; a 8 o a 30 km es $2.000. No hay límite de distancia por encima del radio. Las localidades guardadas son atajos; «Otra localidad» permite ingresar `Calle número, localidad, provincia`.

La ubicación del local sigue siendo necesaria. Una dirección incompleta, ambigua o no identificable por Georef debe corregirse. Un fallo del proveedor no habilita un envío con ubicación supuesta. El radio es distancia en línea recta, no un recorrido por calles.

## Pedidos y cobro

En checkout, Caja y cambio a delivery se calcula el envío antes de confirmar. Se muestra distancia aproximada, adicional y total. Editar dirección/localidad invalida el importe mostrado.

El servidor vuelve a calcular la distancia y compara el adicional aceptado antes de guardar. Un importe distinto o un cambio concurrente de configuración devuelve 409 sin crear cliente ni pedido. El retiro no geocodifica ni lleva recargo.

`Pedido.subtotal` conserva los productos; `Pedido.recargoDelivery` guarda el adicional aplicado; `Pedido.total` incluye ambos. Cambiar después la tarifa no modifica pedidos anteriores. Confirmación, ticket, tarjeta del pedido y detalle de Reportes (incluidas sus exportaciones) muestran el adicional. Los reportes suman el total cobrado; los productos más vendidos mantienen solo sus importes de productos.

Cambiar retiro/delivery de un pedido pendiente ajusta el recargo y total. En uno ya pagado se rechaza cualquier cambio de entrega que altere el importe cobrado; esta función no registra cobros adicionales ni devoluciones.

## Base de datos y publicación

**Migración `20261016180000_recargo_delivery` aplicada a Supabase del equipo el 16/10/2026, con autorización.** Se verificaron las dos columnas, sus restricciones y el historial de migraciones actualizado. No hay que repetir este paso en esa base compartida.

Agrega `Sucursal.recargoFueraRadio` opcional y `Pedido.recargoDelivery` con valor inicial 0, junto con restricciones de rangos. Conserva datos y totales históricos. Las sucursales existentes quedan con tarifa pendiente: dentro del radio siguen funcionando; para entregar fuera, el administrador debe guardar un importe (0 también es válido).

La migración debe aplicarse una sola vez a la base correspondiente, antes de ejecutar/publicar este código. Revisar las migraciones pendientes y coordinar con el responsable de Supabase antes de `prisma migrate deploy`. Este comando aplica todas las pendientes. No usar `migrate dev`, `db push`, `reset` ni seed en la base compartida.

Generar el cliente local con `npx prisma generate` tras actualizar el código; `npm ci` también lo hace mediante el postinstall existente. No hay dependencias ni variables nuevas.

## API para frontend

**Cotización pública:** `POST /api/pedidos/cotizacion-delivery`, JSON `{ slugSucursal, direccion, idLocalidad? }`.

**Cotización del personal:** `POST /api/pedidos/caja/cotizacion-delivery`, JSON `{ direccion, idLocalidad? }`. Requiere sesión operativa y usa la sucursal de esa sesión. No permite elegir otra sucursal en el cuerpo.

200: `{ cotizacion: { distanciaKm, fueraDelRadio, radioDeliveryKm, recargoDelivery } }`. No crea registros. El endpoint público limita las consultas por IP en memoria, como las altas de pedidos existentes; en múltiples instancias ese límite es por instancia.

POST de pedido público/Caja y PATCH a delivery agregan **`recargoDeliveryAceptado`**, igual al importe mostrado (también cuando sea 0). El servidor verifica el importe, no lo usa como tarifa. Los cuerpos de retiro siguen sin necesitarlo.

Errores: 400 datos inválidos; 401/403 permisos; 404 sucursal no disponible; 409 tarifa pendiente, configuración/importe cambiado o cambio de importe de un pedido pagado; 429 límite de consultas públicas; 503 Georef no disponible. Se conserva `{ error: mensaje }`.

## Verificación

Pruebas sin Supabase: `node --import tsx --test tests/radio-delivery.test.ts`.

Prueba manual tras migrar: configurar radio 5 km y adicional $2.000, calcular un destino cercano ($0) y uno lejano ($2.000), confirmar y revisar ticket/reportes. Repetir en Caja. Editar tarifa y comprobar que no cambian pedidos anteriores. Probar retiro, dirección incompleta y recargo modificado antes de confirmar.
