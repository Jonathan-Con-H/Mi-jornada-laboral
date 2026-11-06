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
    sparkles:"m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z M19 17l.7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17z",
    settings:"M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    cloud:"M6 18h13a4 4 0 0 0 0-8h-1a6 6 0 0 0-11.6-1.4A5 5 0 0 0 6 18z",
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
    '<div class="mj-brand">' + glyph('calendar') + '<span>Mi Jornada</span></div>' +
    '<nav class="mj-sidebar-menu" aria-label="Secciones">' +
    navButton('calendar','calendar','Calendario') +
    navButton('register','clock','Registro jornada') +
    navButton('summary','chart','Resumen') +
    navButton('stats','pie','Estadísticas') +
    navButton('notes','notes','Notas') +
    navButton('vacations','umbrella','Vacaciones',true) +
    navButton('ai','sparkles','IA Asistente (beta)') +
    navButton('settings','settings','Ajustes') +
    navButton('backup','save','Copias de seguridad') +
    navButton('cloud','cloud','Copia en la nube') +
    '</nav><div class="mj-sidebar-foot">' + glyph('cloud') +
    '<span>Datos guardados en este dispositivo</span></div>';
  document.body.insertBefore(sidebar, main);
  const bottom = document.createElement('nav');
  bottom.className = 'mj-bottom-nav';
  bottom.setAttribute('aria-label', 'Navegación rápida');
  const shortcuts = [
    ['calendar','calendar','Calendario'],
    ['register','clock','Registro'],
    ['summary','chart','Resumen'],
    ['notes','notes','Notas'],
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
    '<div class="mj-metric"><span class="mj-metric-label">' + glyph('calendar') + 'Días trabajados</span><strong id="mjDays">0</strong></div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + glyph('clock') + 'Horas trabajadas</span><strong id="mjHours">0:00</strong></div>' +
    '<div class="mj-metric extra"><span class="mj-metric-label">' + glyph('plus') + 'Horas extra</span><strong id="mjExtras">0:00</strong></div>' +
    '<div class="mj-metric"><span class="mj-metric-label">' + glyph('cup') + 'Descanso (deben)</span><strong id="mjOwed">0:00</strong></div>' +
    '<div class="mj-metric owed-balance"><span class="mj-metric-label">' + glyph('clock') + '<span>Horas que debo<small>Acumuladas desde el primer registro</small></span></span><strong id="mjOwedAll">0:00</strong></div>' +
    '<div class="mj-metric total"><span class="mj-metric-label">' + glyph('sum') + 'Horas totales</span><strong id="mjTotal">0:00</strong></div>' +
    '<div class="mj-muted-note">Se cuentan únicamente los registros guardados de este mes; los automáticos usan el horario previsto. Las extras se anotan aparte.</div>';
  const insights = document.createElement('aside');
  insights.className = 'mj-insights';
  insights.setAttribute('aria-label', 'Información de jornada y mes');
  insights.append(todayPanel, monthPanel);
  const calendarView = document.getElementById('calendarView');
  calendarView.insertBefore(insights, calendarView.children[1]);
  const legend = calendarView.querySelector('.legend');
  if (legend) {
    legend.innerHTML =
      '<span><i class="dot"></i>Mañana</span>' +
      '<span><i class="dot"></i>Tarde</span>' +
      '<span><i class="dot"></i>Horas extras</span>' +
      '<span><i class="dot"></i>Festivo</span>' +
      '<span><i class="dot" style="color:#e44b51"></i>Registrada</span>';
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
      const monthDay = key.slice(5);
      const isHoliday = holidays.has(monthDay);
      button.classList.toggle('holiday', isHoliday);
      const desc = e.kind === 'rest' ? 'día libre' :
        (e.shift === 'morning' ? 'turno de mañana' : 'turno de tarde');
      const extras = Number(e.extraMins) > 0 ? ', con horas extra' : '';
      const registered = data[key] ? ', jornada registrada' : '';
      button.setAttribute('aria-label', day + ' de ' + monthLabel(viewDate) + ', ' +
        desc + (isHoliday ? ', festivo nacional habitual' : '') + extras + registered);
    });
  }
  function updateInsights() {
    const current = today();
    const currentDate = parse(current);
    const e = entry(current);
    const hasRecord = Object.prototype.hasOwnProperty.call(data, current);
    $mj('mjTodayTitle').textContent = 'Hoy, ' + currentDate.toLocaleDateString('es-ES', {day:'numeric',month:'long'});
    $mj('mjShiftChip').textContent = e.kind === 'rest' ? 'Libre' : (e.shift === 'morning' ? 'Mañana' : 'Tarde');
    $mj('mjTodayShift').textContent = e.kind === 'rest' ? 'Sin turno de trabajo' : 'Turno: ' + e.start + ' – ' + e.end;
    $mj('mjTodayBreak').textContent = 'Descanso: ' + (Number(e.breakMins) || 0) + ' min';
    const state = $mj('mjTodayState');
    const stateText = $mj('mjTodayStateText');
    state.classList.toggle('ok', hasRecord && e.kind === 'work');
    stateText.textContent = e.kind === 'rest' ? 'Día libre' :
      !hasRecord ? 'Pendiente de registrar' :
      e.auto && !e.stopped ? 'Apuntada automáticamente' : 'Jornada registrada';
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
    if (page === 'cloud' || page === 'ai') {
      window.dispatchEvent(new CustomEvent('mi-jornada:open-tool',{detail:{page:page}}));
      return;
    }
    const tabPage = page === 'summary' || page === 'stats' ? 'summary' :
      page === 'backup' ? 'backup' : 'calendar';
    const tab = document.querySelector('button.tab[data-tab="' + tabPage + '"]');
    if (tab) tab.click();
    document.querySelectorAll('[data-mj-go]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mjGo === page);
    });
    const target = page === 'register' ? $mj('entryForm') :
      page === 'notes' ? $mj('notes') :
      page === 'settings' ? $mj('toggleAuto') :
      page === 'summary' || page === 'stats' ? $mj('summaryView') :
      page === 'backup' ? $mj('backupView') : $mj('calendarView');
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
