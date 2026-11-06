# Mi Jornada — asistente Gemini gratuito (preparación)

Esta implementación es una propuesta en una rama de GitHub. **No está desplegada ni probada contra Firebase.**
La web existente y los registros sincronizados de jornadas no se modifican hasta que se apruebe.

## Lo que aprovecha

- Gemini 3.5 Flash-Lite a través de Firebase AI Logic usando **Gemini Developer API**.
- La modalidad **Spark** de Firebase, sin vincular facturación, cuando el modelo y cuota gratuita estén disponibles.
- El acceso a Gemini desde una app propia es independiente de la suscripción **Gemini Pro**.
- No requiere claves Gemini secretas en GitHub ni desplegar Cloud Functions.
- La cuota gratuita es limitada. El servicio puede devolver error de cuota (429).

## Requisito obligatorio: Firebase App Check

Desde el 2 de noviembre de 2026 Google requiere que Firebase AI Logic use App Check.
El SDK web implementado usa **reCAPTCHA Enterprise**.

1. En Firebase console selecciona el proyecto mi-jornada-laboral-67c45.
2. Comprueba que el plan sea **Spark** (no cambies el plan automáticamente).
3. Abre **Servicios de IA > AI Logic** y elige **Gemini Developer API**, sin activar pagos.
4. En Google Cloud crea una clave de sitio reCAPTCHA Enterprise de tipo web para el dominio:
   jonathan-con-h.github.io
5. En Firebase **Seguridad > App Check**, registra tu app web con esa clave de sitio y activa la protección de Firebase AI Logic.
6. Copia **solo la clave de sitio pública** en firebase-appcheck-config.js, donde pone siteKey:"".
7. Conserva las claves secretas o de administrador exclusivamente en las consolas del proveedor.

No actives ni pruebes el asistente en la web pública antes de completar App Check.
Los proveedores reCAPTCHA Enterprise tienen cuotas gratuitas sujetas a condiciones.

## Memoria e historial en la nube

Este cambio añade reglas de Firestore independientes para:
- users/{uid}/assistantChats/{chatId}: conversaciones
- users/{uid}/assistant/memory: recuerdos editables

Es necesario publicar el archivo firestore.rules de esta rama, **revisando antes** las reglas vigentes
en la consola de Firebase. Las reglas existentes de jornadas en users/{uid}/backups permanecen.

Para evitar accidentes, exporta un JSON de jornadas antes de cualquier despliegue.
Las nuevas reglas no alteran documentos existentes de Firestore.

## Comportamiento

- Chat con contexto de turnos y registros recientes, con IA real y respuestas JSON.
- Dictado de voz y lectura en voz alta si lo permite el navegador.
- Memoria editable y eliminable, historial recuperable en dispositivos con la misma cuenta.
- El asistente SOLO PROPONE cambios. La actualización de una jornada requiere pulsar Confirmar.
- Las jornadas se siguen guardando mediante Mi Jornada; la IA no escribe directamente en la copia de nube.
- Vacaciones, permisos, bajas y papelera requieren ampliar antes los registros de la aplicación original;
  no se deben anunciar como funcionalidades ya implementadas.

## Privacidad y riesgos

- Al usar Gemini se envía al proveedor parte de tus jornadas recientes, notas y conversaciones,
  por lo que debes evitar incluir información sensible. En el nivel gratuito Google puede usar
  contenido de solicitudes para mejorar sus servicios, según sus políticas.
- El código requiere sesión Firebase para habilitar la interfaz, y las reglas limitan
  el historial y la memoria al titular de cada cuenta. **App Check no equivale a restricción de un solo usuario**:
  otras personas que utilicen legítimamente la web podrían consumir cuota del mismo proyecto.
- Controla cuota/uso en Firebase y AI Studio. La función aún no incorpora límites de cuota
  específicos por usuario más allá de los que administra Firebase.

## Pruebas tras configurar

1. Verifica que «Mi nube» dice que tus jornadas están sincronizadas.
2. Pregunta «¿Qué turno tengo mañana?» y contrástalo con el calendario.
3. Pide una modificación de prueba y pulsa Cancelar: datos sin cambios.
4. Repite y pulsa Confirmar: comprobar cambios locales y en la nube.
5. Crea, edita y borra un recuerdo y abre Mi Jornada desde otro navegador.
6. Abre un chat anterior y comprueba la persistencia.
7. Prueba sin iniciar sesión: la interfaz debe bloquear el envío.
8. Si hay error 403, revisa App Check; si hay 429, revisa la cuota gratuita.

Documentación:
https://firebase.google.com/docs/ai-logic/get-started
https://firebase.google.com/docs/ai-logic/app-check
https://firebase.google.com/docs/ai-logic/pricing
