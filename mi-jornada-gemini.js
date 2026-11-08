// Asistente conversacional: Gemini Developer API mediante Firebase AI Logic.
// Nunca cambia registros. Los comandos de escritura y sus confirmaciones viven en mi-jornada-assistant.js.
// App Check se exige antes de lanzar una petición al modelo.
(function () {
  "use strict";
  const SDK = "13.2.0";
  const CONSENT_KEY = "miJornada.gemini.compartirContexto.v1";
  let model = null, appCheck = null, loading = null;

  // Cada etapa tiene su propio límite; el consentimiento no consume ese tiempo.
  function withTimeout(operation, milliseconds, message, onTimeout) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message));
        if (onTimeout) onTimeout();
      }, milliseconds);
    });
    return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
  }

  function isTemporaryError(error) {
    const status = Number(error && (error.status || (error.customData && error.customData.status)));
    const message = String(error && error.message || "");
    // No reintentar cuotas (429), permisos, App Check ni tiempos agotados.
    return status === 500 || status === 503 || /\[(500|503)(?:\s|\])/.test(message);
  }

  async function generateWithRetry(generativeModel, prompt, onStatus) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      try {
        return await withTimeout(
          generativeModel.generateContent(prompt, { signal: controller.signal, timeout: 35000 }),
          35000,
          "Gemini tarda demasiado en responder. Puedes volver a intentarlo sin recargar la página.",
          () => controller.abort()
        );
      } catch (error) {
        if (error && (error.name === "AbortError" || /timeout|timed out|aborted/i.test(error.message || ""))) {
          throw new Error("Gemini tarda demasiado en responder. Puedes volver a intentarlo sin recargar la página.");
        }
        if (!isTemporaryError(error)) throw error;
        if (attempt === 2) {
          throw new Error("Gemini está saturado o temporalmente no disponible. Hemos hecho dos reintentos. Prueba dentro de unos minutos.");
        }
        const delay = 2000 * (attempt + 1);
        if (typeof onStatus === "function") {
          onStatus("Gemini está ocupado. Reintento " + (attempt + 1) + " de 2 en " + delay / 1000 + " segundos…");
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        if (typeof onStatus === "function") onStatus("Consultando Gemini… (reintento " + (attempt + 1) + " de 2)");
      }
    }
  }

  function localDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-");
  }
  function contextFromCalendar() {
    const bridge = window.miJornadaBridge;
    if (!bridge) return "Calendario no disponible.";
    const today = new Date();
    const info = bridge.read();
    const days = [];
    // Únicamente turnos de una ventana corta. No se mandan notas ni copias completas.
    for (let i = -7; i <= 21; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12);
      const key = localDate(date);
      try {
        const e = bridge.get(key);
        days.push(key + ": " + (e.kind === "rest" ? "descanso" :
          (e.shift === "morning" ? "mañana" : "tarde") +
          (e.start && e.end ? " (" + e.start + "-" + e.end + ")" : "")));
      } catch (_) {}
    }
    let worked = 0, owed = 0, extra = 0;
    const prefix = localDate(today).slice(0, 7);
    for (const [day, e] of Object.entries(info.data || {})) {
      if (!day.startsWith(prefix) || !e || e.kind !== "work") continue;
      worked++;
      owed += Math.round((Number(e.owed) || 0) * 60);
      extra += Number(e.extraMins) || 0;
    }
    return "Fecha local: " + localDate(today) +
      "\nTurnos aproximados (pueden existir excepciones manuales):\n" + days.join("\n") +
      "\nEste mes: " + worked + " jornadas registradas; " + owed +
      " minutos pendientes por descanso; " + extra + " minutos extra registrados.";
  }

  async function getModel() {
    if (model) return model;
    if (loading) return loading;
    loading = (async () => {
      const config = (await import("./firebase-web-config.js?v=2")).default;
      if (!config.appCheckSiteKey) {
        throw new Error("Falta registrar Mi Jornada Web en Firebase App Check y añadir su clave pública de reCAPTCHA Enterprise. Tus consultas básicas siguen funcionando.");
      }
      const [firebase, ai, check] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/" + SDK + "/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/" + SDK + "/firebase-ai.js"),
        import("https://www.gstatic.com/firebasejs/" + SDK + "/firebase-app-check.js")
      ]);
      const app = firebase.getApps().length ? firebase.getApp() : firebase.initializeApp(config);
      if (!appCheck) {
        appCheck = check.initializeAppCheck(app, {
          provider: new check.ReCaptchaEnterpriseProvider(config.appCheckSiteKey),
          isTokenAutoRefreshEnabled: true
        });
      }
      // Si App Check no puede emitir un token válido, no hacer la petición a Gemini.
      await check.getToken(appCheck);
      const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
      model = ai.getGenerativeModel(backend, { model: "gemini-3.8-flash" });
      return model;
    })();
    try { return await loading; } finally { loading = null; }
  }

  async function ask(question, messages, onStatus) {
    if (typeof question !== "string" || question.length > 2500) {
      throw new Error("Escribe una consulta de hasta 2500 caracteres.");
    }
    // Primero verifica la configuración. No solicita permiso si Gemini aún no puede usarse.
    const generativeModel = await withTimeout(getModel(), 25000,
      "No se ha podido completar la conexión segura con Gemini a tiempo. Puedes volver a intentarlo sin recargar la página.");
    if (localStorage.getItem(CONSENT_KEY) !== "si") {
      const allowed = confirm("Para responder, Gemini (Google) recibirá tu pregunta, los últimos mensajes y un resumen de turnos y horas. No se envían tus notas ni una copia completa del calendario. ¿Lo autorizas?");
      if (!allowed) throw new Error("Has cancelado el envío a Gemini. Tus datos no se han enviado.");
      localStorage.setItem(CONSENT_KEY, "si");
    }
    const recents = (Array.isArray(messages) ? messages : []).slice(-8)
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .map(m => (m.role === "user" ? "Usuario" : "Asistente") + ": " + String(m.text || "").slice(0, 500))
      .join("\n");
    const prompt = [
      "Eres el asistente de Mi Jornada, aplicación personal de registro de jornadas en España.",
      "Responde en español, claro y breve. Usa el contexto solo si es pertinente.",
      "El calendario es orientativo: si no hay registro o falta un dato, dilo. No inventes horas ni registros.",
      "IMPORTANTE: No puedes guardar, modificar, eliminar ni aprobar ninguna jornada, vacaciones o dato. Nunca digas que has realizado cambios. Para hacer cambios, indica que utilice las funciones locales y confirme.",
      "No pidas contraseñas, códigos de acceso ni datos bancarios.",
      "Contexto mínimo del calendario:\n" + contextFromCalendar(),
      "Conversación reciente:\n" + recents,
      "Consulta actual:\n" + question
    ].join("\n\n");
    const result = await generateWithRetry(generativeModel, prompt, onStatus);
    const answer = result.response.text().trim();
    if (!answer) throw new Error("Gemini no devolvió texto. Inténtalo de nuevo.");
    return answer;
  }
  window.miJornadaGemini = { ask };
})();
