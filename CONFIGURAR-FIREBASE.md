# Configurar la copia en la nube de Mi Jornada

La app sigue funcionando sin Internet. El inicio de sesión y la copia en la nube
solo se activan cuando la aplicación está conectada a un proyecto Firebase.

## Crear el proyecto (desde el móvil)

1. Entra en https://console.firebase.google.com/ con tu cuenta de Google.
2. Pulsa **Crear proyecto** y llámalo, por ejemplo, `Mi Jornada`.
   Elige el plan **Spark**, sin coste, y no es necesario activar Analytics.
3. Añade una **aplicación Android**, indicando el identificador exacto
   `es.mijornada.app`. Descarga `google-services.json`.
4. En **Authentication > Métodos de acceso**, habilita **Correo electrónico/Contraseña**.
5. En **Firestore Database**, crea la base de datos en edición **Standard**.
   Selecciona la región adecuada para tus datos; escoge **modo producción**.
6. En **Firestore > Reglas**, copia el contenido de `firestore.rules` y publica las reglas.
   No utilices reglas que permitan leer todos los datos a cualquiera.

## Datos que hay que introducir para compilar

En `app/src/main/assets/firebase-config.json` configura:

- `applicationId`: el valor `client[0].client_info.mobilesdk_app_id` del JSON descargado.
- `apiKey`: el valor `client[0].api_key[0].current_key`.
- `projectId`: el valor `project_info.project_id`.

No uses como applicationId el nombre de paquete Android (`es.mijornada.app`).
El fichero de Firebase contiene identificadores del proyecto (no es una contraseña),
pero no publiques nunca contraseñas personales, tokens privados ni claves de cuenta
de servicio. Las reglas de Firestore son obligatorias para proteger los registros.

La app inicializa Firebase mediante `FirebaseOptions`, por lo que no necesita
añadir el plugin de Google Services a Gradle.

## Cómo usarlo

1. Instala la APK conectada a Firebase. Antes exporta JSON desde la instalación actual.
2. En **Copias de seguridad > Mi cuenta y copia en la nube**, crea una cuenta con correo
   y contraseña o inicia sesión.
3. Pulsa **Guardar copia en la nube**. Esa primera acción activa la subida automática
   de futuros cambios.
4. Al cambiar de móvil, instala la app, inicia sesión con la misma cuenta y pulsa
   **Recuperar copia de la nube**. Primero exporta los datos de ese móvil si deseas
   conservarlos: restaurar reemplaza los registros locales.
5. Las anotaciones se guardan localmente y se intentan subir cuando hay sesión e Internet.
   Si no hay conexión, sigue utilizando la app y comprueba más tarde que aparezca
   «Copia guardada en la nube».

**Importante:** en esta primera versión hay una única copia por cuenta y prevalece
la última subida. No edites simultáneamente en dos móviles sin recuperar antes
la última copia del otro. El registro automático de jornada sigue siendo una
estimación según los turnos al abrir la app, no un fichaje real en segundo plano.

## Privacidad

Cada copia se almacena en `users/{uid}/backups/main` y las reglas limitan
la lectura y escritura al titular autenticado. Usa una contraseña distinta de la
de tus otros servicios y no la compartas.
