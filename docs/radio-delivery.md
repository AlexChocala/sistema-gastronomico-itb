# Ubicación y radio de delivery

El radio ahora define la zona **sin recargo**, en lugar de rechazar direcciones lejanas. Fuera se aplica un adicional fijo configurable por el administrador. Ver [configuración, API y publicación del recargo](recargo-delivery.md).

La migración original `20261016120000_radio_delivery` agregó `Sucursal.radioDeliveryKm`, `latitud` y `longitud`, con restricciones de rangos. **Se aplicó a Supabase del equipo el 16/10/2026.** La migración posterior del recargo también se aplicó a Supabase del equipo el 16/10/2026; ver su documentación para los detalles.

El radio admite 0,1 a 100 km con un decimal. Georef obtiene la ubicación al guardar la dirección del local. Se pueden ingresar coordenadas manuales del punto exacto si la dirección no se encuentra. Al cambiar dirección/localidad se vuelve a calcular la ubicación. Una sucursal sin radio y coordenadas queda pendiente para delivery; retiro funciona si está habilitado.

El cliente puede usar una localidad guardada e ingresar calle y número, o «Otra localidad» con **`Calle número, localidad, provincia`**. En CABA se usa el barrio, por ejemplo `Avenida Santa Fe 2000, Recoleta, CABA`. Piso y departamento van en referencias.

La distancia se comprueba en el servidor con coordenadas calculadas, no con las enviadas por el comprador. La geocodificación ocurre fuera de las transacciones. No se aceptan direcciones ambiguas ni se usa el centro de la ciudad como sustituto. Georef ofrece ubicaciones aproximadas; la distancia es en línea recta.

No ejecutar `migrate dev`, `db push`, `migrate reset` ni seed contra la base compartida para habilitar estas funciones. Las pruebas de ubicación y recargo no acceden a Supabase:

```powershell
node --import tsx --test tests/radio-delivery.test.ts
```
