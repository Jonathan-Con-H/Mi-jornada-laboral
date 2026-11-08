/* Documentos de Mi Jornada (solo Android). No altera registros, copias JSON ni Firestore. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const native = window.AndroidDocuments;
  const tab = document.querySelector('button.tab[data-tab="documents"]');
  const company = byId("docCompany");
  const status = byId("docStatus");
  const listing = byId("docList");
  let docs = [];

  function report(message, error) {
    status.textContent = message;
    status.classList.toggle("mj-doc-error", !!error);
  }

  function companies() {
    // Hoja activa y anteriores. No crea ni cambia hojas ni registros laborales.
    const state = typeof sheetsState !== "undefined" ? sheetsState : null;
    const previous = company.value;
    company.replaceChildren();
    if (state && Array.isArray(state.items)) {
      state.items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        company.append(opt);
      });
    }
    if (Array.from(company.options).some(o => o.value === previous)) company.value = previous;
    else if (state && state.activeId) company.value = state.activeId;
  }

  function currentCompany() {
    const state = typeof sheetsState !== "undefined" ? sheetsState : null;
    return state && state.items.find(item => item.id === company.value);
  }

  function refresh() {
    companies();
    if (!native || typeof native.listDocuments !== "function") {
      report("Los archivos privados se gestionan en la app Android. Esta función no está disponible en el navegador.", true);
      return;
    }
    native.listDocuments();
  }

  function upload(kind) {
    const item = currentCompany();
    if (!item) { report("Selecciona una hoja de servicio.", true); return; }
    const month = byId("docPayrollMonth").value;
    const day = byId("docJustDay").value;
    if (kind === "payroll" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      report("Elige el mes de la nómina.", true); return;
    }
    if (kind === "justification" && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      report("Elige el día al que corresponde el justificante.", true); return;
    }
    if (!native || typeof native.importDocument !== "function") {
      report("Esta función necesita una versión Android actualizada.", true); return;
    }
    report("Elige un PDF o una fotografía en el selector de Android.");
    native.importDocument(kind, item.id, item.name, month, day);
  }

  function action(text, className, fn) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.addEventListener("click", fn);
    return button;
  }

  function render() {
    listing.replaceChildren();
    if (!docs.length) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Todavía no hay nóminas ni justificantes guardados.";
      listing.append(message);
      return;
    }
    docs.sort((a, b) => (a.company || "").localeCompare(b.company || "", "es") ||
      (b.period || "").localeCompare(a.period || "") ||
      (b.addedAt || 0) - (a.addedAt || 0));
    let group = "";
    docs.forEach(doc => {
      const current = (doc.company || "Empresa sin nombre") + " · " + (doc.period || "Sin fecha");
      if (group !== current) {
        group = current;
        const h3 = document.createElement("h3");
        h3.className = "mj-doc-group";
        h3.textContent = group;
        listing.append(h3);
      }
      const row = document.createElement("div");
      row.className = "mj-doc-row";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = (doc.kind === "payroll" ? "Nómina · " : "Justificante · ") + (doc.name || "Archivo");
      const meta = document.createElement("p");
      meta.className = "muted";
      const size = Number.isFinite(Number(doc.size)) ? (Number(doc.size) / 1024 / 1024).toFixed(2) + " MB" : "";
      meta.textContent = (doc.day ? "Día: " + doc.day + " · " : "") + size;
      info.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "mj-doc-actions";
      actions.append(
        action("Abrir", "secondary", () => native && native.openDocument(String(doc.id))),
        action("Eliminar", "danger", () => {
          if (confirm("¿Eliminar definitivamente «" + (doc.name || "este archivo") + "»? No afecta a las jornadas.")) {
            native.deleteDocument(String(doc.id));
          }
        })
      );
      row.append(info, actions);
      listing.append(row);
    });
  }

  window.miJornadaOnDocuments = function (raw) {
    let event;
    try { event = JSON.parse(raw); }
    catch (_) { report("No se pudo interpretar la respuesta de Android.", true); return; }
    if (event.type === "list" && Array.isArray(event.items)) {
      docs = event.items;
      render();
    } else if (event.type === "imported" || event.type === "deleted" || event.type === "cancelled") {
      report(event.message || "Operación terminada.", false);
    } else if (event.type === "error") {
      report(event.message || "No se pudo gestionar el documento.", true);
    }
  };

  byId("docPayrollBtn").addEventListener("click", () => upload("payroll"));
  byId("docJustBtn").addEventListener("click", () => upload("justification"));
  byId("docRefresh").addEventListener("click", refresh);
  tab.addEventListener("click", refresh);

  // Atajo directo desde el registro de una jornada a su justificante.
  const entryHeader = byId("mjEntryPanel");
  if (entryHeader) {
    const target = entryHeader.querySelector(".row");
    if (target) {
      const attach = action("📎 Justificante", "secondary", () => {
        tab.click();
        if (typeof selected !== "undefined") byId("docJustDay").value = selected;
        byId("docJustDay").focus({preventScroll: true});
      });
      attach.id = "mjDayJustification";
      target.append(attach);
    }
  }

  const now = new Date();
  byId("docPayrollMonth").value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  byId("docJustDay").value = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  companies();
})();
