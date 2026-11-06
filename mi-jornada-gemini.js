// Asistente conversacional: Gemini Developer API mediante Firebase AI Logic.
// Nunca cambia registros. Los comandos de escritura y sus confirmaciones viven en mi-jornada-assistant.js.
// App Check se exige antes de lanzar una petición al modelo.
(function () {
  "use strict";
  const SDK = "13.2.0";
  const CONSENT_KEY = "miJornada.gemini.compartirContexto.v1";
  let model = null, appCheck = null, loading = null;

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

  async function ask(question, messages) {
    if (typeof question !== "string" || question.length > 2500) {
      throw new Error("Escribe una consulta de hasta 2500 caracteres.");
    }
    // Primero verifica la configuración. No solicita permiso si Gemini aún no puede usarse.
    const generativeModel = await getModel();
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
    const result = await generativeModel.generateContent(prompt);
    const answer = result.response.text().trim();
    if (!answer) throw new Error("Gemini no devolvió texto. Inténtalo de nuevo.");
    return answer;
  }
  window.miJornadaGemini = { ask };
})();
