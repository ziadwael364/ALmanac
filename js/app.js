/* Almanac — shell: routing, sidebar, Today, settings, shortcuts, reminders, sample data, boot. */
'use strict';
(function () {
  var D = A.D, esc = A.esc;
  A.ui = { route: 'today', date: D.today() };

  var ROUTES = [
    { id: 'today', name: 'Today', icon: 'today', key: '1' },
    { id: 'calendar', name: 'Calendar', icon: 'calendar', key: '2' },
    { id: 'tasks', name: 'Tasks', icon: 'tasks', key: '3' },
    { id: 'timetable', name: 'Timetable', icon: 'timetable', key: '4' },
    { id: 'habits', name: 'Habits', icon: 'habits', key: '5' },
    { id: 'goals', name: 'Goals', icon: 'goals', key: '6' },
    { id: 'focus', name: 'Focus', icon: 'focus', key: '7' },
    { id: 'journal', name: 'Journal', icon: 'journal', key: '8' },
    { id: 'insights', name: 'Insights', icon: 'insights', key: '9' },
    { id: 'settings', name: 'Settings', icon: 'settings', key: ',' }
  ];
  A.routes = ROUTES;

  /* --------------------------------------------------- ui preferences */
  var UK = 'almanac.ui';
  A.remember = function () {
    try {
      localStorage.setItem(UK, JSON.stringify({ route: A.ui.route, cal: A.cal.mode, tray: A.cal.tray, t: { list: A.tasksUI.list, layout: A.tasksUI.layout, sort: A.tasksUI.sort, group: A.tasksUI.group }, hidden: A.hiddenCats, banner: A.ui.bannerOff }));
    } catch (e) {}
  };
  function restoreUI() {
    try {
      var u = JSON.parse(localStorage.getItem(UK) || 'null');
      if (!u) { if (innerWidth < 700) A.cal.mode = '3day'; return; }
      if (u.route && A.views[u.route]) A.ui.route = u.route;
      if (u.cal) A.cal.mode = u.cal;
      else if (innerWidth < 700) A.cal.mode = '3day';
      A.cal.tray = !!u.tray;
      if (u.t) Object.assign(A.tasksUI, u.t);
      if (u.hidden) A.hiddenCats = u.hidden;
      A.ui.bannerOff = u.banner;
    } catch (e) {}
  }

  /* --------------------------------------------------------- routing */
  A.go = function (route, opts) {
    if (!A.views[route]) route = 'today';
    var changed = route !== A.ui.route;
    A.ui.route = route;
    if (opts && opts.date) { A.ui.date = opts.date; if (route === 'journal') A.journalUI.date = opts.date; }
    if (changed) { A.cal.scrollTop = null; mainScroll = 0; }
    closeDrawer();
    A.remember();
    try { history.replaceState(null, '', '#' + route); } catch (e) {}
    A.render();
    if (changed) { var m = A.$('#main'); if (m) m.scrollTop = 0; }
    if (opts && opts.section) setTimeout(function () { var s = A.$('#set-' + opts.section); if (s) s.scrollIntoView({ block: 'start' }); }, 30);
  };
  A.actions.go = function (el) { A.go(el.getAttribute('data-to'), { section: el.getAttribute('data-sec') }); };

  /* --------------------------------------------------------- theme */
  A.applyTheme = function () {
    var t = A.state.settings.theme, root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  };

  /* --------------------------------------------------------- sidebar */
  function miniMonth() {
    var d = A.ui.mini || A.ui.date, first = new Date(d.getFullYear(), d.getMonth(), 1), start = D.startOfWeek(first, A.state.settings.weekStart);
    var busy = {};
    A.occurrences(start, D.addDays(start, 42)).forEach(function (o) { busy[o.key] = true; });
    var sel = A.ui.route === 'calendar' ? A.ui.date : null;
    var weekSel = sel && A.cal.mode === 'week' ? D.startOfWeek(sel, A.state.settings.weekStart) : null;
    var html = '<div class="mini"><div class="mini-h"><b>' + D.fmt(d, 'month') + '</b><button class="icon-btn small" data-act="mini" data-dir="-1" aria-label="Previous month">' + A.icon('left') + '</button><button class="icon-btn small" data-act="mini" data-dir="1" aria-label="Next month">' + A.icon('right') + '</button></div><div class="mini-g">';
    for (var i = 0; i < 7; i++) html += '<span class="mwd">' + D.WD[(A.state.settings.weekStart + i) % 7][0] + '</span>';
    for (var j = 0; j < 42; j++) {
      var x = D.addDays(start, j), k = D.key(x);
      var inWeek = weekSel && x >= weekSel && x < D.addDays(weekSel, 7);
      html += '<button class="md' + (x.getMonth() !== d.getMonth() ? ' out' : '') + (D.sameDay(x, D.today()) ? ' today' : '') + (sel && D.sameDay(x, sel) ? ' sel' : '') + (inWeek ? ' wk' : '') + (busy[k] ? ' busy' : '') + '" data-act="mini-day" data-day="' + k + '">' + x.getDate() + '</button>';
    }
    return html + '</div></div>';
  }
  function badge(id) {
    if (id === 'tasks') { var n = A.state.tasks.filter(function (t) { return t.status !== 'done' && t.due && t.due <= D.todayKey(); }).length; return n ? '<em' + (A.state.tasks.some(A.taskOverdue) ? ' class="alert"' : '') + '>' + n + '</em>' : ''; }
    if (id === 'habits') { var today = D.today(), left = A.state.habits.filter(function (h) { return !h.archived && A.habitDue(h, today) && !A.habitDone(h, D.key(today)); }).length; return left ? '<em>' + left + '</em>' : ''; }
    if (id === 'focus' && (A.timer.running || A.timer.remaining != null)) return '<em class="live">' + A.timerLabel() + '</em>';
    return '';
  }
  function syncLabel() {
    var s = A.persist.status;
    return { local: ['Saved on this device', 'local'], saving: ['Saving…', 'saving'], synced: ['Synced to your account', 'synced'], offline: ['Sync paused, saved on this device', 'offline'], full: ['Storage full, saved on this device', 'offline'] }[s] || ['Saved', 'local'];
  }
  function renderSide() {
    var side = A.$('#side'); if (!side) return;
    var sl = syncLabel();
    side.innerHTML =
      '<div class="brand"><svg viewBox="0 0 32 32" class="logo" aria-hidden="true"><rect x="3" y="5" width="26" height="24" rx="5"/><path d="M3 12h26M10 2.5v5M22 2.5v5"/><path d="M9 19h5M9 23.5h9M18 19h5"/></svg><div><b>Almanac</b><small>' + D.fmt(new Date(), 'medium') + '</small></div>' +
      '<button class="icon-btn close-drawer" data-act="drawer" aria-label="Close menu">' + A.icon('x') + '</button></div>' +
      '<button class="newbtn" data-act="quick">' + A.icon('plus') + '<span>New</span><kbd>N</kbd></button>' +
      '<nav class="nav" aria-label="Sections">' + ROUTES.map(function (r) {
        return '<button class="' + (A.ui.route === r.id ? 'on' : '') + '" data-act="go" data-to="' + r.id + '"' + (A.ui.route === r.id ? ' aria-current="page"' : '') + '>' + A.icon(r.icon) + '<span>' + r.name + '</span>' + badge(r.id) + '<kbd>' + r.key + '</kbd></button>';
      }).join('') + '</nav>' +
      miniMonth() +
      '<div class="cats"><div class="cats-h"><b>Categories</b><button class="icon-btn small" data-act="go" data-to="settings" data-sec="categories" aria-label="Edit categories">' + A.icon('edit') + '</button></div>' +
      A.state.categories.map(function (c) {
        var off = A.hiddenCats[c.id];
        return '<button class="cat' + (off ? ' off' : '') + '" data-act="cat-toggle" data-id="' + c.id + '" aria-pressed="' + !off + '" title="' + (off ? 'Show' : 'Hide') + ' on calendar"><i class="sw" style="--c:' + c.color + '"></i><span>' + esc(c.name) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="side-foot"><span class="sync ' + sl[1] + '" title="' + esc(A.persist.lastError || '') + '">' + A.icon(sl[1] === 'synced' ? 'cloud' : 'check') + sl[0] + '</span>' +
      '<button class="icon-btn small" data-act="theme" aria-label="Switch theme" title="Theme: ' + A.state.settings.theme + '">' + A.icon('moon') + '</button>' +
      '<button class="icon-btn small" data-act="shortcuts" aria-label="Keyboard shortcuts" title="Shortcuts (?)">' + A.icon('keyboard') + '</button></div>';
  }
  function renderTop() {
    var top = A.$('#top'); if (!top) return;
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
    var t = A.timer, timerOn = t.running || t.remaining != null;
    top.innerHTML =
      '<button class="icon-btn menu-btn" data-act="drawer" aria-label="Open menu">' + A.icon('menu') + '</button>' +
      '<button class="search" data-act="palette">' + A.icon('search') + '<span>Search, jump or add…</span><kbd>' + (mac ? '⌘' : 'Ctrl') + ' K</kbd></button>' +
      (timerOn ? '<button class="timer-pill mode-' + t.mode + (t.running ? ' run' : '') + '" data-act="go" data-to="focus">' + A.icon(t.running ? 'focus' : 'pause') + '<span id="timer-pill-t">' + A.timerLabel() + '</span></button>' : '') +
      '<span class="grow"></span>' +
      '<button class="icon-btn" data-act="undo" aria-label="Undo" title="Undo (' + (mac ? '⌘' : 'Ctrl') + ' Z)"' + (A.canUndo() ? '' : ' disabled') + '>' + A.icon('undo') + '</button>' +
      '<button class="icon-btn" data-act="redo" aria-label="Redo" title="Redo (' + (mac ? '⌘' : 'Ctrl') + ' Shift Z)"' + (A.canRedo() ? '' : ' disabled') + '>' + A.icon('redo') + '</button>' +
      '<button class="btn primary" data-act="quick">' + A.icon('plus') + '<span>New</span></button>';
  }
  function renderTabbar() {
    var tb = A.$('#tabbar'); if (!tb) return;
    tb.innerHTML = ['today', 'calendar', 'tasks', 'habits', 'focus'].map(function (id) {
      var r = A.byId(ROUTES, id);
      return '<button class="' + (A.ui.route === id ? 'on' : '') + '" data-act="go" data-to="' + id + '">' + A.icon(r.icon) + '<span>' + r.name + '</span></button>';
    }).join('') + '<button data-act="drawer">' + A.icon('more') + '<span>More</span></button>';
  }
  function banner() {
    if (!A.state.settings.sample || A.ui.bannerOff) return '';
    return '<div class="banner"><p>' + A.icon('sparkle') + ' You are looking at <b>example data</b> so every screen has something to show. Clear it when you are ready to plan your own life.</p>' +
      '<button class="btn small" data-act="sample-keep">Keep for now</button><button class="btn small primary" data-act="sample-clear">Clear and start fresh</button></div>';
  }

  var mainScroll = 0;
  A.render = function () {
    A.applyTheme();
    renderSide(); renderTop(); renderTabbar();
    var main = A.$('#main'); if (!main) return;
    var keep = main.scrollTop;
    var view = A.views[A.ui.route] || A.views.today;
    var host = document.createElement('div'); host.className = 'view view-' + A.ui.route;
    try { view(host); } catch (e) { console.error(e); host.innerHTML = '<div class="empty"><h3>This screen hit a problem</h3><p>' + esc(e.message) + '</p></div>'; }
    main.innerHTML = banner();
    main.classList.toggle('fill', A.ui.route === 'calendar' && /day|week|month/.test(A.cal.mode) || A.ui.route === 'timetable' && A.state.templates.length > 0);
    main.appendChild(host);
    main.scrollTop = keep;
  };

  A.on(function (why) {
    if (why === 'sync') { var s = A.$('.sync'); if (s) { var sl = syncLabel(); s.className = 'sync ' + sl[1]; s.lastChild.textContent = sl[0]; } return; }
    if (A.silent) { renderSide(); renderTop(); return; }
    A.render();
  });

  /* -------------------------------------------------------- drawer */
  function closeDrawer() { document.body.classList.remove('drawer-open'); }
  A.actions.drawer = function () { document.body.classList.toggle('drawer-open'); };
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('drawer-open') && e.target.classList && e.target.classList.contains('scrim')) closeDrawer();
  });

  /* ---------------------------------------------------- misc actions */
  A.actions.quick = function () { A.openQuickAdd(''); };
  A.actions.palette = function () { A.openPalette(''); };
  A.actions.undo = function () { var l = A.undo(); A.toast(l ? 'Undid ' + l.toLowerCase() : 'Nothing to undo'); };
  A.actions.redo = function () { var l = A.redo(); A.toast(l ? 'Redid ' + l.toLowerCase() : 'Nothing to redo'); };
  A.actions.theme = function () {
    var order = ['system', 'light', 'dark'], cur = A.state.settings.theme;
    var next = order[(order.indexOf(cur) + 1) % 3];
    A.commit('Change theme', ['settings'], function (st) { st.settings.theme = next; });
    A.toast('Theme: ' + next);
  };
  A.actions['cat-toggle'] = function (el) { var id = el.getAttribute('data-id'); if (A.hiddenCats[id]) delete A.hiddenCats[id]; else A.hiddenCats[id] = true; A.remember(); A.render(); };
  A.actions.mini = function (el) { var d = A.ui.mini || A.ui.date; A.ui.mini = D.addMonths(new Date(d.getFullYear(), d.getMonth(), 1), +el.getAttribute('data-dir')); renderSide(); };
  A.actions['mini-day'] = function (el) {
    A.ui.date = D.parse(el.getAttribute('data-day')); A.ui.mini = null;
    if (A.cal.mode === 'month' || A.cal.mode === 'year' || A.cal.mode === 'agenda') A.cal.mode = 'week';
    A.go('calendar');
  };
  A.actions['sample-keep'] = function () { A.ui.bannerOff = true; A.remember(); A.render(); };
  A.actions['sample-clear'] = function () {
    A.confirm('Remove all the example events, tasks, habits, goals and journal entries? Your settings and categories stay.', { ok: 'Clear example data', danger: true }).then(function (ok) {
      if (!ok) return;
      A.commit('Clear example data', ['events', 'tasks', 'habits', 'goals', 'journal', 'focus', 'templates', 'projects', 'settings'], function (st) {
        st.events = []; st.tasks = []; st.habits = []; st.goals = []; st.journal = {}; st.focus = []; st.templates = [];
        st.projects = A.emptyState().projects; st.settings.sample = false;
      });
      A.toast('Cleared. Press N to add your first thing.', { undo: true });
      A.go('today');
    });
  };
  A.actions.shortcuts = function () { showShortcuts(); };

  /* ============================================================ TODAY */
  A.views.today = function (main) {
    var now = new Date(), today = D.today(), tk = D.todayKey(), s = A.state.settings;
    var h = now.getHours(), greet = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var dayFrom = D.fromMinutes(today, s.dayStart * 60), dayTo = D.fromMinutes(today, Math.min(24, s.dayEnd) * 60);
    var dayPct = A.clamp((now - dayFrom) / (dayTo - dayFrom), 0, 1);
    var occs = A.occurrences(today, D.addDays(today, 1), { all: true });
    var timed = occs.filter(function (o) { return !o.ev.allDay; }), allDay = occs.filter(function (o) { return o.ev.allDay; });
    var current = timed.filter(function (o) { return o.start <= now && o.end > now; });
    var next = A.occurrences(now, D.addDays(today, 8), { all: true }).filter(function (o) { return !o.ev.allDay && o.start > now; })[0];
    var free = A.freeSlots(today, Math.max(D.minutesOfDay(now), s.dayStart * 60), Math.min(24, s.dayEnd) * 60, 15);
    var freeMin = A.sum(free, function (g) { return (g.end - g.start) / 60000; });
    var bigGap = free.slice().sort(function (a, b) { return (b.end - b.start) - (a.end - a.start); })[0];
    var plannedMin = A.sum(timed, function (o) { return (o.end - o.start) / 60000; });

    var overdue = A.state.tasks.filter(A.taskOverdue);
    var dueToday = A.state.tasks.filter(function (t) { return t.status !== 'done' && t.due === tk; });
    var doneToday = A.state.tasks.filter(function (t) { return t.completedAt && D.key(new Date(t.completedAt)) === tk; });
    var habits = A.state.habits.filter(function (x) { return !x.archived && A.habitDue(x, today); });
    var habitsDone = habits.filter(function (x) { return A.habitDone(x, tk); }).length;
    var focusMin = A.sum(A.state.focus.filter(function (f) { return f.start.slice(0, 10) === tk; }), function (f) { return f.minutes; });
    var j = A.state.journal[tk] || {};
    var goals = A.state.goals.filter(function (g) { return !g.archived && !g.done; }).sort(function (a, b) { return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1; }).slice(0, 3);

    var taskRow = function (t) {
      return '<div class="trow compact' + (t.status === 'done' ? ' done' : '') + '"><button class="cbox p' + (t.priority || 0) + '" data-act="task-toggle" data-id="' + t.id + '" aria-label="Complete">' + (t.status === 'done' ? A.icon('check') : '') + '</button>' +
        '<button class="tmain" data-act="task-open" data-id="' + t.id + '"><span class="tt">' + esc(t.title) + '</span><span class="tmeta">' +
        (A.taskOverdue(t) ? '<span class="due over">' + D.rel(D.parse(t.due)) + '</span>' : '') + (t.dueTime ? '<span>' + D.time(D.parse(t.due + 'T' + t.dueTime)) + '</span>' : '') +
        (t.estimate ? '<span>~' + D.dur(t.estimate) + '</span>' : '') + (t.eventId ? '<span class="sched">' + A.icon('clock') + D.time(D.parse((A.byId(A.state.events, t.eventId) || {}).start)) + '</span>' : '') + '</span></button>' + A.prioFlag(t) + '</div>';
    };

    var timeline = timed.length ? '<ol class="tl-list">' + timed.map(function (o) {
      var st = o.end <= now ? 'past' : o.start <= now ? 'now' : '';
      var pct = st === 'now' ? Math.round((now - o.start) / (o.end - o.start) * 100) : 0;
      return '<li class="' + st + '" style="--c:' + A.cat(o.ev.catId).color + '"><span class="ag-time">' + D.time(o.start) + '</span><button class="tl-b" data-act="today-ev" data-id="' + o.ev.id + '" data-key="' + o.key + '"><b>' + esc(o.ev.title) + '</b><small>' + D.time(o.start) + '–' + D.time(o.end) + (o.ev.location ? ' · ' + esc(o.ev.location) : '') + '</small>' +
        (st === 'now' ? '<span class="tl-prog"><i style="width:' + pct + '%"></i></span>' : '') + '</button></li>';
    }).join('') + '</ol>' : '<p class="muted">Nothing scheduled today. ' + (freeMin ? D.dur(freeMin) + ' of open time.' : '') + '</p>';

    var upcoming = [];
    for (var i = 1; i <= 3; i++) {
      var d = D.addDays(today, i), list = A.occurrences(d, D.addDays(d, 1));
      var dt = A.state.tasks.filter(function (t) { return t.status !== 'done' && t.due === D.key(d); }).length;
      upcoming.push('<button class="up-day" data-act="cal-goto-day" data-day="' + D.key(d) + '"><b>' + D.rel(d) + '</b><span>' + list.length + ' event' + (list.length === 1 ? '' : 's') + (dt ? ' · ' + dt + ' task' + (dt === 1 ? '' : 's') : '') + '</span>' +
        '<small>' + list.slice(0, 3).map(function (o) { return (o.ev.allDay ? '' : D.time(o.start) + ' ') + esc(o.ev.title); }).join('<br>') + '</small></button>');
    }

    main.innerHTML =
      '<section class="hero">' +
      '<div class="hero-l"><p class="eyebrow">' + D.fmt(now, 'long') + ' · week ' + D.isoWeek(now) + '</p><h1>' + greet + (s.name ? ', ' + esc(s.name) : '') + '.</h1>' +
      '<p class="hero-sub">' + (timed.length ? timed.length + ' event' + (timed.length > 1 ? 's' : '') + ' (' + D.dur(plannedMin) + ')' : 'No events') + ', ' + (dueToday.length + overdue.length) + ' task' + (dueToday.length + overdue.length === 1 ? '' : 's') + ' to do' + (habits.length ? ', ' + (habits.length - habitsDone) + ' habit' + (habits.length - habitsDone === 1 ? '' : 's') + ' left' : '') + '.' +
      (bigGap && (bigGap.end - bigGap.start) / 60000 >= 30 ? ' Longest free stretch: <b>' + D.time(bigGap.start) + '–' + D.time(bigGap.end) + '</b>.' : '') + '</p>' +
      (allDay.length ? '<div class="allday-row">' + allDay.map(function (o) { return '<span class="pill" style="--c:' + A.cat(o.ev.catId).color + '"><i class="dot"></i>' + esc(o.ev.title) + '</span>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="hero-r"><div class="dayclock">' + A.ring(dayPct, 92, 8, Math.round(dayPct * 100) + '%') + '<span>of your day<br>gone</span></div>' +
      '<div class="dstat"><b>' + D.dur(freeMin) + '</b><small>free time left</small></div><div class="dstat"><b>' + D.dur(focusMin) + '</b><small>focused today</small></div></div>' +
      '</section>' +
      '<div class="today-grid">' +
      '<section class="card nownext"><h3>Now</h3>' +
      (current.length ? current.map(function (o) { return '<div class="nn now" style="--c:' + A.cat(o.ev.catId).color + '"><b>' + esc(o.ev.title) + '</b><span>until ' + D.time(o.end) + ' · ' + D.dur((o.end - now) / 60000) + ' left</span></div>'; }).join('') : '<div class="nn idle"><b>Free</b><span>' + (next ? 'until ' + D.time(next.start) : 'for the rest of the day') + '</span></div>') +
      '<h3>Next</h3>' + (next ? '<div class="nn" style="--c:' + A.cat(next.ev.catId).color + '"><b>' + esc(next.ev.title) + '</b><span>' + (D.sameDay(next.start, now) ? 'in ' + D.dur((next.start - now) / 60000) : D.rel(next.start)) + ' · ' + D.time(next.start) + (next.ev.location ? ' · ' + esc(next.ev.location) : '') + '</span></div>' : '<p class="muted small">Nothing coming up this week.</p>') +
      '<h3>Today <button class="link small" data-act="cal-goto-day" data-day="' + tk + '">Open day</button></h3>' + timeline + '</section>' +
      '<section class="card"><h3>Tasks <span class="muted">' + doneToday.length + ' done today</span><span class="grow"></span><button class="btn small" data-act="cal-plan">' + A.icon('wand') + 'Plan my day</button></h3>' +
      '<form class="tadd small" id="today-add"><span class="plus">' + A.icon('plus') + '</span><input id="today-add-in" autocomplete="off" placeholder="Add a task for today…"></form>' +
      (overdue.length ? '<h4 class="over">Overdue</h4>' + overdue.map(taskRow).join('') : '') +
      (dueToday.length ? '<h4>Due today</h4>' + dueToday.sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); }).map(taskRow).join('') : '') +
      (!overdue.length && !dueToday.length ? '<p class="muted small">Nothing due. Pull something from <button class="link" data-act="go" data-to="tasks">your lists</button>.</p>' : '') +
      (doneToday.length ? '<details class="done-today"><summary>Completed today (' + doneToday.length + ')</summary>' + doneToday.map(taskRow).join('') + '</details>' : '') + '</section>' +
      '<div class="today-col">' +
      '<section class="card"><h3>Habits <span class="muted">' + habitsDone + '/' + habits.length + '</span></h3>' + (habits.length ? '<div class="th-list">' + habits.map(function (x) {
        var n = (x.log || {})[tk] || 0, done = A.habitDone(x, tk);
        return '<button class="th' + (done ? ' done' : '') + '" style="--c:' + x.color + '" data-act="habit-tick" data-id="' + x.id + '" data-day="' + tk + '"><span class="th-box">' + (done ? A.icon('check') : x.target > 1 ? n : '') + '</span><span>' + esc(x.name) + (x.target > 1 ? '<small>' + n + '/' + x.target + ' ' + esc(x.unit || '') + '</small>' : '') + '</span><small class="streak">' + A.habitStreak(x) + 'd</small></button>';
      }).join('') + '</div>' : '<p class="muted small">No habits for today. <button class="link" data-act="habit-new">Add one</button></p>') + '</section>' +
      '<section class="card"><h3>How are you?</h3><div class="mood mini-mood">' + [[1, 'Awful'], [2, 'Low'], [3, 'Okay'], [4, 'Good'], [5, 'Great']].map(function (m) {
        return '<button class="m' + m[0] + (j.mood === m[0] ? ' on' : '') + '" data-act="today-mood" data-v="' + m[0] + '"><i class="jm m' + m[0] + '"></i>' + m[1] + '</button>';
      }).join('') + '</div><button class="link small" data-act="go" data-to="journal">' + (j.text ? 'Continue today\'s entry' : 'Write in your journal') + '</button></section>' +
      '<section class="card"><h3>Focus</h3><div class="row"><span class="big-num">' + D.dur(focusMin) + '</span><span class="grow"></span>' +
      '<button class="btn primary" data-act="' + (A.timer.running ? 'focus-pause' : 'focus-start') + '">' + A.icon(A.timer.running ? 'pause' : 'play') + (A.timer.running ? A.timerLabel() : 'Start ' + A.state.settings.pomo.focus + 'm') + '</button></div></section>' +
      (goals.length ? '<section class="card"><h3>Goals</h3>' + goals.map(function (g) {
        var p = A.goalProgress(g);
        return '<button class="tg" data-act="goal-edit" data-id="' + g.id + '"><span>' + esc(g.title) + '</span><span class="bar"><i style="width:' + Math.round(p * 100) + '%"></i></span><small>' + Math.round(p * 100) + '%' + (g.deadline ? ' · ' + D.diffDays(D.today(), D.parse(g.deadline)) + 'd left' : '') + '</small></button>';
      }).join('') + '</section>' : '') +
      '</div></div>' +
      '<h2 class="sec">Coming up</h2><div class="upcoming">' + upcoming.join('') + '</div>';

    A.$('#today-add', main).addEventListener('submit', function (e) {
      e.preventDefault();
      var v = A.$('#today-add-in', main).value.trim(); if (!v) return;
      var p = A.parseQuick('task: ' + v); if (!p.date) p.date = D.today();
      A.applyQuick(p); A.toast('Added task: ' + p.title, { undo: true });
      setTimeout(function () { var i = A.$('#today-add-in'); if (i) i.focus(); }, 20);
    });
  };
  A.actions['today-ev'] = function (el) {
    var ev = A.byId(A.state.events, el.getAttribute('data-id')); if (!ev) return;
    var k = el.getAttribute('data-key'), day = D.parse(k);
    var o = A.R.expand(ev, day, D.addDays(day, 1)).filter(function (x) { return x.key === k; })[0];
    A.editEvent(ev, o);
  };
  A.actions['today-mood'] = function (el) {
    var v = +el.getAttribute('data-v'), k = D.todayKey();
    A.commit('Log mood', ['journal'], function (st) { st.journal[k] = Object.assign({}, st.journal[k] || {}, { mood: (st.journal[k] || {}).mood === v ? null : v }); });
  };

  /* ========================================================= SETTINGS */
  A.views.settings = function (main) {
    var s = A.state.settings, P = A.persist;
    var opt = A.f.opt;
    var hours = function (sel, from, to) { var o = ''; for (var h = from; h <= to; h++) o += opt(h, D.hourLabel(h).replace(':00', h === 24 ? ':00 (midnight)' : ':00'), sel); return o; };
    var notifState = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Settings</h1></div></div>' +
      '<div class="settings">' +
      '<section class="card" id="set-general"><h2>General</h2>' +
      '<label class="srow"><span>Your name<small>Used in the greeting.</small></span><input id="s-name" value="' + esc(s.name) + '" placeholder="Optional"></label>' +
      '<label class="srow"><span>Theme</span><select id="s-theme">' + opt('system', 'Match my device', s.theme) + opt('light', 'Light', s.theme) + opt('dark', 'Dark', s.theme) + '</select></label>' +
      '<label class="srow"><span>Week starts on</span><select id="s-ws">' + [1, 0, 6].map(function (d) { return opt(d, D.WEEKDAYS[d], s.weekStart); }).join('') + '</select></label>' +
      '<label class="srow"><span>Time format</span><select id="s-tf">' + opt('24', '24-hour (17:30)', s.timeFormat) + opt('12', '12-hour (5:30pm)', s.timeFormat) + '</select></label>' +
      '</section>' +
      '<section class="card" id="set-calendar"><h2>Calendar</h2>' +
      '<label class="srow"><span>Visible hours<small>The rest of the day is still there if you scroll the hours.</small></span><span class="row"><select id="s-ds">' + hours(s.dayStart, 0, 12) + '</select>to<select id="s-de">' + hours(s.dayEnd, 13, 24) + '</select></span></label>' +
      '<label class="srow"><span>Working hours<small>Shaded on weekdays. "Plan day" and "Find a slot" use them.</small></span><span class="row"><select id="s-ws2">' + hours(s.workStart, 0, 23) + '</select>to<select id="s-we">' + hours(s.workEnd, 1, 24) + '</select></span></label>' +
      '<label class="srow"><span>Snap when dragging</span><select id="s-snap">' + [5, 10, 15, 30, 60].map(function (m) { return opt(m, m + ' minutes', s.snap); }).join('') + '</select></label>' +
      '<label class="srow"><span>Zoom<small>Height of one hour.</small></span><input type="range" id="s-hh" min="32" max="120" step="4" value="' + s.hourHeight + '"></label>' +
      '<label class="srow"><span>Default event length</span><select id="s-dd">' + [15, 30, 45, 60, 90, 120].map(function (m) { return opt(m, D.dur(m), s.defaultDuration); }).join('') + '</select></label>' +
      '<label class="srow"><span>Default reminder</span><select id="s-dr">' + opt(0, 'None', s.defaultReminder) + [5, 10, 15, 30, 60].map(function (m) { return opt(m, D.dur(m) + ' before', s.defaultReminder); }).join('') + '</select></label>' +
      '<label class="srow"><span>Show week numbers</span><input type="checkbox" id="s-wn"' + (s.showWeekNumbers ? ' checked' : '') + '></label>' +
      '<label class="srow"><span>Show completed tasks on the calendar</span><input type="checkbox" id="s-sc"' + (s.showCompleted ? ' checked' : '') + '></label>' +
      '</section>' +
      '<section class="card" id="set-categories"><h2>Categories</h2><p class="muted small">Colour-code events, tasks and goals. Insights adds up time per category.</p><div id="s-cats"></div>' +
      '<button class="btn small" id="s-cat-add">' + A.icon('plus') + 'Add category</button></section>' +
      '<section class="card" id="set-focus"><h2>Focus timer</h2>' +
      '<label class="srow"><span>Focus length</span><span class="row"><input type="number" id="s-pf" min="1" max="180" value="' + s.pomo.focus + '" class="num">min</span></label>' +
      '<label class="srow"><span>Short break</span><span class="row"><input type="number" id="s-ps" min="1" max="60" value="' + s.pomo.short + '" class="num">min</span></label>' +
      '<label class="srow"><span>Long break</span><span class="row"><input type="number" id="s-pl" min="1" max="90" value="' + s.pomo.long + '" class="num">min</span></label>' +
      '<label class="srow"><span>Long break after</span><span class="row"><input type="number" id="s-pe" min="2" max="12" value="' + s.pomo.every + '" class="num">sessions</span></label>' +
      '<label class="srow"><span>Start the next timer automatically</span><input type="checkbox" id="s-pa"' + (s.pomo.autoStart ? ' checked' : '') + '></label>' +
      '<label class="srow"><span>Chime when a timer ends</span><input type="checkbox" id="s-psnd"' + (s.pomo.sound ? ' checked' : '') + '></label>' +
      '</section>' +
      '<section class="card" id="set-reminders"><h2>Reminders</h2>' +
      '<div class="srow"><span>Browser notifications<small>' + (notifState === 'granted' ? 'Allowed.' : notifState === 'denied' ? 'Blocked by the browser. Reminders still show inside the app.' : notifState === 'unsupported' ? 'Not available here. Reminders show inside the app while it is open.' : 'Reminders show inside the app; allow notifications to get them in other tabs too.') + '</small></span>' +
      (notifState === 'default' ? '<button class="btn small" id="s-notif">Allow notifications</button>' : '<input type="checkbox" id="s-notif-on"' + (s.notifications ? ' checked' : '') + (notifState !== 'granted' ? ' disabled' : '') + '>') + '</div>' +
      '<p class="muted small">Reminders fire while Almanac is open in a tab. Export to .ics if you also want them on your phone\'s calendar.</p></section>' +
      '<section class="card" id="set-data"><h2>Your data</h2>' +
      '<div class="srow"><span>Where it lives<small>' + (P.db ? 'Synced to your account, so it follows you to other devices, and cached in this browser.' : 'Saved in this browser. Export a backup now and then; clearing site data deletes it.') + '</small></span><span class="pill ' + (P.status === 'synced' ? 'good' : '') + '">' + esc(syncLabel()[0]) + '</span></div>' +
      '<div class="data-btns">' +
      '<button class="btn" id="s-exp">' + A.icon('download') + 'Back up (JSON)</button>' +
      '<label class="btn file">' + A.icon('upload') + 'Restore backup<input type="file" id="s-imp" accept=".json,application/json"></label>' +
      '<button class="btn" id="s-ics">' + A.icon('download') + 'Export calendar (.ics)</button>' +
      '<button class="btn" id="s-ics-copy">' + A.icon('copy') + 'Copy .ics text</button>' +
      '<label class="btn file">' + A.icon('upload') + 'Import .ics<input type="file" id="s-ics-imp" accept=".ics,text/calendar"></label>' +
      '<button class="btn" id="s-sample">' + A.icon('sparkle') + 'Load example data</button>' +
      '<button class="btn danger" id="s-wipe">' + A.icon('trash') + 'Delete everything</button></div>' +
      '<p class="muted small">' + A.state.events.length + ' events · ' + A.state.tasks.length + ' tasks · ' + A.state.habits.length + ' habits · ' + A.state.goals.length + ' goals · ' + Object.keys(A.state.journal).length + ' journal days · ' + A.state.focus.length + ' focus sessions</p></section>' +
      '<section class="card" id="set-keys"><h2>Keyboard shortcuts</h2>' + shortcutTable() + '</section>' +
      '</div>';

    function set(id, key, conv) {
      var el = A.$('#' + id, main); if (!el) return;
      el.addEventListener('change', function () {
        var v = el.type === 'checkbox' ? el.checked : conv ? conv(el.value) : el.value;
        A.commit('Change setting', ['settings'], function (st) {
          var path = key.split('.'), o = st.settings; while (path.length > 1) o = o[path.shift()]; o[path[0]] = v;
          if (st.settings.dayEnd <= st.settings.dayStart) st.settings.dayEnd = Math.min(24, st.settings.dayStart + 1);
          if (st.settings.workEnd <= st.settings.workStart) st.settings.workEnd = Math.min(24, st.settings.workStart + 1);
        });
        if (key === 'hourHeight' || key === 'dayStart') A.cal.scrollTop = null;
      });
    }
    var num = function (v) { return +v; };
    set('s-name', 'name'); set('s-theme', 'theme'); set('s-ws', 'weekStart', num); set('s-tf', 'timeFormat');
    set('s-ds', 'dayStart', num); set('s-de', 'dayEnd', num); set('s-ws2', 'workStart', num); set('s-we', 'workEnd', num);
    set('s-snap', 'snap', num); set('s-hh', 'hourHeight', num); set('s-dd', 'defaultDuration', num); set('s-dr', 'defaultReminder', num);
    set('s-wn', 'showWeekNumbers'); set('s-sc', 'showCompleted');
    set('s-pf', 'pomo.focus', function (v) { return A.clamp(+v || 25, 1, 180); }); set('s-ps', 'pomo.short', function (v) { return A.clamp(+v || 5, 1, 60); });
    set('s-pl', 'pomo.long', function (v) { return A.clamp(+v || 15, 1, 90); }); set('s-pe', 'pomo.every', function (v) { return A.clamp(+v || 4, 2, 12); });
    set('s-pa', 'pomo.autoStart'); set('s-psnd', 'pomo.sound'); set('s-notif-on', 'notifications');

    var nb = A.$('#s-notif', main);
    if (nb) nb.addEventListener('click', function () {
      try {
        Notification.requestPermission().then(function (p) {
          if (p === 'granted') A.commit('Enable notifications', ['settings'], function (st) { st.settings.notifications = true; });
          else { A.toast('Notifications were not allowed. Reminders will show inside the app.'); A.render(); }
        });
      } catch (e) { A.toast('This browser cannot show notifications here.'); }
    });

    /* categories editor */
    function paintCats() {
      A.$('#s-cats', main).innerHTML = A.state.categories.map(function (c) {
        var used = A.state.events.filter(function (e) { return e.catId === c.id; }).length;
        return '<div class="catrow"><label class="colorpick" style="--c:' + c.color + '"><input type="color" value="' + c.color + '" data-cc="' + c.id + '" aria-label="Colour"></label>' +
          '<input value="' + esc(c.name) + '" data-cn="' + c.id + '" aria-label="Name"><small class="muted">' + used + ' events</small>' +
          '<button class="icon-btn subtle" data-cd="' + c.id + '" aria-label="Delete ' + esc(c.name) + '">' + A.icon('trash') + '</button></div>';
      }).join('');
      A.$$('[data-cc]', main).forEach(function (el) { el.addEventListener('change', function () { A.commit('Edit category', ['categories'], function (st) { A.byId(st.categories, el.getAttribute('data-cc')).color = el.value; }); }); });
      A.$$('[data-cn]', main).forEach(function (el) { el.addEventListener('change', function () { var v = el.value.trim(); if (v) A.commit('Rename category', ['categories'], function (st) { A.byId(st.categories, el.getAttribute('data-cn')).name = v; }); }); });
      A.$$('[data-cd]', main).forEach(function (el) {
        el.addEventListener('click', function () {
          var c = A.byId(A.state.categories, el.getAttribute('data-cd'));
          A.confirm('Delete "' + c.name + '"? Events and tasks in it become uncategorised.', { ok: 'Delete', danger: true }).then(function (ok) {
            if (!ok) return;
            A.commit('Delete category', ['categories', 'events', 'tasks', 'goals', 'templates'], function (st) {
              st.categories = st.categories.filter(function (x) { return x.id !== c.id; });
              st.events.concat(st.tasks, st.goals).forEach(function (x) { if (x.catId === c.id) x.catId = ''; });
              st.templates.forEach(function (t) { t.blocks.forEach(function (b) { if (b.catId === c.id) b.catId = ''; }); });
            });
            A.toast('Deleted category', { undo: true });
          });
        });
      });
    }
    paintCats();
    A.$('#s-cat-add', main).addEventListener('click', function () {
      A.commit('Add category', ['categories'], function (st) { st.categories.push({ id: A.uid(), name: 'New category', color: A.colors[st.categories.length % A.colors.length] }); });
      setTimeout(function () { var ins = A.$$('[data-cn]'); var last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } }, 30);
    });

    /* data */
    A.$('#s-exp', main).addEventListener('click', function () {
      var blob = { app: 'almanac', version: 1, exportedAt: new Date().toISOString() };
      A.KINDS.forEach(function (k) { blob[k] = A.state[k]; });
      A.download('almanac-backup-' + D.todayKey() + '.json', JSON.stringify(blob, null, 2), 'application/json');
    });
    A.$('#s-imp', main).addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var data; try { data = JSON.parse(r.result); } catch (x) { A.toast('That file is not valid JSON.'); return; }
        if (!data || (!data.events && !data.tasks)) { A.toast('That file is not an Almanac backup.'); return; }
        A.confirm('Replace everything here with the backup from ' + (data.exportedAt ? D.fmt(new Date(data.exportedAt), 'medium') : 'that file') + '? You can undo this.', { ok: 'Restore backup' }).then(function (ok) {
          if (!ok) return;
          var fresh = A.hydrate(data);
          A.commit('Restore backup', A.KINDS, function (st) { A.KINDS.forEach(function (k) { st[k] = fresh[k]; }); });
          A.toast('Backup restored', { undo: true });
        });
      };
      r.readAsText(f);
      e.target.value = '';
    });
    A.$('#s-ics', main).addEventListener('click', function () { A.download('almanac-' + D.todayKey() + '.ics', A.ICS.export(A.state.events), 'text/calendar'); });
    A.$('#s-ics-copy', main).addEventListener('click', function () {
      var text = A.ICS.export(A.state.events);
      try { navigator.clipboard.writeText(text).then(function () { A.toast('Copied. Paste into a file named almanac.ics.'); }, function () { showText(text); }); } catch (x) { showText(text); }
    });
    A.$('#s-ics-imp', main).addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var evs = A.ICS.parse(r.result);
        if (!evs.length) { A.toast('No events found in that file.'); return; }
        A.commit('Import calendar', ['events'], function (st) { evs.forEach(function (x) { st.events.push(x); }); });
        A.toast('Imported ' + evs.length + ' events', { undo: true });
      };
      r.readAsText(f); e.target.value = '';
    });
    A.$('#s-sample', main).addEventListener('click', function () {
      A.confirm('Add example events, tasks, habits, goals and journal entries alongside your own? "Clear example data" later removes everything except settings.', { ok: 'Add examples' }).then(function (ok) {
        if (!ok) return;
        var sample = A.sampleData();
        A.commit('Load examples', A.KINDS, function (st) {
          ['events', 'tasks', 'habits', 'goals', 'focus', 'templates'].forEach(function (k) { st[k] = st[k].concat(sample[k]); });
          sample.projects.forEach(function (p) { if (!A.byId(st.projects, p.id)) st.projects.push(p); });
          Object.keys(sample.journal).forEach(function (k) { if (!st.journal[k]) st.journal[k] = sample.journal[k]; });
          st.settings.sample = true;
        });
        A.ui.bannerOff = false; A.remember(); A.go('today');
      });
    });
    A.$('#s-wipe', main).addEventListener('click', function () {
      A.confirm('Delete every event, task, habit, goal, journal entry and setting? Back up first if you might want them. You can undo this until you close the page.', { ok: 'Delete everything', danger: true }).then(function (ok) {
        if (!ok) return;
        var fresh = A.emptyState();
        A.commit('Delete everything', A.KINDS, function (st) { A.KINDS.forEach(function (k) { st[k] = fresh[k]; }); });
        A.toast('Everything deleted', { undo: true }); A.go('today');
      });
    });
  };
  function showText(text) {
    A.modal({ title: 'Calendar (.ics)', size: 'md', body: '<p class="muted small">Select all, copy, and save as a file ending in .ics.</p><textarea class="mono" rows="14" readonly id="ics-text">' + esc(text) + '</textarea>',
      onMount: function (r) { var t = A.$('#ics-text', r); setTimeout(function () { t.focus(); t.select(); }, 50); } });
  }

  /* ======================================================== SHORTCUTS */
  var KEYS = [
    ['Ctrl/⌘ K', 'Search, jump anywhere, run a command'], ['N', 'Quick add (natural language)'], ['E', 'New event'], ['Shift N', 'New task'],
    ['1 – 9', 'Today, Calendar, Tasks, Timetable, Habits, Goals, Focus, Journal, Insights'], [',', 'Settings'],
    ['T', 'Jump to today'], ['← / →  or  J / K', 'Previous / next period'], ['D  X  W  M  A  Y', 'Day, 3-day, week, month, agenda, year'],
    ['Ctrl/⌘ Z', 'Undo'], ['Ctrl/⌘ Shift Z', 'Redo'], ['Space', 'Start or pause the focus timer (on Focus)'],
    ['Ctrl/⌘ Enter', 'Save the open form'], ['Esc', 'Close a dialog or menu'], ['?', 'This list']
  ];
  function shortcutTable() { return '<dl class="keys">' + KEYS.map(function (k) { return '<dt>' + k[0].split('  ').map(function (x) { return '<kbd>' + esc(x) + '</kbd>'; }).join(' ') + '</dt><dd>' + esc(k[1]) + '</dd>'; }).join('') + '</dl>'; }
  function showShortcuts() { A.modal({ title: 'Keyboard shortcuts', size: 'md', body: shortcutTable() }); }

  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey, k = e.key;
    if (k === 'Escape') {
      var top = A.topModal(); if (top) { e.preventDefault(); top.close(); return; }
      closeDrawer(); return;
    }
    if (mod && (k === 'k' || k === 'K')) { e.preventDefault(); if (!A.topModal()) A.openPalette(''); return; }
    if (mod && (k === 'z' || k === 'Z') && !typing(e)) { e.preventDefault(); A.actions[e.shiftKey ? 'redo' : 'undo'](); return; }
    if (mod && (k === 'y' || k === 'Y') && !typing(e)) { e.preventDefault(); A.actions.redo(); return; }
    if (mod || e.altKey || typing(e) || A.topModal()) return;
    var r = ROUTES.filter(function (x) { return x.key === k; })[0];
    if (r) { e.preventDefault(); A.go(r.id); return; }
    if (k === '/') { e.preventDefault(); A.openPalette(''); return; }
    if (k === '?') { e.preventDefault(); showShortcuts(); return; }
    if (k === 'n' || k === 'N') { e.preventDefault(); if (e.shiftKey) A.editTask(null); else A.openQuickAdd(''); return; }
    if (k === 'e' || k === 'E') { e.preventDefault(); A.editEvent(null, null); return; }
    if (A.ui.route === 'focus' && k === ' ') { e.preventDefault(); A.timer.running ? A.timerPause() : A.timerStart(); return; }
    if (A.ui.route === 'calendar') {
      if (k === 't' || k === 'T') { A.actions['cal-today'](); return; }
      if (k === 'ArrowLeft' || k === 'j' || k === 'J') { A.cal.step(-1); return; }
      if (k === 'ArrowRight' || k === 'k' || k === 'K') { A.cal.step(1); return; }
      var modes = { d: 'day', x: '3day', w: 'week', m: 'month', a: 'agenda', y: 'year' };
      if (modes[k.toLowerCase()]) { A.cal.mode = modes[k.toLowerCase()]; A.remember(); A.render(); return; }
    } else if (k === 't' || k === 'T') { A.go('today'); }
  });

  /* ======================================================== COMMANDS */
  function cmds() {
    ROUTES.forEach(function (r) { A.addCommand({ group: 'Go to', label: r.name, icon: r.icon, hint: r.key, run: function () { A.go(r.id); } }); });
    [
      { label: 'Quick add', icon: 'plus', hint: 'N', keywords: 'new create', run: function () { A.openQuickAdd(''); } },
      { label: 'New event', icon: 'calendar', hint: 'E', keywords: 'create appointment meeting', run: function () { A.editEvent(null, null); } },
      { label: 'New task', icon: 'tasks', hint: 'Shift N', keywords: 'todo create', run: function () { A.editTask(null); } },
      { label: 'New habit', icon: 'habits', run: function () { A.go('habits'); A.editHabit(null); } },
      { label: 'New goal', icon: 'goals', run: function () { A.go('goals'); A.editGoal(null); } },
      { label: 'New project', icon: 'layers', run: function () { A.editProject(null); } },
      { label: 'Plan my day (auto-schedule tasks)', icon: 'wand', keywords: 'schedule fit', run: function () { A.autoSchedule(D.today()); } },
      { label: 'Plan tomorrow', icon: 'wand', keywords: 'schedule fit', run: function () { A.autoSchedule(D.addDays(D.today(), 1)); } },
      { label: 'Start focus timer', icon: 'play', keywords: 'pomodoro', when: function () { return !A.timer.running; }, run: function () { A.timerStart(); } },
      { label: 'Pause focus timer', icon: 'pause', when: function () { return A.timer.running; }, run: function () { A.timerPause(); } },
      { label: 'Write today\'s journal', icon: 'journal', run: function () { A.go('journal', { date: D.today() }); } },
      { label: 'Calendar: day view', icon: 'calendar', hint: 'D', run: function () { A.cal.mode = 'day'; A.go('calendar'); } },
      { label: 'Calendar: week view', icon: 'calendar', hint: 'W', run: function () { A.cal.mode = 'week'; A.go('calendar'); } },
      { label: 'Calendar: month view', icon: 'calendar', hint: 'M', run: function () { A.cal.mode = 'month'; A.go('calendar'); } },
      { label: 'Calendar: agenda', icon: 'list', hint: 'A', run: function () { A.cal.mode = 'agenda'; A.go('calendar'); } },
      { label: 'Calendar: year', icon: 'calendar', hint: 'Y', run: function () { A.cal.mode = 'year'; A.go('calendar'); } },
      { label: 'Tasks: board', icon: 'board', keywords: 'kanban', run: function () { A.tasksUI.layout = 'board'; A.go('tasks'); } },
      { label: 'Tasks: Eisenhower matrix', icon: 'matrix', keywords: 'priority urgent important', run: function () { A.tasksUI.layout = 'matrix'; A.go('tasks'); } },
      { label: 'Tasks: overdue', icon: 'clock', run: function () { A.tasksUI.list = 'overdue'; A.go('tasks'); } },
      { label: 'Toggle dark mode', icon: 'moon', keywords: 'theme light', run: function () { A.actions.theme(); } },
      { label: 'Undo', icon: 'undo', hint: 'Ctrl Z', run: function () { A.actions.undo(); } },
      { label: 'Redo', icon: 'redo', run: function () { A.actions.redo(); } },
      { label: 'Back up data (JSON)', icon: 'download', keywords: 'export save', run: function () { A.go('settings', { section: 'data' }); } },
      { label: 'Export calendar (.ics)', icon: 'download', run: function () { A.download('almanac-' + D.todayKey() + '.ics', A.ICS.export(A.state.events), 'text/calendar'); } },
      { label: 'Keyboard shortcuts', icon: 'keyboard', hint: '?', run: showShortcuts }
    ].forEach(A.addCommand);
  }

  /* ======================================================== REMINDERS */
  var FK = 'almanac.fired';
  A.notify = function (title, body) {
    try {
      if (A.state.settings.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        new Notification(title, { body: body, tag: 'almanac-' + body.slice(0, 40) });
      }
    } catch (e) {}
  };
  function checkReminders() {
    var now = new Date(), fired = {};
    try { fired = JSON.parse(localStorage.getItem(FK) || '{}'); } catch (e) {}
    var changed = false;
    A.occurrences(D.addDays(now, -1), D.addDays(now, 3), { all: true }).forEach(function (o) {
      (o.ev.reminders || []).forEach(function (m) {
        var at = o.ev.allDay ? D.fromMinutes(o.start, 9 * 60 - m) : D.addMin(o.start, -m), id = o.ev.id + '@' + o.key + '@' + m;
        if (now >= at && now - at < 5 * 60000 && !fired[id]) {
          fired[id] = Date.now(); changed = true;
          var when = o.ev.allDay ? D.rel(o.start) : m === 0 ? 'now' : 'in ' + D.dur(m) + ' at ' + D.time(o.start);
          A.toast(o.ev.title + ' ' + when + (o.ev.location ? ' · ' + o.ev.location : ''), { ms: 12000, action: { label: 'Open', fn: function () { A.editEvent(o.ev, o); } } });
          A.notify(o.ev.title, (o.ev.allDay ? 'Today' : D.time(o.start) + '–' + D.time(o.end)) + (o.ev.location ? ' · ' + o.ev.location : ''));
        }
      });
    });
    A.state.tasks.forEach(function (t) {
      if (t.status === 'done' || !t.due || !t.dueTime) return;
      var at = D.parse(t.due + 'T' + t.dueTime), id = 'task@' + t.id + '@' + t.due + t.dueTime;
      if (now >= at && now - at < 5 * 60000 && !fired[id]) {
        fired[id] = Date.now(); changed = true;
        A.toast('Due now: ' + t.title, { ms: 12000, action: { label: 'Done', fn: function () { A.toggleTask(t); } } });
        A.notify('Task due', t.title);
      }
    });
    if (changed) {
      var cutoff = Date.now() - 4 * D.DAY;
      Object.keys(fired).forEach(function (k) { if (fired[k] < cutoff) delete fired[k]; });
      try { localStorage.setItem(FK, JSON.stringify(fired)); } catch (e) {}
    }
  }

  /* ======================================================= CELEBRATE */
  A.celebrate = function (big) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('canvas'); c.className = 'confetti';
    var dpr = window.devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    var colors = A.state.categories.map(function (x) { return x.color; });
    var n = big ? 140 : 36, ps = [], ox = big ? innerWidth / 2 : innerWidth - 120, oy = big ? innerHeight / 3 : innerHeight - 80;
    for (var i = 0; i < n; i++) ps.push({ x: ox, y: oy, vx: (Math.random() - 0.5) * (big ? 14 : 8), vy: -Math.random() * (big ? 14 : 9) - 2, r: 3 + Math.random() * 4, c: colors[i % colors.length], a: Math.random() * 6, life: 1 });
    var t0 = performance.now();
    (function frame(t) {
      var dt = Math.min(32, t - t0) / 16; t0 = t;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      var alive = false;
      ps.forEach(function (p) {
        p.vy += 0.35 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += 0.2 * dt; p.life -= 0.012 * dt;
        if (p.life > 0 && p.y < innerHeight + 20) alive = true;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      });
      if (alive) requestAnimationFrame(frame); else c.remove();
    })(t0);
  };

  /* ====================================================== SAMPLE DATA
   * Built relative to today so every screen has a realistic week. */
  A.sampleData = function () {
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var today = D.today(), ws = D.startOfWeek(today, 1), out = { events: [], tasks: [], habits: [], goals: [], journal: {}, focus: [], templates: [], projects: [] };
    var at = function (dayOff, hm) { var d = D.addDays(ws, dayOff), p = hm.split(':'); d.setHours(+p[0], +p[1]); return D.stamp(d); };
    var ev = function (o) { out.events.push(Object.assign({ id: A.uid(), location: '', notes: '', allDay: false, reminders: [10], exdates: [], recur: null, catId: '' }, o)); };
    var start = D.addDays(ws, -28), until = D.key(D.addDays(ws, 7 * 16));
    var at0 = function (dayIdx, hm) { var d = D.addDays(start, (dayIdx - 1 + 7) % 7), p = hm.split(':'); d.setHours(+p[0], +p[1]); return D.stamp(d); };
    ev({ title: 'Gym: strength', start: at0(1, '07:00'), end: at0(1, '08:00'), catId: 'c-health', location: 'City gym', recur: { freq: 'weekly', interval: 1, byDay: [1, 3, 5], until: until } });
    ev({ title: 'Stand-up', start: at0(1, '09:30'), end: at0(1, '09:45'), catId: 'c-work', location: 'Meet', recur: { freq: 'weekdays', interval: 1, until: until }, reminders: [5] });
    ev({ title: 'Deep work', start: at0(2, '10:00'), end: at0(2, '12:00'), catId: 'c-work', recur: { freq: 'weekly', interval: 1, byDay: [2, 4], until: until }, reminders: [] });
    ev({ title: 'Statistics lecture', start: at0(2, '14:00'), end: at0(2, '15:30'), catId: 'c-study', location: 'Hall B', recur: { freq: 'weekly', interval: 1, byDay: [2, 4], until: until } });
    ev({ title: 'Spanish class', start: at0(3, '18:30'), end: at0(3, '19:30'), catId: 'c-study', location: 'Online', recur: { freq: 'weekly', interval: 1, byDay: [3], until: until } });
    ev({ title: 'Weekly review', start: at0(5, '16:30'), end: at0(5, '17:00'), catId: 'c-personal', recur: { freq: 'weekly', interval: 1, byDay: [5] }, notes: 'Inbox to zero, look at next week, pick 3 priorities.' });
    ev({ title: 'Family dinner', start: at0(0, '19:00'), end: at0(0, '21:00'), catId: 'c-social', location: "Mum's", recur: { freq: 'weekly', interval: 1, byDay: [0] } });
    ev({ title: 'Long run', start: at0(6, '08:30'), end: at0(6, '09:45'), catId: 'c-health', recur: { freq: 'weekly', interval: 1, byDay: [6] }, reminders: [] });
    ev({ title: 'Pay rent', start: D.key(new Date(today.getFullYear(), today.getMonth(), 1)), end: D.key(new Date(today.getFullYear(), today.getMonth(), 1)), allDay: true, catId: 'c-errands', recur: { freq: 'monthly', interval: 1 }, reminders: [] });
    ev({ title: 'Lunch with Maya', start: at(3, '12:30'), end: at(3, '13:30'), catId: 'c-social', location: 'Café Nord' });
    ev({ title: 'Project kickoff', start: at(1, '13:00'), end: at(1, '14:30'), catId: 'c-work', location: 'Room 4', notes: 'Bring the timeline draft.' });
    ev({ title: 'Dentist', start: at(8, '15:00'), end: at(8, '15:45'), catId: 'c-errands', location: 'Smile Clinic', reminders: [60, 1440] });
    ev({ title: 'Haircut', start: at(4, '17:30'), end: at(4, '18:00'), catId: 'c-errands' });
    ev({ title: 'Movie night', start: at(5, '20:00'), end: at(5, '22:30'), catId: 'c-social' });
    ev({ title: "Sam's birthday", start: D.key(D.addDays(ws, 9)), end: D.key(D.addDays(ws, 9)), allDay: true, catId: 'c-social', recur: { freq: 'yearly', interval: 1 }, reminders: [1440] });
    ev({ title: 'Weekend trip', start: D.key(D.addDays(ws, 19)), end: D.key(D.addDays(ws, 20)), allDay: true, catId: 'c-rest', location: 'Lake house' });
    ev({ title: 'Statistics midterm', start: at(16, '09:00'), end: at(16, '11:00'), catId: 'c-study', location: 'Hall A', reminders: [60, 1440] });

    out.projects = [{ id: 'p-thesis', name: 'Thesis', color: '#8A4FD8' }, { id: 'p-home', name: 'Home', color: '#D9831F' }, { id: 'p-work', name: 'Work', color: '#3A63E0' }];
    var tk = function (o) { var t = A.newTask(Object.assign({ created: D.key(D.addDays(today, -5)) }, o)); out.tasks.push(t); return t; };
    var dk = function (n) { return D.key(D.addDays(today, n)); };
    tk({ title: 'Draft literature review section', projectId: 'p-thesis', priority: 3, due: dk(1), estimate: 120, catId: 'c-study', goalId: 'g-thesis', subtasks: [{ id: A.uid(), title: 'Collect 10 key papers', done: true }, { id: A.uid(), title: 'Outline themes', done: true }, { id: A.uid(), title: 'Write first pass', done: false }] });
    tk({ title: 'Email supervisor about data access', projectId: 'p-thesis', priority: 2, due: dk(-1), estimate: 15, catId: 'c-study', goalId: 'g-thesis' });
    tk({ title: 'Run regression on survey data', projectId: 'p-thesis', priority: 2, due: dk(4), estimate: 90, catId: 'c-study', goalId: 'g-thesis', tags: ['deep-work'] });
    tk({ title: 'Prepare slides for kickoff', projectId: 'p-work', priority: 3, due: dk(0), dueTime: '11:00', estimate: 60, catId: 'c-work' });
    tk({ title: 'Review Q4 budget', projectId: 'p-work', priority: 1, due: dk(2), estimate: 45, catId: 'c-work' });
    tk({ title: 'Book flights for the wedding', priority: 2, due: dk(0), estimate: 20, catId: 'c-personal', tags: ['travel'] });
    tk({ title: 'Fix the leaking tap', projectId: 'p-home', priority: 1, estimate: 30, catId: 'c-errands' });
    tk({ title: 'Buy groceries', projectId: 'p-home', due: dk(0), estimate: 40, catId: 'c-errands', repeat: { freq: 'weekly', interval: 1 }, subtasks: ['Oats', 'Eggs', 'Spinach', 'Coffee'].map(function (x) { return { id: A.uid(), title: x, done: false }; }) });
    tk({ title: 'Call grandma', priority: 2, due: dk(-2), estimate: 20, catId: 'c-social' });
    tk({ title: 'Read "Deep Work" ch. 3', priority: 0, estimate: 30, catId: 'c-personal', goalId: 'g-books', tags: ['reading'] });
    tk({ title: 'Renew passport', priority: 1, due: dk(12), estimate: 30, catId: 'c-errands' });
    tk({ title: 'Clean up desktop files', priority: 0, estimate: 15 });
    ['Submit expense report', 'Plan Spanish homework', 'Water the plants', 'Back up laptop'].forEach(function (title, i) {
      var t = tk({ title: title, status: 'done', due: dk(-i), estimate: 20 }); t.completedAt = D.addMin(D.addDays(today, -i), 10 * 60 + i * 37).toISOString();
    });
    var doneToday = tk({ title: 'Morning stretch', status: 'done', due: dk(0), estimate: 10, catId: 'c-health' }); doneToday.completedAt = D.addMin(today, 7 * 60 + 40).toISOString();

    var hb = function (o, p) {
      var h = Object.assign({ id: A.uid(), days: [], target: 1, unit: '', log: {}, created: D.key(D.addDays(today, -90)) }, o);
      for (var i = 90; i >= 1; i--) {
        var d = D.addDays(today, -i); if (!A.habitDue(h, d)) continue;
        if (rnd() < p) h.log[D.key(d)] = h.target > 1 ? Math.max(1, Math.min(h.target, Math.round(h.target * (0.7 + rnd() * 0.45)))) : 1;
      }
      out.habits.push(h); return h;
    };
    var read = hb({ name: 'Read 20 pages', color: '#8A4FD8' }, 0.82);
    hb({ name: 'Drink water', color: '#2A9DB0', target: 8, unit: 'glasses' }, 0.9);
    hb({ name: 'Meditate 10 min', color: '#1F9A5B' }, 0.6);
    hb({ name: 'Gym', color: '#D0457A', days: [1, 3, 5] }, 0.85);
    hb({ name: 'No phone after 22:00', color: '#D9831F' }, 0.5);
    for (var s = 1; s <= 9; s++) read.log[D.key(D.addDays(today, -s))] = 1;
    out.habits[1].log[D.todayKey()] = 3;

    out.goals.push({ id: 'g-thesis', title: 'Submit my thesis', why: 'Finish strong and start the job in March with a clear head.', catId: 'c-study', deadline: dk(75), created: dk(-40), milestones: [
      { id: A.uid(), title: 'Proposal approved', done: true, due: dk(-30) }, { id: A.uid(), title: 'Data collected', done: true, due: dk(-5) },
      { id: A.uid(), title: 'First full draft', done: false, due: dk(40) }, { id: A.uid(), title: 'Final submission', done: false, due: dk(75) }] });
    out.goals.push({ id: 'g-books', title: 'Read 24 books this year', why: 'Less scrolling, more reading.', catId: 'c-personal', deadline: D.key(new Date(today.getFullYear(), 11, 31)), created: D.key(new Date(today.getFullYear(), 0, 1)), target: 24, current: 17, unit: 'books', milestones: [] });
    out.goals.push({ id: 'g-run', title: 'Run a half marathon', why: 'Prove to myself I can.', catId: 'c-health', deadline: dk(120), created: dk(-30), target: 21, current: 12, unit: 'km longest run', milestones: [
      { id: A.uid(), title: 'Run 5 km without stopping', done: true }, { id: A.uid(), title: 'Run 10 km', done: true }, { id: A.uid(), title: 'Run 15 km', done: false }, { id: A.uid(), title: 'Sign up for a race', done: false }] });

    var notes = ['Productive morning. Kickoff prep took longer than expected.', 'Tired after the gym but slept well.', 'Good chat with Maya, felt lighter afterwards.', 'Stuck on the regression for an hour. Walked, came back, solved it.', 'Quiet day. Read for an hour in the park.', '', 'Too many meetings; need more deep-work blocks.'];
    for (var j = 1; j <= 24; j++) {
      if (rnd() < 0.2) continue;
      out.journal[D.key(D.addDays(today, -j))] = { mood: Math.max(1, Math.min(5, Math.round(3.4 + (rnd() - 0.4) * 2.6))), energy: 2 + Math.round(rnd() * 3), sleep: Math.round((6 + rnd() * 2.5) * 2) / 2, text: notes[j % notes.length], gratitude: ['Coffee with a friend', 'Sunny walk', ''] };
    }
    for (var f = 0; f < 7; f++) {
      var n = f === 0 ? 1 : 1 + Math.floor(rnd() * 4);
      for (var q = 0; q < n; q++) {
        var st = D.fromMinutes(D.addDays(today, -f), (9 + q * 2) * 60 + 15);
        out.focus.push({ id: A.uid(), start: D.stamp(st), minutes: 25 + (rnd() < 0.3 ? 25 : 0), taskId: '', catId: q % 2 ? 'c-study' : 'c-work', label: q % 2 ? 'Thesis writing' : 'Deep work' });
      }
    }
    out.templates.push(A.ttPreset('student'));
    return out;
  };

  /* ============================================================ BOOT */
  function boot() {
    var local = A.persist.readLocal();
    if (local) {
      A.state = A.hydrate(local);
      A.savedAt = local.savedAt || 0;
    } else {
      var s = A.emptyState(), sample = A.sampleData();
      Object.keys(sample).forEach(function (k) { s[k] = k === 'projects' ? s.projects.concat(sample.projects) : sample[k]; });
      s.settings.sample = true;
      A.state = s; A.savedAt = 0;
      A.persist.writeLocal();
    }
    restoreUI();
    var hash = (location.hash || '').replace('#', '');
    if (hash && A.views[hash]) A.ui.route = hash;
    cmds();
    A.render();
    document.body.classList.add('ready');
    A.persist.connect(function (remote) {
      A.state = A.hydrate(remote); A.savedAt = remote.savedAt; A.resetHistory();
      A.persist.writeLocal(); A.render();
      A.toast('Loaded your planner from your account');
    });
    setInterval(function () { A.updateNowLine(); }, 60000);
    setInterval(checkReminders, 30000); setTimeout(checkReminders, 3000);
    /* refresh "today" when the date rolls over or the tab comes back */
    var lastDay = D.todayKey();
    setInterval(function () { if (D.todayKey() !== lastDay) { lastDay = D.todayKey(); A.render(); } }, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { checkReminders(); if (A.ui.route === 'today') A.render(); } else A.persist.flush(); });
    window.addEventListener('beforeunload', function () { A.persist.writeLocal(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
