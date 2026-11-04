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
