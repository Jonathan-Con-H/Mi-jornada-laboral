# Mi Jornada

Aplicación Android para consultar el calendario de turnos y registrar la jornada laboral, horas pendientes y apuntes.

## Turnos
- Mañana: de 06:00 a 14:00.
- Tarde: de 14:00 a 22:00.
- Descanso habitual: 30 minutos.
- Rotación: tres semanas de mañana y una de tarde; fines de semana de descanso.

## Estado de la aplicación Android y actualizaciones (versión 1.3)

El proyecto compila un APK Android que guarda las jornadas localmente (WebView) y permite
guardar una copia de las hojas de servicio en Firestore tras iniciar sesión en **Mi nube**.
No hay sincronización garantizada si la cuenta no está conectada y confirmada.

### IMPORTANTE: no desinstalar para actualizar

El flujo antiguo `Generar APK de Mi Jornada` hace `assembleDebug` en GitHub Actions.
**Cada máquina de compilación puede usar otra clave de depuración**, por lo que dos APK
descargados de distintas ejecuciones pueden no ser compatibles como actualizaciones.
El mensaje de Android «No se instaló la aplicación» podría deberse a la firma.

**NO desinstales una aplicación que tenga datos sin una copia JSON verificada o una
copia en la nube cuya recuperación hayas comprobado.** Borrar la aplicación suele
eliminar sus registros locales. La copia automática de Android no garantiza recuperarlos.

La nueva versión incluye un exportador Android que usa el selector del sistema
(**Copias de seguridad > Exportar copia**) y guarda un JSON con todas las hojas de
servicio. Conserva el fichero fuera del móvil y comprueba que existe. La importación
requiere elegir y confirmar la sustitución de los registros.

### Firma estable para las próximas actualizaciones

El flujo `Mi Jornada - APK Android firmado` genera un APK de distribución **solo**
cuando estén configurados estos cuatro *GitHub Actions repository secrets*:

- `MJ_RELEASE_KEYSTORE_B64`: contenido de la clave de firma Java (JKS/PKCS12)
  codificado en Base64, **nunca pegado en archivos del repositorio**.
- `MJ_RELEASE_STORE_PASSWORD`: contraseña del almacén de claves.
- `MJ_RELEASE_KEY_ALIAS`: alias de la clave.
- `MJ_RELEASE_KEY_PASSWORD`: contraseña de la clave privada.

Se configuran en GitHub: **Settings > Secrets and variables > Actions**. No envíes
contraseñas ni claves privadas por chats, capturas ni incidencias. Guarda una copia
segura de tu keystore y las contraseñas: perderlas puede impedir actualizar el APK.

Para crear una clave por primera vez en un ordenador con Java instalado, por ejemplo:

```bash
keytool -genkeypair -v -keystore mi-jornada-release.jks -storetype PKCS12 -alias mi-jornada -keyalg RSA -keysize 3072 -validity 10000
base64 -w 0 mi-jornada-release.jks
```

*Nota:* en macOS no existe `base64 -w 0` en todas las versiones; se puede usar
`base64 < mi-jornada-release.jks | tr -d '\\n'`. El valor Base64 se introduce
solamente en el secreto de GitHub. Las contraseñas y la clave deben generarse
y conservarse fuera de este repositorio público.

Una vez configurada la firma, abre **Actions > Mi Jornada - APK Android firmado >
Run workflow**. Si faltan secretos o la clave es incorrecta, la acción falla sin
publicar un APK de distribución. Si termina con éxito, descarga el artefacto
`Mi-Jornada-APK-FIRMADO`. La firma se verifica con `apksigner`.

**La primera instalación del APK firmado no puede actualizar un APK firmado con
una clave debug distinta.** En ese caso hace falta migrar los datos de forma segura
antes de reemplazar la aplicación anterior. No desinstales el APK antiguo sin haber
verificado la copia. A partir del primer APK firmado con la nueva clave estable,
las futuras versiones firmadas **con esa misma clave** y un `versionCode` superior
se podrán instalar encima conservando los datos locales, siempre que no cambie
el identificador `es.mijornada.app`.

### Qué incluye actualmente el APK

Calendario y rotación, registro automático por horarios previstos, jornadas y
resumen, vacaciones y ausencias, ajustes, papelera de 30 días, varias hojas de
servicio y copia en la nube. El asistente Gemini de la web **todavía no funciona
dentro del APK**. La app **no realiza fichajes reales cuando está cerrada**.

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
