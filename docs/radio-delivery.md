# Radio de delivery por sucursal

## Funcionamiento

Cada sucursal que ofrece delivery configura un radio de entre **0,1 y 100 km**, con hasta un decimal, desde su dirección. El formulario propone 5 km para sucursales nuevas; el administrador puede cambiarlo. Es distancia **en línea recta**, no kilómetros recorridos por calles.

La ubicación se obtiene con Georef al guardar la sucursal. En «Ubicación manual del local (opcional)» se puede cargar la latitud y longitud exactas, tomadas del punto del local en un mapa, cuando Georef no encuentra la dirección. Cambiar la dirección o localidad en el formulario borra las coordenadas anteriores para calcularlas nuevamente.

La validación se hace en el servidor para:

- POST `/api/pedidos`: pedidos del menú digital.
- POST `/api/pedidos/caja`: pedidos que registra el personal.
- PATCH `/api/pedidos/[id]`, acción `cambiarTipoEntrega` a `delivery`.

Una dirección fuera del radio no crea el pedido ni el cliente, ni modifica el tipo de entrega. La comprobación se realiza antes de abrir la transacción; dentro de ella se vuelve a leer la configuración. Si cambió mientras se consultaba la dirección, se pide reintentar (409).

Los pedidos de retiro no consultan Georef ni requieren cobertura. Las zonas de delivery ya configuradas siguen siendo una condición adicional: estar dentro del radio no permite elegir una localidad que la sucursal no atiende. Los permisos existentes se conservan.

## Direcciones del cliente

Si el formulario permite elegir una localidad, alcanza con calle y número. Sin localidad seleccionada se exige el formato **`Calle número, localidad, provincia`**, por ejemplo `Olavarría 100, Avellaneda, Buenos Aires`. Piso, departamento e indicaciones van en referencias. En CABA, usar el barrio como localidad (por ejemplo `Avenida Santa Fe 2000, Recoleta, CABA`) para identificar la dirección con precisión. No se supone que el cliente vive en la localidad de la sucursal.

El servidor resuelve la dirección con Georef y compara sus coordenadas con las del local. No acepta coordenadas ni un radio enviados en el pedido. Si no puede identificar la dirección, falta ubicación, aparecen calles distintas o puntos alejados para una misma dirección, rechaza el envío para que se corrija; no utiliza el centro de la localidad como sustituto.

Georef proporciona ubicaciones **aproximadas** y su cobertura varía según la región. La comprobación depende de que el servicio pueda ubicar la dirección. Fuente: [normalización de direcciones de Georef](https://www.argentina.gob.ar/georef/normalizacion-de-direcciones).

## Respuestas

Se conservan los contratos de éxito de los endpoints existentes. Los errores usan `{ "error": "mensaje" }`:

| Estado | Motivo |
| --- | --- |
| 400 | Radio/dirección inválidos, dirección fuera de cobertura, localidad no atendida o dirección que no puede ubicarse con precisión. |
| 409 | Sucursal sin cobertura configurada o configuración modificada durante la comprobación. |
| 503 | No se pudo consultar Georef. Se solicita reintentar. |

No se modifican automáticamente pedidos existentes, pagos ni estados de cocina o entrega.

## Supabase y publicación

**La migración se aplicó a Supabase del equipo el 16/10/2026, con autorización del usuario. Se verificaron los tres campos, la restricción de rangos y el historial de migraciones actualizado.**

`prisma/migrations/20261016120000_radio_delivery/migration.sql` agrega tres columnas opcionales a `Sucursal`: `radioDeliveryKm`, `latitud` y `longitud`, y una restricción de rangos. No elimina datos ni asigna radios arbitrarios a los locales existentes.

La base debe recibir la migración **antes de ejecutar esta versión**, tanto en localhost como en Vercel. En la base compartida del equipo este paso ya está cumplido. Para otras bases o instalaciones nuevas, coordinar con quien las administra:

1. Revisar las migraciones pendientes con `npx prisma migrate status` usando la configuración del proyecto y su conexión de migraciones.
2. Revisar el SQL y, cuando el equipo acuerde aplicarlo, ejecutar `npx prisma migrate deploy`. Este comando aplica **todas** las migraciones pendientes, no solamente esta.
3. Generar el cliente local con `npx prisma generate`. Este comando solo actualiza el cliente; no migra la base.
4. Probar en localhost antes de incorporar la rama a `master` y publicar en Vercel.
5. Configurar el radio y la ubicación de cada sucursal existente desde Sucursales → Editar. Coordinar esta configuración con la publicación: una sucursal con campos nulos queda **pendiente de cobertura y no acepta nuevos delivery** hasta que se configure. El retiro continúa funcionando si está habilitado.

No ejecutar `migrate dev`, `db push`, `migrate reset` ni el seed contra la base compartida para habilitar esta función. No requiere nuevas claves ni dependencias. Georef se consulta desde el servidor.

## Pruebas manuales

1. Como administrador, editar una sucursal y guardar un radio de 5 km. Revisar la dirección y, si hace falta, completar sus coordenadas exactas. Recargar y comprobar que se conserva el radio.
2. En la carta de esa sucursal, elegir delivery e ingresar una dirección conocida cercana. Debe permitir registrar el pedido.
3. Para una sucursal de Avellaneda, usar una dirección de Mar del Plata, con localidad y provincia completas. Debe rechazarla antes de guardar. Si no existe en Georef, debe pedir corregirla, sin registrar nada.
4. Repetir cerca/fuera de radio desde Caja con una cuenta de empleado o supervisor.
5. Crear un retiro e intentar cambiarlo a delivery con una dirección lejana. Debe conservarse como retiro. Repetir con una dirección cercana: debe permitir el cambio.
6. Probar dirección incompleta, radio cero, negativo, superior a 100 y más de un decimal. Deben rechazarse. Una dirección exactamente en el límite se acepta, sin redondear distancias para admitir direcciones exteriores.
7. Comprobar que las localidades habilitadas se siguen respetando y que un pedido de retiro funciona aunque la cobertura esté pendiente.

Las pruebas automáticas usan dobles en memoria y no acceden a Supabase:

```powershell
node --import tsx --test tests/radio-delivery.test.ts
```
