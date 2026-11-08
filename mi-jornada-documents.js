/* Documentos laborales: bóveda local (IndexedDB). No se envían archivos a la nube. */
(function () {
  "use strict";
  const DB_NAME = "miJornadaDocumentosV1", STORE = "documentos", LIMIT = 12 * 1024 * 1024;
  const types = {nomina:"Nómina", justificante:"Justificante", otro:"Otro documento"};
  const select = id => document.getElementById(id);
  const menu = document.getElementById("mjMainMenu");
  if (!menu || !window.indexedDB) return;

  const styles = document.createElement("style");
  styles.textContent = `
  #mj-doc-overlay[hidden]{display:none!important}
  #mj-doc-overlay{position:fixed;inset:0;z-index:210;background:#03121ccc;display:grid;place-items:center;padding:12px}
  #mj-doc-panel{box-sizing:border-box;width:min(680px,100%);max-height:93dvh;overflow:auto;background:#10283b;color:#f5f9ff;border:1px solid #3a718f;border-radius:18px;padding:20px;font-family:system-ui;box-shadow:0 16px 70px #0008}
  #mj-doc-panel h2{margin:0}#mj-doc-panel p{color:#c0d5e5;line-height:1.4}
  #mj-doc-panel label{display:block;font-size:.9rem;font-weight:650;margin:9px 0}
  #mj-doc-panel input,#mj-doc-panel select,#mj-doc-panel textarea{display:block;width:100%;box-sizing:border-box;background:#071c2d;color:#fff;border:1px solid #52748b;border-radius:9px;padding:10px;margin-top:5px;font:inherit}
  #mj-doc-panel button{background:#176b91;color:white;padding:9px 12px;border:0;border-radius:9px;font:inherit;cursor:pointer}
  #mj-doc-panel button:focus-visible{outline:3px solid #fed36a}#mj-doc-panel button.secondary{background:#2d4d61}
  #mj-doc-panel .mj-doc-head{display:flex;gap:10px;align-items:center;justify-content:space-between}
  #mj-doc-panel .mj-doc-fields{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px}
  #mj-doc-panel .mj-doc-full{grid-column:1/-1}#mj-doc-panel .mj-doc-item{padding:12px 0;border-bottom:1px solid #36546a}
  #mj-doc-panel .mj-doc-item strong{overflow-wrap:anywhere}#mj-doc-panel .mj-doc-actions{display:flex;gap:8px;margin-top:8px}
  #mj-doc-panel #mj-doc-status{min-height:1.2em;white-space:pre-wrap}
  @media(max-width:480px){#mj-doc-panel .mj-doc-fields{grid-template-columns:1fr}#mj-doc-panel{padding:14px}}
  `;
  document.head.appendChild(styles);

  const button = document.createElement("button");
  button.type = "button"; button.className = "mj-menu-btn"; button.dataset.mjGo = "documents";
  button.innerHTML = '<svg class="mj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8 M8 16h8"/></svg><span>Documentos</span>';
  const before = menu.querySelector('[data-mj-go="ai"]') || menu.querySelector('[data-mj-go="settings"]');
  if (before) before.before(button); else menu.appendChild(button);

  const overlay = document.createElement("div");
  overlay.id = "mj-doc-overlay"; overlay.hidden = true;
  overlay.innerHTML = `
    <div id="mj-doc-panel" role="dialog" aria-modal="true" aria-labelledby="mj-doc-title">
      <div class="mj-doc-head"><h2 id="mj-doc-title">📁 Nóminas y justificantes</h2><button type="button" class="secondary" id="mj-doc-close">Cerrar</button></div>
      <p>Los documentos se guardan solo en este dispositivo. No se suben a Firebase ni forman parte de la copia JSON. Exporta una copia antes de desinstalar la app o borrar sus datos.</p>
      <form id="mj-doc-form">
        <div class="mj-doc-fields">
          <label>Tipo<select id="mj-doc-type" required><option value="nomina">Nómina</option><option value="justificante">Justificante</option><option value="otro">Otro documento</option></select></label>
          <label>Mes / año<input id="mj-doc-month" type="month" required></label>
          <label class="mj-doc-full">Archivo PDF, JPG o PNG (máx. 12 MB)<input id="mj-doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></label>
          <label class="mj-doc-full">Descripción opcional<input id="mj-doc-note" type="text" maxlength="140" placeholder="Ej. Nómina de noviembre"></label>
        </div>
        <button type="submit" id="mj-doc-save">Guardar documento</button>
      </form>
      <p id="mj-doc-status" role="status" aria-live="polite"></p>
      <label>Mostrar<select id="mj-doc-filter"><option value="todos">Todos los documentos</option><option value="nomina">Nóminas</option><option value="justificante">Justificantes</option><option value="otro">Otros</option></select></label>
      <div id="mj-doc-items" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(overlay);
  const status = message => { select("mj-doc-status").textContent = message; };
  const close = () => { overlay.hidden = true; button.focus(); };
  const open = () => {
    document.querySelectorAll(".mj-menu-btn").forEach(el => el.classList.remove("active"));
    button.classList.add("active");
    const sidebar = document.querySelector(".mj-sidebar");
    if (sidebar) sidebar.classList.remove("is-open");
    overlay.hidden = false; select("mj-doc-close").focus();
    refresh().catch(() => status("No se pudo leer el almacenamiento local."));
  };
  button.addEventListener("click", open);
  select("mj-doc-close").addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.hidden) close(); });
  window.addEventListener("mi-jornada:open-tool", event => { if (event.detail && event.detail.page === "documents") open(); });

  function database() {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath:"id",autoIncrement:true});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Almacenamiento ocupado"));
    });
  }
  async function query(mode, operation) {
    const db = await database();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE,mode), store = tx.objectStore(STORE);
      let result;
      const req = operation(store);
      req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  const all = () => query("readonly", s => s.getAll());
  const get = id => query("readonly", s => s.get(id));
  const remove = id => query("readwrite", s => s.delete(id));
  const put = obj => query("readwrite", s => s.add(obj));
  function allowed(file) {
    const name = file.name.toLowerCase();
    const ext = name.split(".").pop();
    return ((ext === "pdf" && (!file.type || file.type === "application/pdf"))
      || ((ext === "jpg" || ext === "jpeg") && (!file.type || file.type === "image/jpeg"))
      || (ext === "png" && (!file.type || file.type === "image/png")));
  }
  const mimeFromName = name => /\.pdf$/i.test(name) ? "application/pdf" : /\.png$/i.test(name) ? "image/png" : "image/jpeg";
  select("mj-doc-month").value = new Date().toISOString().slice(0,7);
  select("mj-doc-form").addEventListener("submit", async event => {
    event.preventDefault();
    const file = select("mj-doc-file").files[0];
    if (!file || !allowed(file) || file.size === 0 || file.size > LIMIT) {
      status("Elige un PDF, JPG o PNG válido de hasta 12 MB."); return;
    }
    const saveButton = select("mj-doc-save");
    saveButton.disabled = true; status("Guardando en este dispositivo...");
    try {
      await put({kind:select("mj-doc-type").value,month:select("mj-doc-month").value,
        name:file.name,note:select("mj-doc-note").value.trim(),mime:mimeFromName(file.name),
        size:file.size,createdAt:Date.now(),file:file});
      select("mj-doc-file").value = ""; select("mj-doc-note").value = "";
      status("Documento guardado. Exporta una copia si quieres conservarlo fuera de esta app.");
      await refresh();
    } catch (err) { status("No se pudo guardar. Comprueba el espacio disponible."); }
    finally { saveButton.disabled = false; }
  });
  select("mj-doc-filter").addEventListener("change", () => refresh().catch(() => status("No se pudo listar.")));
  async function exportDoc(entry) {
    if (!entry || !entry.file) { status("No se encontró este archivo."); return; }
    if (window.AndroidDocuments && typeof window.AndroidDocuments.saveFile === "function") {
      if (entry.size > LIMIT) { status("El documento es demasiado grande."); return; }
      status("Abriendo el selector para exportar el archivo...");
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const payload = result.split(",")[1];
        if (!payload) { status("No se pudo preparar el archivo."); return; }
        window.AndroidDocuments.saveFile(entry.name, entry.mime, payload);
      };
      reader.onerror = () => status("No se pudo preparar el archivo.");
      reader.readAsDataURL(entry.file);
    } else {
      const url = URL.createObjectURL(entry.file);
      const link = document.createElement("a");
      link.href = url; link.download = entry.name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status("Descarga solicitada. Comprueba que se haya guardado.");
    }
  }
  window.miJornadaOnDocument = payload => {
    try { const obj = typeof payload === "string" ? JSON.parse(payload) : payload;
      status(obj.message || (obj.ok ? "Exportado." : "No se pudo exportar."));
    } catch (e) { status("No se pudo confirmar la exportación."); }
  };
  async function refresh() {
    const items = select("mj-doc-items"), filter = select("mj-doc-filter").value;
    const rows = (await all()).filter(r => filter === "todos" || r.kind === filter)
      .sort((a,b) => b.month.localeCompare(a.month) || b.createdAt - a.createdAt);
    items.replaceChildren();
    if (!rows.length) { const empty = document.createElement("p"); empty.textContent = "Todavía no hay documentos en esta categoría."; items.appendChild(empty); return; }
    for (const entry of rows) {
      const row = document.createElement("div"); row.className = "mj-doc-item";
      const label = document.createElement("strong");
      label.textContent = (types[entry.kind] || "Documento") + " · " + entry.month + " · " + entry.name;
      const info = document.createElement("div");
      info.textContent = (entry.note ? entry.note + " · " : "") + (entry.size / 1024 / 1024).toFixed(2) + " MB";
      const actions = document.createElement("div"); actions.className = "mj-doc-actions";
      const exportBtn = document.createElement("button"); exportBtn.type = "button"; exportBtn.textContent = "Guardar copia";
      exportBtn.addEventListener("click", async () => { try { await exportDoc(await get(entry.id)); } catch (e) { status("No se pudo recuperar el archivo."); } });
      const delBtn = document.createElement("button"); delBtn.type = "button"; delBtn.className = "secondary"; delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar definitivamente «" + entry.name + "» de este dispositivo?")) return;
        try { await remove(entry.id); status("Documento eliminado."); await refresh(); }
        catch (e) { status("No se pudo eliminar."); }
      });
      actions.append(exportBtn,delBtn); row.append(label,info,actions); items.appendChild(row);
    }
  }
})();