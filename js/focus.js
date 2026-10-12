/* Almanac — focus timer, insights, weekly timetables. */
'use strict';
(function () {
  var D = A.D, esc = A.esc;

  /* ============================================================= FOCUS */
  var TK = 'almanac.timer';
  var timer = A.timer = (function () {
    try { var t = JSON.parse(localStorage.getItem(TK)); if (t && t.mode) return t; } catch (e) {}
    return { mode: 'focus', running: false, endsAt: 0, remaining: null, taskId: '', label: '', cycle: 0, startedAt: 0 };
  })();
  function saveTimer() { try { localStorage.setItem(TK, JSON.stringify(timer)); } catch (e) {} }
  function lengthOf(mode) { var p = A.state.settings.pomo; return (mode === 'focus' ? p.focus : mode === 'short' ? p.short : p.long) * 60; }
  A.timerLeft = function () {
    if (timer.running) return Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
    return timer.remaining != null ? timer.remaining : lengthOf(timer.mode);
  };
  function mmss(s) { return A.pad(Math.floor(s / 60)) + ':' + A.pad(s % 60); }
  A.timerLabel = function () { return mmss(A.timerLeft()); };

  var wake = null;
  function lock(on) {
    try {
      if (on && navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {});
      if (!on && wake) { wake.release(); wake = null; }
    } catch (e) {}
  }
  var actx = null;
  function chime() {
    if (!A.state.settings.pomo.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach(function (t, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = [660, 880, 990][i];
        g.gain.setValueAtTime(0.0001, actx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.2, actx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.5);
        o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.55);
      });
    } catch (e) {}
  }

  function logSession(minutes) {
    if (minutes < 1) return;
    var t = timer.taskId ? A.byId(A.state.tasks, timer.taskId) : null;
    A.commit('Log focus', ['focus', 'tasks'], function (st) {
      st.focus.push({ id: A.uid(), start: D.stamp(new Date(timer.startedAt || Date.now() - minutes * 60000)), minutes: Math.round(minutes), taskId: timer.taskId || '', catId: t ? t.catId || '' : '', label: t ? t.title : timer.label || 'Focus' });
      if (t) { var x = A.byId(st.tasks, t.id); if (x) x.spent = (x.spent || 0) + Math.round(minutes); }
    });
  }
  A.timerStart = function () {
    if (timer.running) return;
    var left = A.timerLeft();
    timer.running = true; timer.endsAt = Date.now() + left * 1000;
    if (!timer.startedAt || timer.remaining == null) timer.startedAt = Date.now();
    timer.remaining = null; saveTimer(); lock(true);
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    A.render();
  };
  A.timerPause = function () {
    if (!timer.running) return;
    timer.remaining = A.timerLeft(); timer.running = false; saveTimer(); lock(false); A.render();
  };
  A.timerReset = function (mode) {
    timer.running = false; timer.remaining = null; timer.startedAt = 0; if (mode) timer.mode = mode; saveTimer(); lock(false); A.render();
  };
  A.timerStop = function () {
    var done = (lengthOf(timer.mode) - A.timerLeft()) / 60;
    if (timer.mode === 'focus' && done >= 1) { logSession(done); A.toast('Logged ' + D.dur(done) + ' of focus', { undo: true }); }
    A.timerReset();
  };
  function finish() {
    var p = A.state.settings.pomo, was = timer.mode;
    timer.running = false; timer.remaining = null; lock(false);
    if (was === 'focus') {
      logSession(lengthOf('focus') / 60);
      timer.cycle = (timer.cycle || 0) + 1;
      timer.mode = timer.cycle % p.every === 0 ? 'long' : 'short';
    } else timer.mode = 'focus';
    timer.startedAt = 0; saveTimer();
    chime();
    var msg = was === 'focus' ? 'Focus session done. Take a ' + (timer.mode === 'long' ? 'long' : 'short') + ' break.' : 'Break over. Ready for the next one?';
    A.notify('Almanac', msg);
    A.toast(msg, { ms: 8000 });
    if (p.autoStart) A.timerStart(); else A.render();
  }
  A.focusOn = function (taskId) {
    timer.taskId = taskId; if (timer.mode !== 'focus' && !timer.running) timer.mode = 'focus';
    saveTimer(); A.go('focus');
  };
  setInterval(function () {
    if (!timer.running) return;
    var left = A.timerLeft();
    var el = A.$('#ft-clock'); if (el) el.textContent = mmss(left);
    var ring = A.$('#ft-ring'); if (ring) { var c = +ring.getAttribute('data-c'); ring.setAttribute('stroke-dashoffset', (c * (1 - left / lengthOf(timer.mode))).toFixed(1)); }
    var pill = A.$('#timer-pill-t'); if (pill) pill.textContent = mmss(left);
    document.title = mmss(left) + ' · ' + (timer.mode === 'focus' ? 'Focus' : 'Break') + ' · Almanac';
    if (left <= 0) { document.title = 'Almanac'; finish(); }
  }, 1000);

  A.views.focus = function (main) {
    var p = A.state.settings.pomo, left = A.timerLeft(), total = lengthOf(timer.mode);
    var R = 120, C = 2 * Math.PI * R;
    var todayK = D.todayKey();
    var todays = A.state.focus.filter(function (f) { return f.start.slice(0, 10) === todayK; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    var todayMin = A.sum(todays, function (f) { return f.minutes; });
    var open = A.state.tasks.filter(A.taskOpen).sort(function (a, b) { return (a.due || '9') < (b.due || '9') ? -1 : 1; });
    var week = []; for (var i = 6; i >= 0; i--) { var d = D.addDays(D.today(), -i), k = D.key(d); week.push({ label: D.WD[d.getDay()].slice(0, 2), value: A.sum(A.state.focus.filter(function (f) { return f.start.slice(0, 10) === k; }), function (f) { return f.minutes; }), hl: i === 0 }); }
    var cur = timer.taskId ? A.byId(A.state.tasks, timer.taskId) : null;
    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Focus</h1><span class="muted">' + D.dur(todayMin) + ' today · ' + todays.length + ' session' + (todays.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="vh-right"><button class="btn" data-act="focus-log">' + A.icon('plus') + '<span>Log time</span></button><button class="btn" data-act="go" data-to="settings" data-sec="focus">' + A.icon('settings') + '<span>Durations</span></button></div></div>' +
      '<div class="focus">' +
      '<section class="ftimer card mode-' + timer.mode + '">' +
      '<div class="seg">' + [['focus', 'Focus', p.focus], ['short', 'Short break', p.short], ['long', 'Long break', p.long]].map(function (m) {
        return '<button class="' + (timer.mode === m[0] ? 'on' : '') + '" data-act="focus-mode" data-m="' + m[0] + '">' + m[1] + ' <small>' + m[2] + 'm</small></button>';
      }).join('') + '</div>' +
      '<div class="fclock"><svg viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="' + R + '" fill="none" stroke="var(--track)" stroke-width="10"/>' +
      '<circle id="ft-ring" data-c="' + C.toFixed(1) + '" cx="140" cy="140" r="' + R + '" fill="none" stroke="var(--ring)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - left / total)).toFixed(1) + '" transform="rotate(-90 140 140)"/></svg>' +
      '<div class="fc-in"><span id="ft-clock" class="fc-t">' + mmss(left) + '</span><span class="fc-m">' + (timer.mode === 'focus' ? (cur ? esc(cur.title) : esc(timer.label || 'Deep work')) : timer.mode === 'short' ? 'Short break' : 'Long break') + '</span></div></div>' +
      '<div class="fcycle" aria-label="Sessions this cycle">' + Array.apply(null, Array(p.every)).map(function (_, i) { return '<i class="' + (i < (timer.cycle || 0) % p.every ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="fbtns">' +
      '<button class="icon-btn big" data-act="focus-reset" aria-label="Reset" title="Reset">' + A.icon('undo') + '</button>' +
      (timer.running ? '<button class="btn primary huge" data-act="focus-pause">' + A.icon('pause') + 'Pause</button>' : '<button class="btn primary huge" data-act="focus-start">' + A.icon('play') + (timer.remaining != null ? 'Resume' : 'Start') + '</button>') +
      '<button class="icon-btn big" data-act="focus-stop" aria-label="Stop and log" title="Stop and log">' + A.icon('stop') + '</button>' +
      '<button class="icon-btn big" data-act="focus-skip" aria-label="Skip to next" title="Skip">' + A.icon('skip') + '</button></div>' +
      '<div class="fwhat"><label class="fld"><span>Working on</span><select id="ft-task">' + A.f.opt('', '— Free focus —', timer.taskId) + open.map(function (t) { return A.f.opt(t.id, t.title + (t.due ? ' · ' + D.rel(D.parse(t.due)) : ''), timer.taskId); }).join('') + '</select></label>' +
      '<label class="fld" id="ft-label-w"' + (timer.taskId ? ' hidden' : '') + '><span>Label</span><input id="ft-label" placeholder="Deep work" value="' + esc(timer.label || '') + '"></label></div>' +
      '</section>' +
      '<section class="fside"><div class="card"><h3>Last 7 days</h3>' + A.bars(week, { unit: 'm', h: 120 }) + '</div>' +
      '<div class="card"><h3>Today\'s sessions</h3>' + (todays.length ? '<ul class="flog">' + todays.map(function (f) {
        return '<li><span class="ag-time">' + D.time(D.parse(f.start)) + '</span><span>' + esc(f.label) + '</span><b>' + D.dur(f.minutes) + '</b><button class="icon-btn subtle small" data-act="focus-del" data-id="' + f.id + '" aria-label="Delete session">' + A.icon('x') + '</button></li>';
      }).join('') + '</ul>' : '<p class="muted small">No sessions yet today. Pick a task and press Start; the time is added to the task.</p>') + '</div></section></div>';
    A.$('#ft-task', main).addEventListener('change', function (e) { timer.taskId = e.target.value; saveTimer(); A.render(); });
    var lab = A.$('#ft-label', main); if (lab) lab.addEventListener('change', function () { timer.label = lab.value; saveTimer(); });
  };
  A.actions['focus-start'] = function () { A.timerStart(); };
  A.actions['focus-pause'] = function () { A.timerPause(); };
  A.actions['focus-reset'] = function () { A.timerReset(); };
  A.actions['focus-stop'] = function () { A.timerStop(); };
  A.actions['focus-skip'] = function () { var m = timer.mode === 'focus' ? 'short' : 'focus'; A.timerReset(m); };
  A.actions['focus-mode'] = function (el) { A.timerReset(el.getAttribute('data-m')); };
  A.actions['focus-del'] = function (el) {
    var f = A.byId(A.state.focus, el.getAttribute('data-id')); if (!f) return;
    A.commit('Delete session', ['focus', 'tasks'], function (st) {
      st.focus = st.focus.filter(function (x) { return x.id !== f.id; });
      var t = f.taskId && A.byId(st.tasks, f.taskId); if (t) t.spent = Math.max(0, (t.spent || 0) - f.minutes);
    });
    A.toast('Deleted session', { undo: true });
  };
  A.actions['focus-log'] = function () {
    var m = A.modal({
      title: 'Log focus time', size: 'sm',
      body: '<div class="form"><div class="grid2"><label class="fld"><span>Date</span><input type="date" id="fl-d" value="' + D.todayKey() + '"></label><label class="fld"><span>Start</span><input type="time" id="fl-t" value="' + D.hm(D.addMin(new Date(), -30)) + '"></label></div>' +
        '<label class="fld"><span>Minutes</span><input type="number" id="fl-m" min="1" max="720" value="30"></label>' +
        '<label class="fld"><span>Task</span><select id="fl-task">' + A.f.opt('', 'None', '') + A.state.tasks.filter(A.taskOpen).map(function (t) { return A.f.opt(t.id, t.title, ''); }).join('') + '</select></label>' +
        '<label class="fld"><span>Label</span><input id="fl-l" placeholder="Reading"></label></div>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="fl-go">Log</button>'
    });
    A.$('#fl-go', m.root).addEventListener('click', function () {
      var mins = +A.$('#fl-m', m.root).value; if (!mins) return;
      var tid = A.$('#fl-task', m.root).value, t = tid && A.byId(A.state.tasks, tid);
      A.commit('Log focus', ['focus', 'tasks'], function (st) {
        st.focus.push({ id: A.uid(), start: A.$('#fl-d', m.root).value + 'T' + (A.$('#fl-t', m.root).value || '09:00'), minutes: mins, taskId: tid, catId: t ? t.catId || '' : '', label: t ? t.title : A.$('#fl-l', m.root).value || 'Focus' });
        if (t) { var x = A.byId(st.tasks, tid); x.spent = (x.spent || 0) + mins; }
      });
      m.close();
    });
  };

  /* -------------------------------------------------------- bar chart */
  A.bars = function (data, o) {
    o = o || {};
    var w = o.w || 320, h = o.h || 140, pad = 18, max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.value; })));
    var nice = max <= 5 ? 5 : max <= 10 ? 10 : Math.ceil(max / (max > 300 ? 60 : 10)) * (max > 300 ? 60 : 10);
    var bw = (w - 30) / data.length, inner = h - pad - 14;
    var out = '<svg class="bars" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'Chart') + '">';
    [0, 0.5, 1].forEach(function (f) {
      var y = 14 + inner * (1 - f);
      out += '<line x1="30" x2="' + w + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="26" y="' + (y + 3) + '" text-anchor="end" class="ax">' + (o.unit === 'm' ? D.dur(nice * f) : Math.round(nice * f * 10) / 10) + '</text>';
    });
    data.forEach(function (d, i) {
      var bh = d.value / nice * inner, x = 30 + i * bw + bw * 0.18, y = 14 + inner - bh;
      out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(d.value ? 2 : 0, bh).toFixed(1) + '" rx="3" fill="' + (d.color || (d.hl ? 'var(--accent)' : 'var(--accent-soft-strong)')) + '"><title>' + esc(d.label + ': ' + (o.unit === 'm' ? D.dur(d.value) : d.value)) + '</title></rect>' +
        '<text x="' + (30 + i * bw + bw / 2).toFixed(1) + '" y="' + (h - 3) + '" text-anchor="middle" class="ax' + (d.hl ? ' hl' : '') + '">' + esc(d.label) + '</text>';
    });
    return out + '</svg>';
  };

  /* ========================================================== INSIGHTS */
  A.insightsUI = { range: 'week' };
  A.views.insights = function (main) {
    var I = A.insightsUI, today = D.today(), from, days;
    if (I.range === 'week') { from = D.startOfWeek(today, A.state.settings.weekStart); days = 7; }
    else if (I.range === 'last') { from = D.addDays(D.startOfWeek(today, A.state.settings.weekStart), -7); days = 7; }
    else { from = D.addDays(today, -29); days = 30; }
    var to = D.addDays(from, days), fk = D.key(from), tk = D.key(to);
    var occs = A.occurrences(from, to, { all: true }).filter(function (o) { return !o.ev.allDay; });
    var byCat = {}, total = 0, byDay = {};
    occs.forEach(function (o) {
      var m = (o.end - o.start) / 60000, c = o.ev.catId || '';
      byCat[c] = (byCat[c] || 0) + m; total += m;
      byDay[o.key] = (byDay[o.key] || 0) + m;
    });
    var focus = A.state.focus.filter(function (f) { var k = f.start.slice(0, 10); return k >= fk && k < tk; });
    var focusMin = A.sum(focus, function (f) { return f.minutes; });
    var done = A.state.tasks.filter(function (t) { return t.completedAt && D.key(new Date(t.completedAt)) >= fk && D.key(new Date(t.completedAt)) < tk; });
    var onTime = done.filter(function (t) { return !t.due || D.key(new Date(t.completedAt)) <= t.due; }).length;
    var habits = A.state.habits.filter(function (h) { return !h.archived; });
    var hDue = 0, hDone = 0;
    for (var i = 0; i < days; i++) {
      var d = D.addDays(from, i); if (d > today) break;
      habits.forEach(function (h) { if (A.habitDue(h, d) && (!h.created || D.key(d) >= h.created)) { hDue++; if (A.habitDone(h, D.key(d))) hDone++; } });
    }
    var moods = [], sleeps = [];
    for (var j = 0; j < days; j++) { var e = A.state.journal[D.key(D.addDays(from, j))] || {}; moods.push(e.mood || null); sleeps.push(e.sleep != null ? e.sleep : null); }
    var mv = moods.filter(Boolean), sv = sleeps.filter(function (x) { return x != null; });
    var busiest = Object.keys(byDay).sort(function (a, b) { return byDay[b] - byDay[a]; })[0];
    var label = function (i) { var d = D.addDays(from, i); return days <= 7 ? D.WD[d.getDay()].slice(0, 2) : (i % 5 === 0 ? String(d.getDate()) : ''); };
    var dayData = function (fn) { var out = []; for (var i = 0; i < days; i++) { var d = D.addDays(from, i); out.push({ label: label(i), value: fn(D.key(d)), hl: D.sameDay(d, today) }); } return out; };

    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var tiles = [
      ['Planned', D.dur(total), occs.length + ' events'],
      ['Focused', D.dur(focusMin), focus.length + ' sessions'],
      ['Tasks done', String(done.length), done.length ? Math.round(onTime / done.length * 100) + '% on time' : 'none yet'],
      ['Habits', hDue ? Math.round(hDone / hDue * 100) + '%' : '–', hDone + ' of ' + hDue + ' check-ins'],
      ['Mood', mv.length ? (A.sum(mv) / mv.length).toFixed(1) + '/5' : '–', mv.length + ' days logged'],
      ['Sleep', sv.length ? (A.sum(sv) / sv.length).toFixed(1) + 'h' : '–', 'average a night']
    ];
    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Insights</h1><span class="muted">' + D.fmt(from, 'short') + ' – ' + D.fmt(D.addDays(to, -1), 'short') + '</span></div>' +
      '<div class="vh-right"><div class="seg">' + [['week', 'This week'], ['last', 'Last week'], ['30', '30 days']].map(function (r) { return '<button class="' + (I.range === r[0] ? 'on' : '') + '" data-act="ins-range" data-r="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="tiles">' + tiles.map(function (t) { return '<div class="tile"><small>' + t[0] + '</small><b>' + esc(t[1]) + '</b><span>' + esc(t[2]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="ins-grid">' +
      '<section class="card"><h3>Where the time goes</h3>' + (cats.length ? '<div class="hbars">' + cats.map(function (c) {
        var cat = A.cat(c), pct = byCat[c] / total;
        return '<div class="hb"><span class="hb-l"><i class="dot" style="--c:' + cat.color + '"></i>' + esc(cat.name) + '</span><span class="hb-t"><i style="width:' + (pct * 100).toFixed(1) + '%;background:' + cat.color + '"></i></span><b>' + D.dur(byCat[c]) + '</b><small>' + Math.round(pct * 100) + '%</small></div>';
      }).join('') + '</div>' : '<p class="muted small">No timed events in this range.</p>') + (busiest ? '<p class="muted small">Busiest day: <b>' + D.fmt(D.parse(busiest), 'medium') + '</b> with ' + D.dur(byDay[busiest]) + ' planned.</p>' : '') + '</section>' +
      '<section class="card"><h3>Planned time per day</h3>' + A.bars(dayData(function (k) { return Math.round(byDay[k] || 0); }), { unit: 'm' }) + '</section>' +
      '<section class="card"><h3>Focus per day</h3>' + A.bars(dayData(function (k) { return A.sum(focus.filter(function (f) { return f.start.slice(0, 10) === k; }), function (f) { return f.minutes; }); }), { unit: 'm' }) + '</section>' +
      '<section class="card"><h3>Tasks completed</h3>' + A.bars(dayData(function (k) { return done.filter(function (t) { return D.key(new Date(t.completedAt)) === k; }).length; })) + '</section>' +
      '<section class="card"><h3>Habits</h3>' + (habits.length ? '<div class="hbars">' + habits.map(function (h) {
        var r = A.habitRate(h, days);
        return '<div class="hb"><span class="hb-l"><i class="dot" style="--c:' + h.color + '"></i>' + esc(h.name) + '</span><span class="hb-t"><i style="width:' + (r * 100).toFixed(0) + '%;background:' + h.color + '"></i></span><b>' + Math.round(r * 100) + '%</b><small>' + A.habitStreak(h) + 'd</small></div>';
      }).join('') + '</div>' : '<p class="muted small">No habits yet.</p>') + '</section>' +
      '<section class="card"><h3>Mood</h3>' + A.sparkline(moods, 5, 320, 70) + '<h3>Sleep</h3>' + A.sparkline(sleeps.map(function (x) { return x == null ? null : A.clamp(x, 3, 11) - 2; }), 9, 320, 60) + '</section>' +
      '</div>';
  };
  A.actions['ins-range'] = function (el) { A.insightsUI.range = el.getAttribute('data-r'); A.render(); };

  /* ========================================================= TIMETABLE */
  var TT = A.ttUI = { id: null };
  var PRESETS = {
    student: { name: 'Student week', blocks: [
      [1, '08:30', '10:00', 'Maths', 'c-study', 'Room 12'], [1, '10:15', '11:45', 'Physics', 'c-study', 'Lab 2'], [1, '13:00', '14:30', 'English', 'c-study', ''],
      [2, '09:00', '10:30', 'Chemistry', 'c-study', 'Lab 1'], [2, '11:00', '12:30', 'History', 'c-study', ''], [2, '17:00', '18:30', 'Football', 'c-health', 'Field'],
      [3, '08:30', '10:00', 'Maths', 'c-study', 'Room 12'], [3, '10:15', '11:45', 'Biology', 'c-study', ''], [3, '15:00', '17:00', 'Study group', 'c-study', 'Library'],
      [4, '09:00', '10:30', 'Physics', 'c-study', 'Lab 2'], [4, '11:00', '12:30', 'English', 'c-study', ''], [4, '17:00', '18:30', 'Football', 'c-health', 'Field'],
      [5, '08:30', '10:00', 'Chemistry', 'c-study', 'Lab 1'], [5, '10:15', '11:45', 'Computing', 'c-study', ''],
      [6, '10:00', '12:00', 'Weekly review + revision', 'c-study', '']] },
    work: { name: 'Work week', blocks: [
      [1, '09:00', '09:15', 'Stand-up', 'c-work', ''], [1, '09:30', '12:00', 'Deep work', 'c-work', ''], [1, '18:00', '19:00', 'Gym', 'c-health', ''],
      [2, '09:00', '09:15', 'Stand-up', 'c-work', ''], [2, '09:30', '12:00', 'Deep work', 'c-work', ''], [2, '14:00', '15:00', 'Team sync', 'c-work', ''],
      [3, '09:00', '09:15', 'Stand-up', 'c-work', ''], [3, '09:30', '12:00', 'Deep work', 'c-work', ''], [3, '18:00', '19:00', 'Gym', 'c-health', ''],
      [4, '09:00', '09:15', 'Stand-up', 'c-work', ''], [4, '09:30', '12:00', 'Deep work', 'c-work', ''], [4, '16:00', '17:00', '1:1s', 'c-work', ''],
      [5, '09:00', '09:15', 'Stand-up', 'c-work', ''], [5, '09:30', '11:30', 'Deep work', 'c-work', ''], [5, '16:00', '16:30', 'Plan next week', 'c-work', ''], [5, '18:00', '19:00', 'Gym', 'c-health', ''],
      [6, '10:00', '11:00', 'Long run', 'c-health', ''], [0, '19:00', '19:30', 'Weekly review', 'c-personal', '']] }
  };
  function fromPreset(key) {
    var p = PRESETS[key];
    return { id: A.uid(), name: p.name, blocks: p.blocks.map(function (b) { return { id: A.uid(), day: b[0], start: b[1], end: b[2], title: b[3], catId: A.byId(A.state.categories, b[4]) ? b[4] : '', location: b[5] }; }) };
  }
  A.ttPreset = fromPreset;
  function hmToMin(s) { var p = (s || '0:0').split(':'); return +p[0] * 60 + +p[1]; }

  A.views.timetable = function (main) {
    var list = A.state.templates;
    if (!TT.id || !A.byId(list, TT.id)) TT.id = list[0] ? list[0].id : null;
    var t = TT.id ? A.byId(list, TT.id) : null;
    var head = '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Timetable</h1><span class="muted">Design a typical week, then stamp it onto your calendar</span></div>' +
      '<div class="vh-right"><button class="btn" data-act="tt-new">' + A.icon('plus') + '<span>New timetable</span></button>' +
      (t ? '<button class="btn" data-act="tt-more" aria-label="More">' + A.icon('more') + '</button><button class="btn primary" data-act="tt-apply">' + A.icon('calendar') + '<span>Apply to calendar</span></button>' : '') + '</div></div>';
    if (!t) {
      main.innerHTML = head + '<div class="empty"><h3>No timetables yet</h3><p>A timetable is a template week: classes, shifts, training. Build it once, then apply it to a term or a month and every block becomes a repeating event you can still edit one by one.</p>' +
        '<div class="row wrap center"><button class="btn primary" data-act="tt-new">' + A.icon('plus') + 'Blank timetable</button><button class="btn" data-act="tt-preset" data-p="student">Start from a student week</button><button class="btn" data-act="tt-preset" data-p="work">Start from a work week</button><button class="btn" data-act="tt-from-week">Copy this week\'s calendar</button></div></div>';
      return;
    }
    var s = A.state.settings, hh = Math.max(40, s.hourHeight - 4);
    var mins = t.blocks.map(function (b) { return hmToMin(b.start); }), maxs = t.blocks.map(function (b) { return hmToMin(b.end); });
    var h0 = Math.min(s.dayStart, mins.length ? Math.floor(Math.min.apply(null, mins) / 60) : 8), h1 = Math.max(Math.min(s.dayEnd, 22), maxs.length ? Math.ceil(Math.max.apply(null, maxs) / 60) : 18);
    var order = []; for (var i = 0; i < 7; i++) order.push((s.weekStart + i) % 7);
    var total = A.sum(t.blocks, function (b) { return Math.max(0, hmToMin(b.end) - hmToMin(b.start)); });
    var byCat = {}; t.blocks.forEach(function (b) { byCat[b.catId || ''] = (byCat[b.catId || ''] || 0) + hmToMin(b.end) - hmToMin(b.start); });
    var tabs = '<div class="tt-tabs">' + list.map(function (x) { return '<button class="' + (x.id === t.id ? 'on' : '') + '" data-act="tt-pick" data-id="' + x.id + '">' + esc(x.name) + '</button>'; }).join('') + '</div>';
    var hours = ''; for (var h = h0; h < h1; h++) hours += '<div class="hr" style="top:' + ((h - h0) * hh) + 'px"><span>' + (h === h0 ? '' : D.hourLabel(h)) + '</span></div>';
    var lines = ''; for (var h2 = h0; h2 < h1; h2++) lines += '<div class="ln" style="top:' + ((h2 - h0) * hh) + 'px"></div>';
    var grid = '<div class="cal ttable cal-7" style="--hh:' + hh + 'px;--cols:7"><div class="cal-scroll tt-scroll"><div class="cal-sticky"><div class="cal-head"><div class="gut"></div>' + order.map(function (d) { return '<div class="cal-dh"><span class="wd">' + D.WEEKDAYS[d] + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="cal-grid" style="height:' + ((h1 - h0) * hh) + 'px"><div class="gut hours">' + hours + '</div>' +
      order.map(function (d) {
        var blocks = t.blocks.filter(function (b) { return b.day === d; }).map(function (b) { return { b: b, start: hmToMin(b.start), end: hmToMin(b.end) }; }).sort(function (a, b) { return a.start - b.start; });
        /* simple overlap lanes */
        var lanes = []; blocks.forEach(function (x) { var l = 0; while (lanes[l] > x.start) l++; lanes[l] = x.end; x.lane = l; });
        return '<div class="cal-col tt-col" data-tday="' + d + '">' + lines + blocks.map(function (x) {
          var top = (x.start - h0 * 60) / 60 * hh, ht = Math.max(16, (x.end - x.start) / 60 * hh - 2), w = 100 / Math.max(1, lanes.length);
          return '<button class="ev' + (ht < 34 ? ' short' : '') + '" style="--c:' + A.cat(x.b.catId).color + ';top:' + top + 'px;height:' + ht + 'px;left:calc(' + (x.lane * w) + '% + 1px);width:calc(' + w + '% - 3px)" data-act="tt-block" data-id="' + x.b.id + '">' +
            '<div class="ev-t">' + esc(x.b.title) + '</div><div class="ev-m">' + D.time(D.parse('2000-01-01T' + x.b.start)) + '–' + D.time(D.parse('2000-01-01T' + x.b.end)) + (x.b.location ? ' · ' + esc(x.b.location) : '') + '</div></button>';
        }).join('') + '</div>';
      }).join('') + '</div></div></div>';
    main.innerHTML = head + tabs +
      '<div class="tt-summary"><span><b>' + t.blocks.length + '</b> blocks</span><span><b>' + D.dur(total) + '</b> a week</span>' +
      Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (c) { return '<span class="pill" style="--c:' + A.cat(c).color + '"><i class="dot"></i>' + esc(A.cat(c).name) + ' ' + D.dur(byCat[c]) + '</span>'; }).join('') +
      (t.applied ? '<span class="pill good">' + A.icon('calendar') + 'On calendar ' + D.fmt(D.parse(t.applied.from), 'short') + ' – ' + D.fmt(D.parse(t.applied.to), 'short') + '</span>' : '') +
      '<span class="muted small">Click an empty slot to add a block.</span></div>' + grid;

    A.$$('.tt-col', main).forEach(function (col) {
      col.addEventListener('click', function (e) {
        if (e.target.closest('.ev')) return;
        var r = col.getBoundingClientRect(), m = Math.floor(((e.clientY - r.top) / hh * 60 + h0 * 60) / 30) * 30;
        A.editBlock(t, null, { day: +col.getAttribute('data-tday'), start: D.hm(D.fromMinutes(D.today(), m)), end: D.hm(D.fromMinutes(D.today(), Math.min(1439, m + 60))) });
      });
    });
    var sc = A.$('.tt-scroll', main); if (sc) sc.scrollTop = Math.max(0, (Math.min.apply(null, mins.length ? mins : [480]) / 60 - h0 - 0.5) * hh);
  };

  A.editBlock = function (t, b, defaults) {
    var isNew = !b;
    b = b ? A.clone(b) : Object.assign({ id: A.uid(), title: '', catId: '', location: '', day: 1, start: '09:00', end: '10:00' }, defaults || {});
    var m = A.modal({
      title: isNew ? 'Add block' : 'Edit block', size: 'sm',
      body: '<div class="form"><input id="bf-title" class="big-input" placeholder="Maths, shift, training…" value="' + esc(b.title) + '" autofocus>' +
        '<div class="fld"><span>Days</span><div class="daypick" id="bf-days">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button type="button" data-d="' + d + '" class="' + (d === b.day ? 'on' : '') + '">' + D.WD[d].slice(0, 2) + '</button>'; }).join('') + '</div>' + (isNew ? '<small class="muted">Pick several days to add the same block to each.</small>' : '') + '</div>' +
        '<div class="grid2"><label class="fld"><span>Starts</span><input type="time" id="bf-s" value="' + b.start + '"></label><label class="fld"><span>Ends</span><input type="time" id="bf-e" value="' + b.end + '"></label></div>' +
        '<div class="grid2"><label class="fld"><span>Category</span>' + A.f.catSelect('bf-cat', b.catId) + '</label><label class="fld"><span>Location</span><input id="bf-loc" value="' + esc(b.location || '') + '"></label></div></div>',
      foot: (isNew ? '' : '<button class="btn danger ghost" id="bf-del">' + A.icon('trash') + 'Delete</button><button class="btn ghost" id="bf-dup">' + A.icon('copy') + 'Duplicate</button>') + '<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="bf-save">Save</button>'
    });
    var root = m.root;
    A.$$('#bf-days button', root).forEach(function (x) { x.addEventListener('click', function () { if (!isNew) A.$$('#bf-days button', root).forEach(function (y) { y.classList.remove('on'); }); x.classList.toggle('on', isNew ? !x.classList.contains('on') : true); }); });
    function vals() {
      var s = A.$('#bf-s', root).value || '09:00', e = A.$('#bf-e', root).value || '10:00';
      if (hmToMin(e) <= hmToMin(s)) e = D.hm(D.fromMinutes(D.today(), Math.min(1439, hmToMin(s) + 60)));
      return { title: A.$('#bf-title', root).value.trim() || 'Block', start: s, end: e, catId: A.$('#bf-cat', root).value, location: A.$('#bf-loc', root).value.trim() };
    }
    function save() {
      var v = vals(), days = A.$$('#bf-days .on', root).map(function (x) { return +x.getAttribute('data-d'); });
      if (!days.length) days = [b.day];
      A.commit(isNew ? 'Add block' : 'Edit block', ['templates'], function (st) {
        var tt = A.byId(st.templates, t.id);
        if (isNew) days.forEach(function (d) { tt.blocks.push(Object.assign({ id: A.uid(), day: d }, v)); });
        else Object.assign(A.byId(tt.blocks, b.id), v, { day: days[0] });
      });
      m.close();
    }
    A.$('#bf-save', root).addEventListener('click', save);
    A.$('#bf-title', root).addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
    if (!isNew) {
      A.$('#bf-del', root).addEventListener('click', function () { A.commit('Delete block', ['templates'], function (st) { var tt = A.byId(st.templates, t.id); tt.blocks = tt.blocks.filter(function (x) { return x.id !== b.id; }); }); m.close(); A.toast('Deleted block', { undo: true }); });
      A.$('#bf-dup', root).addEventListener('click', function () { m.close(); A.editBlock(t, null, Object.assign(vals(), { day: (b.day + 1) % 7 })); });
    }
  };

  A.actions['tt-pick'] = function (el) { TT.id = el.getAttribute('data-id'); A.render(); };
  A.actions['tt-block'] = function (el) { var t = A.byId(A.state.templates, TT.id); A.editBlock(t, A.byId(t.blocks, el.getAttribute('data-id'))); };
  A.actions['tt-preset'] = function (el) { var t = fromPreset(el.getAttribute('data-p')); A.commit('Add timetable', ['templates'], function (st) { st.templates.push(t); }); TT.id = t.id; A.render(); };
  A.actions['tt-new'] = function () {
    var m = A.modal({ title: 'New timetable', size: 'sm', body: '<div class="form"><label class="fld"><span>Name</span><input id="tn-n" placeholder="Autumn term" autofocus></label>' +
      '<label class="fld"><span>Start from</span><select id="tn-from">' + A.f.opt('', 'Blank', '') + A.f.opt('student', 'Student week', '') + A.f.opt('work', 'Work week', '') + A.f.opt('week', 'This week\'s calendar', '') + '</select></label></div>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="tn-go">Create</button>' });
    A.$('#tn-go', m.root).addEventListener('click', function () {
      var from = A.$('#tn-from', m.root).value, name = A.$('#tn-n', m.root).value.trim();
      var t = from === 'week' ? fromWeek() : from ? fromPreset(from) : { id: A.uid(), name: '', blocks: [] };
      t.name = name || t.name || 'Timetable';
      A.commit('Add timetable', ['templates'], function (st) { st.templates.push(t); });
      TT.id = t.id; m.close(); A.go('timetable');
    });
  };
  function fromWeek() {
    var from = D.startOfWeek(A.ui.date || D.today(), A.state.settings.weekStart), seen = {};
    var blocks = [];
    A.occurrences(from, D.addDays(from, 7), { all: true }).forEach(function (o) {
      if (o.ev.allDay || o.ev.taskId) return;
      var k = o.ev.title + o.start.getDay() + D.hm(o.start); if (seen[k]) return; seen[k] = 1;
      blocks.push({ id: A.uid(), day: o.start.getDay(), start: D.hm(o.start), end: D.hm(o.end), title: o.ev.title, catId: o.ev.catId || '', location: o.ev.location || '' });
    });
    return { id: A.uid(), name: 'Week of ' + D.fmt(from, 'short'), blocks: blocks };
  }
  A.actions['tt-from-week'] = function () { var t = fromWeek(); A.commit('Add timetable', ['templates'], function (st) { st.templates.push(t); }); TT.id = t.id; A.render(); A.toast('Copied ' + t.blocks.length + ' blocks from this week', { undo: true }); };
  A.actions['tt-more'] = function (el) {
    var t = A.byId(A.state.templates, TT.id);
    A.menu(el, [
      { label: 'Rename', icon: 'edit', fn: function () {
        var m = A.modal({ title: 'Rename timetable', size: 'sm', body: '<div class="form"><input id="tr-n" value="' + esc(t.name) + '" autofocus></div>', foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="tr-go">Save</button>' });
        A.$('#tr-go', m.root).addEventListener('click', function () { var n = A.$('#tr-n', m.root).value.trim(); if (n) A.commit('Rename timetable', ['templates'], function (st) { A.byId(st.templates, t.id).name = n; }); m.close(); });
      } },
      { label: 'Duplicate', icon: 'copy', fn: function () { var c = A.clone(t); c.id = A.uid(); c.name += ' (copy)'; delete c.applied; c.blocks.forEach(function (b) { b.id = A.uid(); }); A.commit('Duplicate timetable', ['templates'], function (st) { st.templates.push(c); }); TT.id = c.id; } },
      { label: 'Remove from calendar', icon: 'x', fn: function () { removeApplied(t); } },
      '-',
      { label: 'Delete timetable', icon: 'trash', danger: true, fn: function () {
        A.confirm('Delete "' + t.name + '"? Events already on your calendar stay.', { ok: 'Delete', danger: true }).then(function (ok) {
          if (ok) { A.commit('Delete timetable', ['templates'], function (st) { st.templates = st.templates.filter(function (x) { return x.id !== t.id; }); }); TT.id = null; A.toast('Deleted timetable', { undo: true }); }
        });
      } }
    ], { alignRight: true });
  };
  function removeApplied(t) {
    var n = A.state.events.filter(function (e) { return e.templateId === t.id; }).length;
    if (!n) { A.toast('Nothing from this timetable is on the calendar.'); return; }
    A.commit('Remove timetable events', ['events', 'templates'], function (st) {
      st.events = st.events.filter(function (e) { return e.templateId !== t.id; });
      delete A.byId(st.templates, t.id).applied;
    });
    A.toast('Removed ' + n + ' repeating events', { undo: true });
  }
  A.actions['tt-apply'] = function () {
    var t = A.byId(A.state.templates, TT.id); if (!t || !t.blocks.length) { A.toast('Add some blocks first.'); return; }
    var from = D.startOfWeek(D.addDays(D.today(), 1), A.state.settings.weekStart);
    var m = A.modal({
      title: 'Apply "' + t.name + '"', size: 'sm',
      body: '<div class="form"><p class="lede">Each block becomes a weekly repeating event between these dates. You can still move or cancel single occurrences later.</p>' +
        '<div class="grid2"><label class="fld"><span>From</span><input type="date" id="ta-f" value="' + D.key(D.today()) + '"></label><label class="fld"><span>Until</span><input type="date" id="ta-t" value="' + D.key(D.addDays(from, 7 * 12 - 1)) + '"></label></div>' +
        '<div class="date-chips">' + [[4, '4 weeks'], [8, '8 weeks'], [12, '12 weeks'], [16, 'A term (16 wk)'], [52, 'A year']].map(function (w) { return '<button type="button" class="chip" data-w="' + w[0] + '">' + w[1] + '</button>'; }).join('') + '</div>' +
        '<label class="fld"><span>Repeat</span><select id="ta-iv">' + A.f.opt(1, 'Every week', 1) + A.f.opt(2, 'Every other week', 1) + '</select></label>' +
        (t.applied ? '<label class="toggle"><input type="checkbox" id="ta-replace" checked><span>Replace the copy already on the calendar</span></label>' : '') +
        '<label class="toggle"><input type="checkbox" id="ta-rem"' + (A.state.settings.defaultReminder ? ' checked' : '') + '><span>Remind me ' + (A.state.settings.defaultReminder || 10) + ' min before each</span></label></div>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="ta-go">Add ' + t.blocks.length + ' repeating events</button>'
    });
    A.$$('[data-w]', m.root).forEach(function (b) { b.addEventListener('click', function () { var f = D.parse(A.$('#ta-f', m.root).value) || D.today(); A.$('#ta-t', m.root).value = D.key(D.addDays(f, 7 * +b.getAttribute('data-w') - 1)); }); });
    A.$('#ta-go', m.root).addEventListener('click', function () {
      var f = D.parse(A.$('#ta-f', m.root).value), until = A.$('#ta-t', m.root).value, iv = +A.$('#ta-iv', m.root).value;
      if (!f || !until || until < D.key(f)) { A.toast('Pick an end date after the start date.'); return; }
      var replace = A.$('#ta-replace', m.root) && A.$('#ta-replace', m.root).checked, rem = A.$('#ta-rem', m.root).checked;
      A.commit('Apply timetable', ['events', 'templates'], function (st) {
        if (replace) st.events = st.events.filter(function (e) { return e.templateId !== t.id; });
        t.blocks.forEach(function (b) {
          var first = D.addDays(f, (b.day - f.getDay() + 7) % 7);
          if (D.key(first) > until) return;
          var sm = hmToMin(b.start), em = hmToMin(b.end);
          st.events.push({ id: A.uid(), title: b.title, start: D.stamp(D.fromMinutes(first, sm)), end: D.stamp(D.fromMinutes(first, em)), allDay: false, catId: b.catId, location: b.location, notes: '',
            reminders: rem ? [A.state.settings.defaultReminder || 10] : [], exdates: [], recur: { freq: 'weekly', interval: iv, byDay: [b.day], until: until }, templateId: t.id });
        });
        A.byId(st.templates, t.id).applied = { from: D.key(f), to: until };
      });
      m.close();
      A.toast('Added "' + t.name + '" to your calendar', { undo: true, action: { label: 'View', fn: function () { A.ui.date = f; A.cal.mode = 'week'; A.go('calendar'); } } });
    });
  };
})();
