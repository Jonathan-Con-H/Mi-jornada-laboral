# Mi Jornada

Aplicación Android para consultar el calendario de turnos y registrar la jornada laboral, horas pendientes y apuntes.

## Turnos
- Mañana: de 06:00 a 14:00.
- Tarde: de 14:00 a 22:00.
- Descanso habitual: 30 minutos.
- Rotación: tres semanas de mañana y una de tarde; fines de semana de descanso.

## Generar e instalar el APK
1. Abre la pestaña **Actions** de este repositorio.
2. Entra en la ejecución más reciente de **Generar APK de Mi Jornada** que tenga una marca verde.
3. Busca la sección **Artifacts / Artefactos**.
4. Pulsa el nombre **Mi-Jornada-APK** o el icono de descarga (flecha hacia abajo); **no pulses la papelera**, que elimina el archivo.
5. Abre el ZIP descargado, extrae `app-debug.apk` e instálalo desde tu móvil Android.

La aplicación guarda los datos localmente en el dispositivo. En el apartado «Copias de seguridad» puedes exportar e importar tus registros en formato JSON. Todavía no hay sincronización automática entre dispositivos.

## Registro automático
- Activado por defecto desde la primera apertura de la versión nueva.
- Apunta de lunes a viernes la jornada del turno (06:00–14:00 o 14:00–22:00) al llegar la hora prevista, y recupera los días pendientes al volver a abrir la aplicación.
- **No es un fichaje real en segundo plano**: usa el horario previsto. Se puede detener la jornada actual con **Detener jornada ahora**, y editar o restablecer cualquier día.
- El botón **Desactivar** evita nuevos registros automáticos, manteniendo los ya guardados.
- Las 8 horas corresponden a la franja de la jornada; los 30 minutos de descanso se muestran aparte y generan 30 minutos en «tiempo que se debe» cada día laborable.
- Los datos ya guardados con versiones anteriores se conservan. Antes de instalar una actualización, exportar copia JSON es recomendable.

## Web: nube y asistente (versión inicial)

- La página pública usa Firebase Authentication (correo y contraseña) y Firestore para `users/{uid}/backups/primary`.
- Antes de guardar datos reales, habilita Firestore en el proyecto Firebase y **publica las reglas del archivo `firestore.rules` en la consola Firebase > Firestore > Reglas**. El archivo de GitHub por sí solo NO las activa.
- Cada usuario debe ver y modificar solamente sus datos (`request.auth.uid == userId`).
- La web no sustituye ninguna copia sin comparar los datos locales y los remotos. Si difieren sin versión sincronizada conocida, se solicita elegir. Conviene exportar un JSON antes de reemplazar cualquiera de las dos.
- La aplicación Android ya dispone de conexión nativa a Firebase; la web utiliza el SDK JavaScript. El acceso compartido depende de usar la misma cuenta Firebase y de las reglas activas.
- Si aparece un error de clave de API restringida, crea/registrar una aplicación web en Firebase y actualiza `firebase-web-config.js` con la configuración web oficial. Esa configuración es pública: **jamás insertar claves secretas o contraseñas de administrador en JavaScript o GitHub Pages**.
- El asistente web inicial permite consultar turnos, horas debidas y proponer cambios sencillos. **Siempre solicita confirmación para guardar**. Tiene dictado y voz cuando el navegador los admite y chat local; **todavía no integra un modelo de IA** ni sincroniza el historial del chat entre dispositivos.
- Para una IA conversacional completa habrá que elegir un proveedor seguro y configurar un servicio protegido para llamadas al modelo sin exponer credenciales en el cliente.

## Mejoras web en revisión (rama `feat/proteccion-jornadas-ausencias`)

Estas mejoras se aplican a la **web** y están pendientes de revisión/pruebas finales antes de integrarlas en `main`. No sustituyen ni migran automáticamente la aplicación Android instalada.

- Al pulsar **Enviar a papelera** en una jornada existente, se exige confirmación. Permanece 30 días y puede restaurarse desde **Copias de seguridad > Papelera**. Pasados 30 días se purga sin aviso al abrir o utilizar la web.
- Las fechas eliminadas se excluyen del registro automático aunque caduque su papelera. Al registrar manualmente o restaurar esa fecha, la exclusión desaparece.
- Los archivos JSON y la copia web de Firestore incluyen `trash`, `suppressed`, `vacationSettings` y `vacationHistory`, además de jornadas y configuración de registro automático. Las copias antiguas aún son importables.
- Cada fecha admite jornada, descanso, vacaciones, baja médica, permiso retribuido o ausencia justificada. Un permiso por horas se anota en minutos dentro de una jornada; reduce el cálculo de horas efectivas, no altera su franja de entrada-salida.
- Desde el apartado **Vacaciones** se consulta el total de días marcados por año y se configura un cupo anual opcional. Si el cupo se supera, se avisa y se pide confirmación. No se presume ningún cupo laboral.
- Los días de vacaciones se introducen **uno por uno** desde el calendario. El recuento equivale a fechas marcadas, sin descontar automáticamente festivos ni aplicar convenios; confirmar el criterio con la empresa.
- El historial conserva cambios de tipo relacionados con vacaciones; **todavía no existe** un editor de rangos ni traslados de vacaciones con una única operación. El asistente Gemini no realiza estas operaciones.
- La automatización completa de bajas, permisos, días festivos locales, movimientos de vacaciones y la actualización del APK permanecen pendientes.

**Seguridad:** al actualizar, exporta una copia JSON antes de importar o recuperar datos desde otra fuente. La recuperación desde Firestore sigue solicitando confirmación ante diferencias. Los registros automáticos son estimaciones basadas en turnos, no fichajes verificados.

Para comprobar esta rama: `node --test tests/registros.test.js`; GitHub Actions ejecuta también comprobaciones de sintaxis.
