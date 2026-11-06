/* Mi Jornada: diseño horizontal inspirado en la referencia elegida.
   Conserva el modelo de datos original (miJornada.v1 y miJornada.auto.v1).
   Los elementos visibles reflejan datos guardados, nunca cifras de ejemplo. */
(function () {
  "use strict";
  const p = {
    calendar:"M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M8 14h2 M14 14h2 M8 18h2",
    home:"M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z",
    clock:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l4 2",
    bars:"M5 20v-6 M10 20V9 M15 20V5 M20 20v-10",
    file:"M6 3h8l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h6",
    settings:"M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    cloud:"M5 18h14a4 4 0 0 0 0-8h-1a6 6 0 0 0-11.6-1.4A5 5 0 0 0 5 18z",
    bell:"M6 17h12l-2-3V9a4 4 0 0 0-8 0v5z M10 20h4",
    plus:"M12 4v16 M4 12h16",
    cup:"M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8 M16 9h2a3 3 0 0 1 0 6h-2 M4 22h15",
    clipboard:"M8 4h8v3H8z M5 6H3v15h18V6h-2 M8 13l2 2 5-5",
    layers:"M12 3 2 8l10 5 10-5-10-5z M3 13l9 5 9-5 M3 18l9 4 9-4",
    notes:"M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4",
    download:"M12 3v12 M7 10l5 5 5-5 M5 19h14"
  };
  const icon = name => '<svg class="mj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (p[name] || p.calendar) + '"></path></svg>';
  const byId = id => document.getElementById(id);
  const main = document.querySelector("main.wrap");
  const cv = byId("calendarView");
  if (!main || !cv || !byId("calendar") || cv.children.length < 3) return;
  const calPanel = cv.children[0], autoPanel = cv.children[1], entryPanel = cv.children[2];
  calPanel.classList.add("mj-calendar-panel");
  const oldLegend = calPanel.querySelector(".legend");
  if (oldLegend) oldLegend.remove();

  const top = document.createElement("header");
  top.className = "mj-top";
  top.innerHTML =
    '<div class="mj-brand">' + icon("calendar") + '<span>Mi Jornada</span></div>' +
    '<div class="mj-top-right"><div class="mj-sync" title="Los datos se guardan en este navegador; la sincronización web en la nube aún no está conectada">' +
    icon("cloud") + '<span>Guardado localmente</span></div>' +
    '<span class="mj-top-button mj-top-decor" title="Notificaciones: pendiente de implementar">' + icon("bell") + '</span>' +
    '<button type="button" class="mj-top-button" data-mj-go="settings" aria-label="Abrir ajustes">' + icon("settings") + '</button></div>';
  document.body.insertBefore(top, main);

  const summary = document.createElement("section");
  summary.className = "mj-card";
  summary.setAttribute("aria-label", "Resumen del mes");
  summary.innerHTML =
    '<h2 class="mj-card-title">' + icon("bars") + '<span>Resumen del mes</span></h2>' +
    '<p class="mj-card-sub" id="mjMonthName"></p>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + icon("calendar") + 'Días trabajados</span><strong id="mjDays">0</strong></div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + icon("clock") + 'Horas trabajadas</span><strong id="mjHours">0:00</strong></div>' +
    '<div class="mj-metric extra"><span class="mj-metric-label">' + icon("layers") + 'Horas extras</span><strong id="mjExtra">0:00</strong></div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + icon("cup") + '<span>Descanso (30 min/día)<small>Tiempo debido este mes</small></span></span><strong id="mjRest">0:00</strong></div>' +
    '<div class="mj-metric owed"><span class="mj-metric-label">' + icon("clipboard") + '<span>Horas que se deben<small>Acumuladas hasta hoy</small></span></span><strong id="mjOwed">0:00</strong></div>';
  const notesCard = document.createElement("section");
  notesCard.className = "mj-card";
  notesCard.innerHTML = '<h2 class="mj-card-title">' + icon("notes") + '<span>Notas del mes</span></h2><div id="mjNotes"></div>';
  const register = document.createElement("button");
  register.type = "button";
  register.className = "mj-register";
  register.innerHTML = icon("plus") + "<span>Registrar jornada</span>";
  register.addEventListener("click", function () { go("register"); });
  const right = document.createElement("aside");
  right.className = "mj-right";
  right.setAttribute("aria-label", "Resumen y acciones");
  right.append(summary, notesCard, register);

  const dash = document.createElement("div");
  dash.className = "mj-dashboard";
  dash.append(calPanel, right);
  const legend = document.createElement("section");
  legend.className = "mj-legend";
  legend.setAttribute("aria-label", "Significado de los colores");
  legend.innerHTML =
    '<span class="mj-legend-item"><i class="mj-legend-square"></i>Mañana (06:00–14:00)</span>' +
    '<span class="mj-legend-item"><i class="mj-legend-square teal"></i>Tarde (14:00–22:00)</span>' +
    '<span class="mj-legend-item"><i class="mj-legend-square vacation"></i>Vacaciones</span>' +
    '<span class="mj-legend-item"><i class="mj-legend-square holiday"></i>Festivo</span>' +
    '<span class="mj-legend-item"><b class="mj-legend-number">12</b>Horas extras</span>' +
    '<span class="mj-legend-item"><b class="mj-legend-number recorded">12</b>Jornada registrada</span>';
  // La leyenda de vacaciones es solo explicativa; su edición queda para otra versión.
  const workbench = document.createElement("section");
  workbench.className = "mj-workbench";
  workbench.id = "mjWorkbench";
  const editorTitle = document.createElement("div");
  editorTitle.className = "mj-workbench-header";
  editorTitle.innerHTML = '<h2 id="mjWorkbenchTitle">Registrar jornada</h2><button class="mj-close" type="button" id="mjCloseEditor">Cerrar ✕</button>';
  workbench.append(editorTitle, entryPanel, autoPanel);
  cv.append(dash, legend, workbench);
  byId("mjCloseEditor").addEventListener("click", function () {workbench.classList.remove("open");});

  const nav = document.createElement("nav");
  nav.className = "mj-bottom";
  nav.setAttribute("aria-label", "Navegación principal");
  const items = [["calendar","home","Calendario"],["register","clock","Jornadas"],["summary","bars","Resumen"],["reports","file","Informes"],["settings","settings","Ajustes"]];
  nav.innerHTML = items.map(function (v) {
    return '<button type="button" class="mj-nav-btn' + (v[0] === "calendar" ? " active" : "") + '" data-mj-go="' + v[0] + '">' + icon(v[1]) + '<span>' + v[2] + '</span></button>';
  }).join("");
  document.body.append(nav);
  document.querySelectorAll("[data-mj-go]").forEach(function (b) {
    b.addEventListener("click", function () { go(b.dataset.mjGo); });
  });
  function tab(name) {
    const t = document.querySelector('button.tab[data-tab="' + name + '"]');
    if (t) t.click();
  }
  function scrollTo(el) {
    if (el && el.scrollIntoView) el.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function go(page) {
    document.querySelectorAll(".mj-nav-btn").forEach(function (b) {b.classList.toggle("active",b.dataset.mjGo===page);});
    if (page === "summary" || page === "reports") {
      tab("summary");
      scrollTo(byId("summaryView"));
      return;
    }
    tab("calendar");
    if (page === "register" || page === "settings") {
      workbench.classList.add("open");
      byId("mjWorkbenchTitle").textContent = page === "settings" ? "Ajustes de registro automático" : "Registrar o modificar jornada";
      scrollTo(page === "settings" ? autoPanel : workbench);
    } else {
      workbench.classList.remove("open");
      scrollTo(dash);
    }
  }

  function hhmm(n) {
    const value = Math.round(Number(n) || 0);
    const abs = Math.abs(value);
    return (value < 0 ? "−" : "") + Math.floor(abs/60) + ":" + String(abs%60).padStart(2,"0");
  }
  const national = new Set(["01-01","01-06","05-01","08-15","10-12","11-01","12-06","12-08","12-25"]);
  function decorateCalendar() {
    const first = new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
    const offset = (first.getDay()+6)%7;
    const days = new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate();
    const buttons = byId("calendar").querySelectorAll("button.day:not(.empty)");
    buttons.forEach(function(button,i) {
      if(i>=days) return;
      const key = iso(new Date(viewDate.getFullYear(),viewDate.getMonth(),i+1));
      const d = entry(key);
      button.classList.toggle("has-extra",Number(d.extraMins)>0);
      button.classList.toggle("holiday",d.kind==="work"&&national.has(key.slice(5)));
      const desc = d.kind==="rest" ? "día libre" : d.shift==="morning" ? "mañana" : "tarde";
      button.setAttribute("aria-label",(i+1)+" de "+monthLabel(viewDate)+": "+desc+
        (Number(d.extraMins)>0?", horas extras":"")+(data[key]?", registrado":""));
    });
    const m = viewDate.toLocaleDateString("es-ES",{month:"long",year:"numeric"});
    byId("monthTitle").textContent = m.charAt(0).toUpperCase()+m.slice(1);
  }
  function monthMatches(key) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const d=parse(key);
    return d.getFullYear()===viewDate.getFullYear()&&d.getMonth()===viewDate.getMonth();
  }
  function refreshDashboard() {
    if(!byId("mjDays")) return;
    let days=0, mins=0, extras=0, owedMonth=0, owedAll=0;
    const todayKey=today();
    Object.keys(data).forEach(function (key) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const item=entry(key);
      if(item.kind!=="work") return;
      if(key<=todayKey) owedAll+=Math.round((Number(item.owed)||0)*60);
      if(!monthMatches(key)) return;
      days++;
      mins+=Math.round(elapsedHours(item,key)*60);
      extras+=Number(item.extraMins)||0;
      owedMonth+=Math.round((Number(item.owed)||0)*60);
    });
    byId("mjDays").textContent=String(days);
    byId("mjHours").textContent=hhmm(mins);
    byId("mjExtra").textContent=hhmm(extras);
    byId("mjRest").textContent=hhmm(owedMonth);
    byId("mjOwed").textContent=hhmm(owedAll);
    byId("mjMonthName").textContent=monthLabel(viewDate);
    const rows=[];
    Object.keys(data).filter(monthMatches).sort().forEach(function (key) {
      const item=entry(key);
      const short=parse(key).toLocaleDateString("es-ES",{day:"numeric",month:"short"});
      if(Number(item.extraMins)>0) rows.push({key,text:short+": Horas extras (+"+hhmm(item.extraMins)+")"});
      if(item.notes&&String(item.notes).trim()) rows.push({key,text:short+": "+String(item.notes).trim()});
    });
    const root=byId("mjNotes");
    root.replaceChildren();
    if(!rows.length){
      const empty=document.createElement("p");
      empty.className="mj-empty-notes";
      empty.textContent="No hay notas ni horas extras anotadas este mes.";
      root.append(empty);
      return;
    }
    const ul=document.createElement("ul");
    ul.className="mj-notes-list";
    rows.slice(0,8).forEach(function (item) {
      const li=document.createElement("li");
      const b=document.createElement("button");
      b.type="button";
      b.className="mj-note-link";
      b.textContent=item.text;
      b.addEventListener("click",function(){
        selected=item.key;
        renderCalendar();
        loadEntry();
        go("register");
      });
      li.append(b);ul.append(li);
    });
    root.append(ul);
    if(rows.length>8){
      const p=document.createElement("p");
      p.className="mj-empty-notes";
      p.textContent="Y "+(rows.length-8)+" anotaciones más.";
      root.append(p);
    }
  }
  const originalCalendar=renderCalendar;
  renderCalendar=function(){
    originalCalendar();
    decorateCalendar();
    refreshDashboard();
  };
  const originalSummary=renderSummary;
  renderSummary=function(){
    originalSummary();
    refreshDashboard();
  };
  // Esconde el formulario hasta que se pulse el botón morado o la pestaña Jornadas.
  workbench.classList.remove("open");
  renderCalendar();
  renderSummary();
  setInterval(refreshDashboard,60000);
})();
