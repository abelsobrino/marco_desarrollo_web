# ChambaCerca — actualización de la presentación

## Si ya tienes las tablas y configuraste la conexión

1. Antes de reemplazar tu carpeta, copia la **clave publicable completa** de tu `js/config.js` actual.
2. Extrae este ZIP. En el nuevo `js/config.js` la URL ya está puesta: `https://fpknbpsaurtcdzkchhbx.supabase.co`. Pega tu clave en `supabaseKey`. La captura enviada mostraba la clave recortada; por eso no se inventó ni se incluyó una clave incompleta. No uses la contraseña PostgreSQL.
3. En el SQL Editor de tu proyecto, ejecuta **solo `database/02_bandeja_mensajes.sql`**. Es una actualización: conserva los datos y añade la bandeja, los contadores y el estado de lectura. No vuelvas a ejecutar `01_supabase.sql` sobre las tablas existentes.
4. Para la exposición, en **Authentication → Sign In / Providers → Email** (o la sección de proveedores de correo de tu panel), desactiva **Confirm email** y guarda. El nombre exacto del menú puede variar; el ajuste se llama Confirm email. Este ajuste se hace en Supabase, no en config.js.
5. Abre el `index.html` principal con Live Server. Recarga con Ctrl + Shift + R.
6. Crea nuevas cuentas de prueba con correos diferentes de formato válido, por ejemplo `alumno01@example.com` y `alumno02@example.com`. No necesitas acceder a esas bandejas cuando la confirmación está desactivada. Sí debes recordar sus contraseñas.

La web sigue verificando las credenciales mediante Supabase Auth. No acepta contraseñas incorrectas ni simula sesiones. La validación básica del formato de correo sigue siendo necesaria para Supabase. Desactivar Confirm email permite registrar sin enviar/abrir una confirmación. Las cuentas creadas anteriormente que todavía estén pendientes deben revisarse en Authentication → Users; para la presentación es más sencillo crear nuevas cuentas después de cambiar el ajuste.

La recuperación de contraseña sigue necesitando un correo real accesible. No hay recuperación por email posible para una dirección ficticia.

## Si empiezas en otro proyecto nuevo

Ejecuta `database/01_supabase.sql` primero y `database/02_bandeja_mensajes.sql` después. Coloca la URL y clave publicable de ese proyecto en `js/config.js`. Luego sigue los pasos de configuración de correo y ejecución anteriores.

## Qué cambió

- **Inicio de sesión:** un formulario central y debajo un enlace pequeño “Regístrate”. El registro abre una pantalla aparte, con retorno a Iniciar sesión.
- **Después de entrar:** todos eligen entre “Quiero contratar” (soy cliente y necesito a alguien) y “Quiero trabajar” (ofrezco mis servicios). “Cambiar de modo” permite volver a elegir en cualquier momento.
- **Como cliente:** buscar trabajadores, publicar necesidades, recibir propuestas, seleccionar, finalizar y calificar.
- **Como trabajador:** completar perfil/oficios/experiencia, buscar oportunidades y enviar propuestas.
- **Mi actividad:** separa las publicaciones como cliente y las propuestas como trabajador. Cambiar de modo no elimina ninguna de las dos.
- **Avisos flotantes:** se ocultan automáticamente a los dos segundos. Los errores de formularios también quedan junto al formulario para poder corregirlos sin depender del aviso.
- **Mensajes:** icono en la esquina superior derecha con círculo de mensajes sin leer. Primero se muestran las personas. Si hay varios trabajos con la misma persona, se elige la conversación correspondiente.
- **Lectura:** abrir una conversación visible marca los mensajes recibidos que se cargaron. El remitente no puede marcar sus propios mensajes como leídos por la otra persona. Se conserva en PostgreSQL, no solo en el navegador.
- **Historial:** se cargan 100 mensajes inicialmente y se pueden ver anteriores. Las conversaciones más recientes aparecen primero. Los contadores se actualizan cada cinco segundos mientras la pestaña está visible.

## Prueba para exponer con dos cuentas

1. En una ventana normal, entra con A y elige **Quiero contratar**. Publica un trabajo con fecha futura, oficio, distrito y pago.
2. En una ventana incógnita, entra con B y elige **Quiero trabajar**. Completa Mi perfil, activa que ofreces servicios, guarda y agrega el oficio del trabajo.
3. B busca el trabajo publicado y envía una propuesta.
4. En A, abre el icono de mensajes: B debe aparecer como persona. Abre la conversación y envía un mensaje.
5. En B, espera hasta cinco segundos: aparecerá el contador. Abre la bandeja y luego a A; al abrir la conversación se descuenta el pendiente.
6. Recarga la página: el mensaje permanece leído. Puedes volver a elegir el modo sin crear otra cuenta.
7. A entra a Mi actividad, selecciona a B, finaliza el servicio cuando corresponda y registra una calificación.

Los nombres y mensajes usados en las pruebas automáticas no se insertan en tu base ni forman parte de los datos de la aplicación.

## Archivos

| Archivo | Uso |
| --- | --- |
| `index.html` | Pantallas actuales |
| `js/plataforma.js` | Autenticación, modos, formularios y mensajes |
| `js/config.js` | URL ya incorporada; conserva tu clave publicable |
| `css/plataforma.css` | Estilos de escritorio y móvil |
| `database/01_supabase.sql` | Instalación inicial, solo para una base nueva |
| `database/02_bandeja_mensajes.sql` | Actualización de la base existente |
| `database/MODELO.md` | Modelo y reglas |
| `pruebas/database.mjs` | Pruebas SQL con base efímera |
| `pruebas/RESULTADOS.md` | Alcance de la verificación |
| `prototipo-original/` | Copia del prototipo previo a la integración con Supabase |

Los antiguos `js/app.js`, `js/ubicacion.js` y `css/styles.css` permanecen como referencia y no se cargan en la interfaz actual.

## Alcance y siguientes mejoras

La cobertura inicial sigue siendo de diez distritos de Lima y seis oficios. Se conservan los filtros por distrito/oficio, GPS opcional, fotos, postulaciones y calificaciones. Las fotos son públicas, mientras que los mensajes y las postulaciones solo están disponibles para participantes. El mismo usuario puede contratar y trabajar; elegir un modo es una decisión de navegación, no un permiso administrativo.

El chat se actualiza por consultas cada cinco segundos, sin WebSockets. Las marcas de lectura sirven para el contador; no se añadieron palomitas de lectura al mensaje enviado. La consulta de bandeja devuelve hasta el límite de filas configurado por el proyecto (habitualmente 1000 conversaciones). Los listados de búsqueda siguen limitados a 100 resultados; la búsqueda textual se aplica sobre ese conjunto. Una siguiente mejora sería paginar esas listas y la bandeja para volúmenes mayores.

No hay pagos en línea, adjuntos de chat, notificaciones push, administración, verificación de identidad ni cancelación de un servicio ya asignado. Mantén esta configuración de correos sin confirmación para la presentación; cuando quieras verificar propiedad real de los correos, vuelve a activar Confirm email.

No se cambió la configuración de tu cuenta ni se ejecutó el SQL remoto desde aquí: hay que realizar los pasos iniciales en tu Supabase. La clave publicable completa tampoco fue proporcionada en la conversación.

## Referencias

[Configuración de autenticación por correo y contraseña en Supabase](https://supabase.com/docs/guides/auth/passwords).
[Registro con Supabase Auth](https://supabase.com/docs/reference/javascript/auth-signup).
