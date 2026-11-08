/* Presentación de Mi Jornada. Usa el mismo localStorage y las funciones originales. */
(function () {
  "use strict";
  const paths = {
    calendar:"M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M8 14h2 M14 14h2 M8 18h2",
    clock:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l4 2",
    chart:"M5 20v-5 M10 20V9 M15 20V5 M20 20v-8",
    pie:"M12 3a9 9 0 1 0 9 9 M12 3v9h9",
    notes:"M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4",
    umbrella:"M3 12a9 9 0 0 1 18 0H3 M12 12v7a3 3 0 0 0 6 0",
    "clock-3":"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 12h5",
    "heart-pulse":"M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8 M3.5 12h4l2-3 3 6 2-3h5",
    handshake:"M2 11l4-4 4 1 3-1 5 5-5 5-2-1-2 2-3-1-4-4 M22 11l-4-4-4 1 M9 11l3-2 M6 15l2 2",
    stamp:"M7 20h10 M6 16h12v4H6z M9 16v-3a3 3 0 0 1 1-2V7a3 3 0 0 1 6 0v4a3 3 0 0 1 1 2v3",
    sparkles:"m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z M19 17l.7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17z",
    settings:"M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    cloud:"M6 18h13a4 4 0 0 0 0-8h-1a6 6 0 0 0-11.6-1.4A5 5 0 0 0 6 18z",
    briefcase:"M3 7h18v13H3z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 12h18 M10 12v2h4v-2",
    menu:"M4 6h16 M4 12h16 M4 18h16",
    check:"M20 6 9 17l-5-5",
    cup:"M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8 M16 9h2a3 3 0 0 1 0 6h-2 M4 22h15 M8 3v2 M12 3v2",
    plus:"M12 4v16 M4 12h16",
    sum:"M18 4H6l6 8-6 8h12",
    save:"M4 4h13l3 3v13H4z M8 4v6h8V4 M8 20v-7h8v7",
    arrow:"M5 12h14 M13 6l6 6-6 6"
  };
  function glyph(name) {
    return '<svg class="mj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      (paths[name] || paths.calendar) + '"></path></svg>';
  }
  function navButton(page, icon, text, disabled) {
    return '<button type="button" class="mj-menu-btn' + (page === "calendar" ? ' active' : '') +
      '" data-mj-go="' + page + '"' + (disabled ? ' disabled title="En preparación"' : '') + '>' +
      glyph(icon) + '<span>' + text + '</span>' + (disabled ? '<span class="mj-soon">Próximamente</span>' : '') + '</button>';
  }
  const main = document.querySelector('main.wrap');
  if (!main || !document.getElementById('calendarView')) return;
  document.body.classList.add('mj-shell');
  const sidebar = document.createElement('aside');
  sidebar.className = 'mj-sidebar';
  sidebar.setAttribute('aria-label', 'Menú principal');
  sidebar.innerHTML =
    '<div class="mj-brand">' + glyph('calendar') + '<span>Mi Jornada</span>' +
    '<button type="button" class="mj-menu-toggle" aria-controls="mjMainMenu" aria-expanded="false" aria-label="Abrir menú de secciones">' + glyph('menu') + '</button></div>' +
    '<nav id="mjMainMenu" class="mj-sidebar-menu" aria-label="Secciones">' +
    navButton('calendar','calendar','Calendario') +
    navButton('register','clock','Registro jornada') +
    navButton('summary','chart','Resumen') +
    navButton('notes','notes','Notas') +
    navButton('vacations','umbrella','Vacaciones') +
    navButton('ai','sparkles','IA Asistente (beta)') +
    (document.getElementById('serviceList') ? navButton('companies','briefcase','Mis empresas') : '') +
    navButton('settings','settings','Ajustes') +
    navButton('backup','save','Copias de seguridad') +
    navButton('cloud','cloud','Copia en la nube') +
    '</nav><div class="mj-sidebar-foot">' + glyph('cloud') +
    '<span>Datos guardados en este dispositivo</span></div>';
  document.body.insertBefore(sidebar, main);
  const menuToggle = sidebar.querySelector('.mj-menu-toggle');
  function setMenuOpen(open) {
    sidebar.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú de secciones' : 'Abrir menú de secciones');
  }
  menuToggle.addEventListener('click', function () {
    setMenuOpen(!sidebar.classList.contains('is-open'));
  });
  document.addEventListener('click', function (event) {
    if (sidebar.classList.contains('is-open') && !sidebar.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
      setMenuOpen(false);
      menuToggle.focus();
    }
  });
  const bottom = document.createElement('nav');
  bottom.className = 'mj-bottom-nav';
  bottom.setAttribute('aria-label', 'Navegación rápida');
  const shortcuts = [
    ['calendar','calendar','Calendario'],
    ['register','clock','Registro'],
    ['summary','chart','Resumen'],
    ...(document.getElementById('serviceList') ? [['companies','briefcase','Empresas']] : []),
    ['notes','notes','Notas'],
    ['vacations','umbrella','Vacaciones'],
    ['ai','sparkles','IA'],
    ['settings','settings','Ajustes']
  ];
  bottom.innerHTML = shortcuts.map(function (item) {
    return '<button type="button" class="mj-bottom-btn' +
      (item[0] === 'calendar' ? ' active' : '') + '" data-mj-go="' +
      item[0] + '">' + glyph(item[1]) + '<span>' + item[2] + '</span></button>';
  }).join('');
  document.body.appendChild(bottom);
  const todayPanel = document.createElement('div');
  todayPanel.className = 'mj-insight-card';
  todayPanel.innerHTML =
    '<div class="mj-title-row"><div class="mj-card-title" style="margin:0">' + glyph('calendar') + '<span id="mjTodayTitle"></span></div><span class="mj-chip" id="mjShiftChip"></span></div>' +
    '<div class="mj-detail">' + glyph('clock') + '<span id="mjTodayShift"></span></div>' +
    '<div class="mj-detail">' + glyph('cup') + '<span id="mjTodayBreak"></span></div>' +
    '<div class="mj-state" id="mjTodayState">' + glyph('check') + '<span id="mjTodayStateText"></span></div>';
  const monthPanel = document.createElement('div');
  monthPanel.className = 'mj-insight-card';
  monthPanel.innerHTML =
    '<div class="mj-card-title">' + glyph('chart') + '<span>Resumen del mes</span></div>' +
    '<div class="mj-month-caption" id="mjPanelMonth">Este mes</div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + glyph('calendar') + 'Jornadas registradas</span><strong id="mjDays">0</strong></div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + glyph('clock') + 'Horas registradas</span><strong id="mjHours">0:00</strong></div>' +
    '<div class="mj-metric extra"><span class="mj-metric-label">' + glyph('plus') + 'Horas extra</span><strong id="mjExtras">0:00</strong></div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + glyph('cup') + 'Descanso (deben)</span><strong id="mjOwed">0:00</strong></div>' +
    '<div class="mj-metric owed-balance"><span class="mj-metric-label">' + glyph('clock') + '<span>Horas que debo<small>Acumuladas desde el primer registro</small></span></span><strong id="mjOwedAll">0:00</strong></div>' +
    '<div class="mj-metric total"><span class="mj-metric-label">' + glyph('sum') + 'Horas totales</span><strong id="mjTotal">0:00</strong></div>' +
    '<div class="mj-muted-note">Se cuentan únicamente los registros guardados de este mes; los automáticos usan el horario previsto. Los registros automáticos representan horas estimadas, no un fichaje real. Las extras se anotan aparte.</div>';
  const insights = document.createElement('aside');
  insights.className = 'mj-insights';
  insights.setAttribute('aria-label', 'Información de jornada y mes');
  insights.append(todayPanel, monthPanel);
  const calendarView = document.getElementById('calendarView');
  calendarView.insertBefore(insights, calendarView.children[1]);
  // En Android, el registro automático se controla desde Ajustes sin
  // duplicar el panel en el calendario. Sus botones originales siguen operativos.
  const androidSettings = document.getElementById('settingsView');
  const androidToggle = document.getElementById('toggleAuto');
  if (androidSettings && androidToggle && calendarView.contains(androidToggle)) {
    const originalPanel = androidToggle.closest('.panel');
    if (originalPanel) {
      originalPanel.classList.add('hidden');
      androidSettings.appendChild(originalPanel);
    }
  }
  // El menú lateral se oculta en pantallas pequeñas. Las copias y la nube
  // deben ser accesibles desde Ajustes sin quitar la navegación móvil actual.
  if (androidSettings && document.getElementById('cloudView')) {
    const toolsPanel = document.createElement('div');
    toolsPanel.className = 'panel';
    toolsPanel.innerHTML = '<h2>Datos y seguridad</h2><p class="muted">Tus registros siguen guardados en el móvil. Protege tus hojas de servicio antes de cambiar de versión o teléfono.</p><div class="actions"><button class="secondary" type="button" data-open-android="backup">Copias de seguridad</button><button class="secondary" type="button" data-open-android="cloud">Mi nube</button></div>';
    toolsPanel.querySelectorAll('[data-open-android]').forEach(function (button) {
      button.onclick = function () {
        const tab = document.querySelector('button.tab[data-tab="' + button.dataset.openAndroid + '"]');
        if (tab) tab.click();
        window.scrollTo({top:0,behavior:'smooth'});
      };
    });
    androidSettings.appendChild(toolsPanel);
  }

  const legend = calendarView.querySelector('.legend');
  if (legend) {
    legend.innerHTML =
      '<span><i class="dot"></i>Mañana</span>' +
      '<span><i class="dot"></i>Tarde</span>' +
      '<span><i class="dot"></i>Horas extras</span>' +
      '<span><i class="dot"></i>Festivo</span>' +
      '<span><i class="dot" style="color:#e44b51"></i>Registrada</span>' +
      '<span><i class="dot" style="color:#1D4ED8"></i>Vacaciones</span>' +
      '<span><i class="dot" style="color:#d97706"></i>Ausencias</span>';
  }
  const $mj = function (id) { return document.getElementById(id); };
  function hhmm(mins) {
    const v = Math.max(0, Math.round(Number(mins) || 0));
    return String(Math.floor(v / 60)) + ':' + String(v % 60).padStart(2, '0');
  }
  const holidays = new Set(['01-01','01-06','05-01','08-15','10-12','11-01','12-06','12-08','12-25']);
  function decorateCalendar() {
    const buttons = $mj('calendar').querySelectorAll('button.day');
    buttons.forEach(function (button, index) {
      const day = index + 1;
      const key = iso(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
      const e = entry(key);
      button.classList.toggle('has-extra', Number(e.extraMins) > 0);
      const absenceIcon=e.kind==="work"&&Number(e.hourlyLeaveMins)>0?"clock-3":
        ({vacation:"umbrella",sick:"heart-pulse",paid_leave:"handshake",justified:"stamp"}[e.kind]);
      if(absenceIcon){
        const symbol=document.createElement("span");symbol.className="absence-symbol";
        symbol.innerHTML=glyph(absenceIcon);button.appendChild(symbol);
      }
      const monthDay = key.slice(5);
      const isHoliday = holidays.has(monthDay);
      button.classList.toggle('holiday', isHoliday);
      const desc = e.kind === 'vacation' ? 'vacaciones' :
        e.kind === 'sick' ? 'baja médica' : e.kind === 'paid_leave' ? 'permiso retribuido' :
        e.kind === 'justified' ? 'ausencia justificada' : e.kind === 'rest' ? 'día libre' :
        (e.shift === 'morning' ? 'turno de mañana' : 'turno de tarde');
      const extras = Number(e.extraMins) > 0 ? ', con horas extra' : '';
      const hourly = Number(e.hourlyLeaveMins) > 0 ? ', con permiso por horas' : '';
      const registered = data[key] ? ', jornada registrada' : '';
      button.setAttribute('aria-label', day + ' de ' + monthLabel(viewDate) + ', ' +
        desc + (isHoliday ? ', festivo orientativo' : '') + extras + hourly + registered);
    });
  }
  function updateInsights() {
    const current = today();
    const currentDate = parse(current);
    const e = entry(current);
    const hasRecord = Object.prototype.hasOwnProperty.call(data, current);
    $mj('mjTodayTitle').textContent = 'Hoy, ' + currentDate.toLocaleDateString('es-ES', {day:'numeric',month:'long'});
    $mj('mjShiftChip').textContent = e.kind === 'rest' ? 'Libre' : (e.shift === 'morning' ? 'Mañana' : 'Tarde');
    $mj('mjTodayShift').textContent = e.kind === 'work' ? 'Turno: ' + e.start + ' – ' + e.end :
      e.kind === 'rest' ? 'Sin turno de trabajo' : 'Ausencia registrada';
    $mj('mjTodayBreak').textContent = 'Descanso: ' + (Number(e.breakMins) || 0) + ' min';
    const state = $mj('mjTodayState');
    const stateText = $mj('mjTodayStateText');
    state.classList.toggle('ok', hasRecord && e.kind === 'work' && !e.auto);
    stateText.textContent = e.kind === 'rest' ? 'Día libre' :
      e.kind === 'vacation' ? 'Vacaciones registradas' :
      e.kind === 'sick' ? 'Baja médica registrada' :
      e.kind === 'paid_leave' ? 'Permiso retribuido registrado' :
      e.kind === 'justified' ? 'Ausencia justificada registrada' :
      !hasRecord ? 'Pendiente de registrar' :
      e.auto && !e.stopped ? 'Jornada estimada automáticamente' : 'Jornada registrada';
    $mj('mjPanelMonth').textContent = monthLabel(viewDate);
    let days = 0, worked = 0, extra = 0, owed = 0, owedAll = 0;
    // Deuda acumulada de todos los días trabajados y registrados hasta hoy.
    // No se confunde con las horas de jornada, y no anticipa deuda futura.
    Object.keys(data).forEach(function (key) {
      if (key > current) return;
      const item = entry(key);
      if (item.kind === 'work') owedAll += Math.round((Number(item.owed) || 0) * 60);
    });
    Object.keys(data).forEach(function (key) {
      const d = parse(key);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== viewDate.getFullYear() ||
          d.getMonth() !== viewDate.getMonth()) return;
      const item = entry(key);
      if (item.kind !== 'work') return;
      days++;
      worked += Math.round(elapsedHours(item, key) * 60);
      extra += Number(item.extraMins) || 0;
      owed += Math.round((Number(item.owed) || 0) * 60);
    });
    $mj('mjDays').textContent = String(days);
    $mj('mjHours').textContent = hhmm(worked);
    $mj('mjExtras').textContent = hhmm(extra);
    $mj('mjOwed').textContent = hhmm(owed);
    $mj('mjOwedAll').textContent = hhmm(owedAll);
    $mj('mjTotal').textContent = hhmm(worked + extra);
  }
  const oldRender = renderCalendar;
  renderCalendar = function () {
    oldRender();
    decorateCalendar();
    updateInsights();
  };
  const oldSummary = renderSummary;
  renderSummary = function () {
    oldSummary();
    updateInsights();
  };
  function choose(page) {
    setMenuOpen(false);
    // Android abre la edición solo tras pulsar una fecha. Los accesos a
    // Registro y Notas vuelven al calendario, sin desplegar el formulario.
    if (document.getElementById('mjEntryPanel') && (page === 'register' || page === 'notes')) {
      page = 'calendar';
      const calendar = document.getElementById('calendar');
      if (calendar && !document.getElementById('mjDateOnlyHint')) {
        const hint = document.createElement('p');
        hint.id = 'mjDateOnlyHint';
        hint.className = 'muted';
        hint.textContent = 'Pulsa un día del calendario para abrir su registro de horas o sus notas.';
        calendar.insertAdjacentElement('afterend',hint);
      }
    }
    if (page === 'cloud' || page === 'ai') {
      window.dispatchEvent(new CustomEvent('mi-jornada:open-tool',{detail:{page:page}}));
      return;
    }
    const tabPage = page === 'summary' ? 'summary' :
      page === 'backup' ? 'backup' : page === 'vacations' ? (document.getElementById('vacationsView') ? 'vacations' : 'vacation') :
      page === 'companies' || page === 'services' ? 'companies' : page === 'settings' ? 'settings' : 'calendar';
    const tab = document.querySelector('button.tab[data-tab="' + tabPage + '"]');
    if (tab) tab.click();
    document.querySelectorAll('[data-mj-go]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mjGo === page);
    });
    const target = page === 'register' ? $mj('entryForm') :
      page === 'notes' ? $mj('notes') :
      page === 'settings' ? $mj('settingsView') :
      page === 'summary' ? $mj('summaryView') :
      page === 'backup' ? $mj('backupView') :
      page === 'vacations' ? ($mj('vacationView') || $mj('vacationsView')) :
      page === 'companies' || page === 'services' ? $mj('companiesView') : $mj('calendarView');
    if (target) target.scrollIntoView({behavior:'smooth',block:'start'});
    if (page === 'notes') $mj('notes').focus({preventScroll:true});
  }
  document.querySelectorAll('[data-mj-go]:not(:disabled)').forEach(function (button) {
    button.addEventListener('click', function () { choose(button.dataset.mjGo); });
  });
  renderCalendar();
  renderSummary();
  updateInsights();
})();
