# Imágenes en Supabase Storage: contrato para frontend

## Alcance

Backend de subida, reemplazo y borrado de logo, avatares y fotos de productos. No agrega botones ni modifica pantallas, componentes, dependencias, `.env` o `prisma/`.

La base conserva una ruta relativa en `Negocio.logoPath`, `Usuario.fotoPerfilPath` o `Producto.imagenPath`. Por ejemplo: `productos/42-<uuid>.webp`. La URL se construye en el servidor y la credencial no se devuelve al navegador.

## Configuración manual

1. En Supabase Storage, crear el bucket **imagenes**, público.
2. Configurar el límite del bucket en **2 MB** y permitir `image/webp`, `image/jpeg` e `image/png`.
3. Agregar únicamente al `.env` local del servidor:

```dotenv
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_del_proyecto>
```

No usar el prefijo `NEXT_PUBLIC_`. La contraseña de PostgreSQL no es la clave de Storage. No se requieren dependencias nuevas ni migraciones de esta funcionalidad.

4. Reiniciar `npm run dev` luego de configurar las variables. Las carpetas `logo/`, `avatares/` y `productos/` se forman al subir archivos.

El bucket público permite leer imágenes sin sesión; las escrituras pasan por los endpoints protegidos del proyecto. No hace falta permitir escrituras anónimas en el bucket.

## Endpoints y permisos

| Endpoint | Métodos | Permisos existentes | Campo en la base |
| --- | --- | --- | --- |
| `/api/negocio/logo` | POST, DELETE | admin activo | `Negocio.logoPath`, negocio 1 |
| `/api/usuarios/[id]/foto-perfil` | POST, DELETE | POST: solo el dueño de la cuenta. DELETE: el dueño o un admin (usuario activo) | `Usuario.fotoPerfilPath` |
| `/api/productos/gestion/[id]/imagen` | POST, DELETE | admin o supervisor activo | `Producto.imagenPath` |

Requieren la cookie de sesión de la aplicación. No aceptan una clave de Supabase enviada por el cliente. El usuario debe haber cambiado su contraseña temporal. Se mantienen los permisos actuales de administración de productos; esta tarea no agrega restricciones por sucursal. Las escrituras con origen externo se rechazan.

El negocio, usuario o producto tiene que existir antes de subir. En usuarios y productos se puede gestionar la imagen de registros activos o archivados/desactivados, según los permisos de su controlador.

### POST: subir o reemplazar

Enviar `multipart/form-data`, un único archivo en el campo **archivo**. No enviar rutas, URLs ni nombres de archivo destino: los genera el servidor. Acepta WebP, JPG/JPEG y PNG, no vacíos, hasta **2.097.152 bytes** inclusive. Comprueba el MIME y la cabecera del formato; no redimensiona ni convierte la imagen.

No fijar manualmente el encabezado `Content-Type` al enviar `FormData`: el navegador agrega el boundary.

Respuesta **200**, tanto al subir por primera vez como al reemplazar:

```json
{
  "mensaje": "Imagen del producto guardada.",
  "imagen": {
    "ruta": "productos/42-<uuid>.png",
    "url": "https://<proyecto>.supabase.co/storage/v1/object/public/imagenes/productos/42-<uuid>.png"
  },
  "producto": {
    "idProducto": 42,
    "imagenPath": "productos/42-<uuid>.png"
  }
}
```

El ejemplo abrevia `producto`: la respuesta contiene los demás campos de administración existentes. En logo se devuelve `negocio` con sus campos actuales, `logoUrl` y `tieneLogo`; en avatar se devuelve `usuario` con sus campos actuales, incluido `fotoPerfilPath`, sin contraseña ni hash. Los mensajes correspondientes son `Logo guardado.` y `Foto de perfil guardada.`.

Para mostrar inmediatamente la foto, usar `imagen.url`. La URL del logo también se devuelve al consultar los datos generales del negocio. El listado y detalle de administración de productos incluyen `imagenPath`. Los lectores de otras pantallas pueden convertir las rutas en sus módulos del servidor con `urlImagenPublica()`; esta tarea no cambia sus interfaces ni conecta la visualización de fotos en Caja o carta. La foto de perfil ya se muestra en Perfil, en el menú de usuario y en la tabla de Usuarios (`fotoPerfilUrl`).

### DELETE: quitar

No requiere cuerpo. Borra el objeto de Storage y deja el campo correspondiente en `null`.

Respuesta **200**:

```json
{
  "mensaje": "Imagen del producto eliminada.",
  "imagen": { "ruta": null, "url": null },
  "producto": { "idProducto": 42, "imagenPath": null }
}
```

Logo y avatar mantienen sus respuestas existentes (`negocio` o `usuario`) y agregan `imagen`. Si el registro ya no tiene imagen, DELETE devuelve 200 sin llamar a Storage. Repetir DELETE es seguro. Si la ruta ya no existe en Storage, el borrado del proveedor sigue siendo idempotente.

El DELETE de `/api/productos/gestion/[id]` sigue desactivando el producto. Para quitar solo la foto usar la ruta terminada en `/imagen`.

## Errores

Siempre JSON `{ "error": "mensaje para el usuario" }`, sin credenciales ni detalles internos del proveedor.

| Estado | Motivo |
| --- | --- |
| 400 | ID inválido, archivo ausente, vacío, campo incorrecto, repetido o formulario malformado |
| 401 | Sin sesión válida |
| 403 | Rol sin permiso, cuenta inactiva, contraseña pendiente o solicitud de otro origen |
| 404 | Registro inexistente o configuración inicial del negocio incompleta |
| 409 | Otra operación cambió la imagen o la ruta guardada pertenece a otra carpeta/es inválida |
| 413 | Archivo mayor de 2 MB o cuerpo multipart mayor de 2 MB + 64 KB |
| 415 | Cuerpo distinto de multipart o imagen fuera de los formatos admitidos/MIME incompatible |
| 500 | Error de base de datos no contemplado |
| 502 | Error, rechazo o timeout de Storage; también limpieza/restauración incompleta |
| 503 | Faltan variables de Storage o `SUPABASE_URL` no es una URL HTTPS del proyecto |

Cada solicitud al proveedor tiene timeout de 15 segundos. Una operación puede requerir varias solicitudes si necesita reemplazar o limpiar archivos.

## Reemplazos y fallos

Cada subida utiliza un nombre nuevo con UUID, evitando sobrescribir el archivo anterior y problemas de caché al reemplazar una imagen. Se guarda la nueva ruta solo si sigue coincidiendo la ruta que se leyó inicialmente. Luego se elimina el archivo anterior.

Si falla el guardado, se intenta limpiar la nueva subida. Si falla el borrado en Storage, se intenta restaurar la referencia anterior. Las operaciones concurrentes no sobrescriben una referencia que ya cambió.

PostgreSQL y Storage no comparten una transacción. Un corte de red, una restauración fallida o una limpieza fallida pueden requerir revisar el registro y el bucket. En ese caso se devuelve 502 y, cuando queda una subida pendiente de limpieza, el servidor registra únicamente su ruta. No se promete atomicidad entre ambos servicios. Consultar el estado antes de volver a intentar una operación que devolvió ese error.

## Prueba manual de cada endpoint

Con el servidor iniciado, sesión admin y configuración de Storage lista:

1. En la consola del navegador de la aplicación, abrir un selector de archivo y subir una imagen:

```js
// Cambiar por el endpoint y un ID existente que se quiera probar.
const endpoint = '/api/productos/gestion/42/imagen';
const selector = document.createElement('input');
selector.type = 'file';
selector.accept = 'image/png,image/jpeg,image/webp';
selector.onchange = async () => {
  const archivo = selector.files?.[0];
  if (!archivo) return;
  const datos = new FormData();
  datos.append('archivo', archivo);
  const respuesta = await fetch(endpoint, {
    method: 'POST', credentials: 'same-origin', body: datos
  });
  console.log(respuesta.status, await respuesta.json());
};
selector.click();
```

Usar `/api/negocio/logo` para logo y `/api/usuarios/<id-existente>/foto-perfil` para avatar. También se puede usar Postman o Thunder Client con las cookies de la sesión y cuerpo form-data, campo `archivo` de tipo File.

2. Confirmar 200 y abrir `imagen.url`. Debe verse sin iniciar sesión, porque el bucket es público.
3. En Supabase Storage → `imagenes`, comprobar que existe el archivo en su carpeta.
4. En la base que usa `DATABASE_URL`, comprobar que la columna de la tabla correspondiente guarda exactamente `imagen.ruta`, sin dominio.
5. Repetir POST con otra imagen. Debe cambiar la ruta, existir solo la nueva imagen de ese registro en el bucket y desaparecer la anterior.
6. Borrar desde la misma consola:

```js
const respuestaBorrado = await fetch(endpoint, {
  method: 'DELETE', credentials: 'same-origin'
});
console.log(respuestaBorrado.status, await respuestaBorrado.json());
```

Confirmar 200, `imagen.ruta: null`, campo de la base `null` y ausencia del archivo en Storage. Repetir DELETE debe seguir devolviendo 200.

7. Probar archivo vacío (400), TXT/SVG o un texto renombrado PNG (415), más de 2 MB (413), ID inexistente (404). No deben cambiar la ruta anterior ni crear objetos.
8. Probar sin sesión (401), empleado o supervisor en logo (403), supervisor en foto de producto (200), subir el avatar de otro usuario, admin incluido (403), y quitar el avatar propio o, como admin, el de otro (200).

## Archivos de la implementación

| Archivo | Función |
| --- | --- |
| `src/lib/storage/imagenes.ts` | Validación, nombres únicos, URLs públicas, REST con fetch, limpieza y control de cambios concurrentes |
| `src/lib/negocio/negocio-administracion.ts` | Subir/quitar logo reutilizando protección admin |
| `src/lib/negocio/negocio.ts` | Convertir `logoPath` en la URL pública del logo |
| `src/lib/usuarios/usuarios-administracion.ts` | Subir/quitar avatar reutilizando protección admin |
| `src/lib/productos/productos-administracion.ts` | Subir/quitar imagen de producto y seleccionar `imagenPath` en sus respuestas |
| `src/app/api/negocio/logo/route.ts` | Delegar POST y DELETE de logo |
| `src/app/api/usuarios/[id]/foto-perfil/route.ts` | Delegar POST y DELETE de avatar |
| `src/app/api/productos/gestion/[id]/imagen/route.ts` | Nuevo endpoint POST y DELETE de imagen de producto |
| `docs/imagenes-storage.md` | Contrato, configuración y pruebas para frontend |

Referencia de REST: [implementación oficial de subida](https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts) y [borrado de objetos](https://github.com/supabase/storage/blob/master/src/http/routes/object/deleteObjects.ts).
