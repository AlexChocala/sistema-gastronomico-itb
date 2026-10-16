# Modo oscuro

- **Personal:** Configuración → Apariencia → Claro / Oscuro. Disponible para administrador, supervisor y empleado; también hay un acceso desde el menú de usuario.
- **Cliente:** botón de luna/sol en el encabezado de la portada, carta, carrito y checkout.
- Se guarda en el navegador. El personal y el cliente tienen preferencias independientes; no cambia el tema de otros dispositivos ni se guarda en Supabase.
- En el mismo navegador, las pestañas del mismo ámbito se actualizan cuando cambia la preferencia. Caja, Cocina, Entregas y el monitor de Mostrador usan el tema del personal; Acceso también lo conserva.
- Sin elección previa se usa el modo claro. Si el navegador bloquea el almacenamiento, el cambio funciona durante la página actual.

## Alcance

Los colores usan las variables de `src/styles/globals.css`: fondos, textos, bordes, estados, formularios, modales y avisos. Los gráficos releen sus colores al cambiar el tema y conservan un fondo legible en las exportaciones PDF. La impresión usa el tema claro para mantener los tickets sobre papel blanco.

La página de Configuración ahora permite elegir apariencia a todos los roles con sesión. **Los datos y formularios del negocio solo se consultan y muestran al administrador.** Las APIs de administración conservan sus controles de permisos.

No requiere dependencias, variables de entorno, cambios de esquema ni migraciones. El script inicial aplica el tema guardado antes de pintar la página; el proveedor atiende la navegación y los cambios entre pestañas.

## Cómo probar

1. Entrar como empleado o supervisor → Configuración → Oscuro. Revisar Dashboard, Pedidos y las pantallas de Caja/Cocina/Entregas. Confirmar que no aparecen datos de administración del negocio en Configuración.
2. Recargar y abrir otra pestaña del panel: debe conservar el modo. Cambiar a Claro y verificar ambas pestañas.
3. Como administrador, confirmar que se pueden seguir editando los datos del negocio y abrir gráficos de Reportes. Cambiar el tema desde otra pestaña y comprobar que etiquetas y fondo se adaptan.
4. En la carta pública, usar el botón de luna/sol y navegar por menú, carrito y checkout. El tema se conserva y no modifica la preferencia del personal.
5. Probar en celular y con teclado. El botón indica si el modo oscuro está activo; las opciones de apariencia se pueden seleccionar con las flechas del teclado.
6. Revisar un PDF de Reportes y la vista de impresión de un ticket: deben seguir siendo legibles.

Pruebas automáticas de preferencias, script inicial y sincronización:

```powershell
node --import tsx --test tests/tema.test.ts
```
