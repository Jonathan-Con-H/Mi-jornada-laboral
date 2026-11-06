# Mi Jornada — activar la IA real (pendiente de desplegar)

Esta implementación está en una rama de revisión y no modifica las jornadas ya guardadas.

## Requisitos

- Firebase con plan Blaze y facturación habilitada para desplegar Cloud Functions. Puede generar costes.
- Clave de OpenAI API con facturación propia. La suscripción ChatGPT Plus no incluye la API.
- Configurar un límite mensual bajo de gasto en el proveedor antes de usarla.
- Nunca poner claves privadas en JavaScript, GitHub Pages ni archivos de GitHub.

## Pasos para activar desde un terminal seguro

1. Consultar en Firebase Authentication el UID de tu usuario.
2. Instalar Firebase CLI con: npm install -g firebase-tools
3. Iniciar sesión: firebase login
4. Clonar el repositorio y seleccionar la rama feature/asistente-ia-completo.
5. Instalar dependencias: npm --prefix functions install
6. Guardar secreto: firebase functions:secrets:set OPENAI_API_KEY
7. Guardar secreto: firebase functions:secrets:set MJ_OWNER_UID
8. Desplegar: firebase deploy --only functions:miJornadaAI --project mi-jornada-laboral-67c45
9. Probar el servicio y fusionar la rama para publicar la nueva interfaz en GitHub Pages.

No se deben desplegar reglas Firestore en esta fase, pues las actuales para respaldos continúan sin cambios.

## Funciones incluidas

- Chat con un modelo de IA real mediante la API Responses, no respuestas prefijadas.
- Historial de conversaciones en Firestore, disponible en dispositivos con la misma cuenta.
- Borrar conversaciones y editar, añadir o borrar recuerdos de IA.
- Texto, dictado si el navegador lo admite y lectura en voz alta opcional.
- Panel flotante movible, ampliable, con acceso desde el menú de Mi Jornada.
- Consultar turnos y registros recientes; proponer ediciones de jornadas, siempre con confirmación.
- Autenticación restringida por UID; límites de 120 preguntas diarias y 2 instancias máximas.
- El asistente no escribe jamás directamente en las copias de seguridad de jornadas.

## Privacidad y límites actuales

Las conversaciones y datos laborales pertinentes se envían al proveedor del modelo al consultar.
El modelo usa store:false en Responses; siguen aplicándose las políticas de tratamiento del proveedor.
Los chats residen en users/{uid}/assistantChats y la memoria en users/{uid}/assistant/memory,
a través de la función servidor (no son accesibles directamente por las reglas Firestore web).

Las vacaciones, bajas, permisos, papelera y otros registros especiales todavía no están implementados
en el calendario original. La IA no debe decir que los guardó.
El reconocimiento de voz y el habla dependen del navegador, no constituyen voz en tiempo real.
La IA necesita revisión humana antes de publicarse a otros usuarios.

## Pruebas recomendadas

- Consultar el turno de mañana y cotejarlo con el calendario.
- Proponer treinta minutos extra y cancelar: verificar que no cambian los datos.
- Confirmar una propuesta: verificar que el registro local cambia y Mi nube se sincroniza.
- Guardar un recuerdo y abrirlo en otro dispositivo.
- Crear, recuperar y borrar una conversación.
- Intentar entrar desde otro UID y comprobar el bloqueo.
- Conservar una copia JSON antes de las pruebas.
