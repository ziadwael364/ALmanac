/* Almanac — habits, goals, journal. */
'use strict';
(function () {
  var D = A.D, esc = A.esc;

  /* ============================================================ HABITS */
  function habitCell(h, day) {
    var k = D.key(day), n = (h.log || {})[k] || 0, tgt = h.target || 1, due = A.habitDue(h, day);
    var future = day > D.today(), pct = Math.min(1, n / tgt);
    return '<button class="hcell' + (pct >= 1 ? ' full' : pct > 0 ? ' part' : '') + (due ? '' : ' off') + (D.sameDay(day, D.today()) ? ' today' : '') + '"' +
      (future ? ' disabled' : '') + ' data-act="habit-tick" data-id="' + h.id + '" data-day="' + k + '" style="--p:' + pct + '" ' +
      'title="' + D.fmt(day, 'medium') + ': ' + n + '/' + tgt + (h.unit ? ' ' + esc(h.unit) : '') + (due ? '' : ' (rest day)') + '" aria-label="' + D.fmt(day, 'medium') + ' ' + n + ' of ' + tgt + '">' +
      (tgt > 1 && n ? '<b>' + n + '</b>' : pct >= 1 ? A.icon('check') : '') + '</button>';
  }
  function heat(h) {
    var weeks = 26, end = D.today(), start = D.addDays(D.startOfWeek(end, A.state.settings.weekStart), -(weeks - 1) * 7), out = '';
    for (var w = 0; w < weeks; w++) {
      out += '<div class="hw">';
      for (var d = 0; d < 7; d++) {
        var day = D.addDays(start, w * 7 + d), k = D.key(day);
        if (day > end) { out += '<i class="x"></i>'; continue; }
        var n = (h.log || {})[k] || 0, p = Math.min(1, n / (h.target || 1));
        out += '<i class="h' + (p >= 1 ? 4 : p >= .66 ? 3 : p >= .33 ? 2 : p > 0 ? 1 : 0) + (A.habitDue(h, day) ? '' : ' rest') + '" title="' + D.fmt(day, 'medium') + ': ' + n + '"></i>';
      }
      out += '</div>';
    }
    return '<div class="heat" style="--c:' + h.color + '">' + out + '</div>';
  }

  A.views.habits = function (main) {
    var today = D.today(), habits = A.state.habits.filter(function (h) { return !h.archived; });
    var dueToday = habits.filter(function (h) { return A.habitDue(h, today); });
    var doneToday = dueToday.filter(function (h) { return A.habitDone(h, D.key(today)); });
    var days = []; for (var i = 6; i >= 0; i--) days.push(D.addDays(today, -i));
    var archived = A.state.habits.filter(function (h) { return h.archived; });
    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Habits</h1><span class="muted">' + doneToday.length + ' of ' + dueToday.length + ' done today</span></div>' +
      '<div class="vh-right"><button class="btn primary" data-act="habit-new">' + A.icon('plus') + '<span>New habit</span></button></div></div>' +
      (habits.length ? '<div class="habits">' + habits.map(function (h) {
        var streak = A.habitStreak(h), best = A.habitBest(h), rate = A.habitRate(h, 30);
        var todayN = (h.log || {})[D.key(today)] || 0;
        return '<article class="habit card" style="--c:' + h.color + '">' +
          '<header><button class="h-name" data-act="habit-edit" data-id="' + h.id + '"><i class="dot" style="--c:' + h.color + '"></i>' + esc(h.name) + '</button>' +
          '<span class="h-sched">' + (h.target > 1 ? h.target + ' ' + esc(h.unit || 'times') + ' · ' : '') + (!h.days || !h.days.length || h.days.length === 7 ? 'Daily' : h.days.slice().sort().map(function (d) { return D.WD[d]; }).join(' ')) + '</span>' +
          '<span style="--ring:' + h.color + '">' + A.ring(rate, 42, 5, Math.round(rate * 100) + '') + '</span></header>' +
          '<div class="hstrip">' + days.map(function (d) { return '<div class="hday"><small>' + D.WD[d.getDay()].slice(0, 2) + '</small>' + habitCell(h, d) + '</div>'; }).join('') + '</div>' +
          '<div class="hstats"><span><b>' + streak + '</b> day streak</span><span><b>' + best + '</b> best</span><span><b>' + Math.round(rate * 100) + '%</b> last 30 days</span>' +
          (h.target > 1 ? '<span class="hcount"><button class="icon-btn small" data-act="habit-dec" data-id="' + h.id + '" aria-label="One less">−</button><b>' + todayN + '/' + h.target + '</b><button class="icon-btn small" data-act="habit-inc" data-id="' + h.id + '" aria-label="One more">+</button></span>' : '') +
          '</div>' + heat(h) + '</article>';
      }).join('') + '</div>' :
        '<div class="empty"><h3>No habits yet</h3><p>Track anything you want to do regularly: reading 20 pages, 8 glasses of water, gym on Mon/Wed/Fri. Streaks skip your rest days.</p><button class="btn primary" data-act="habit-new">' + A.icon('plus') + 'Add your first habit</button></div>') +
      (archived.length ? '<details class="archived"><summary>Archived (' + archived.length + ')</summary>' + archived.map(function (h) {
        return '<div class="arow"><span>' + esc(h.name) + '</span><button class="btn small" data-act="habit-unarchive" data-id="' + h.id + '">Restore</button></div>';
      }).join('') + '</details>' : '');
  };

  function bump(h, key, delta) {
    A.commit('Log habit', ['habits'], function (st) {
      var x = A.byId(st.habits, h.id); x.log = x.log || {};
      var n = Math.max(0, (x.log[key] || 0) + delta);
      if (n) x.log[key] = n; else delete x.log[key];
    });
  }
  A.actions['habit-tick'] = function (el, e) {
    var h = A.byId(A.state.habits, el.getAttribute('data-id')), k = el.getAttribute('data-day');
    var n = (h.log || {})[k] || 0, tgt = h.target || 1;
    if (e.shiftKey || e.altKey) return bump(h, k, -1);
    if (tgt === 1) bump(h, k, n ? -n : 1);
    else bump(h, k, n >= tgt ? -n : 1);
    if (!n && tgt === 1 && k === D.todayKey() && A.celebrate) A.celebrate();
  };
  A.actions['habit-inc'] = function (el) { bump(A.byId(A.state.habits, el.getAttribute('data-id')), D.todayKey(), 1); };
  A.actions['habit-dec'] = function (el) { bump(A.byId(A.state.habits, el.getAttribute('data-id')), D.todayKey(), -1); };
  A.actions['habit-new'] = function () { A.editHabit(null); };
  A.actions['habit-edit'] = function (el) { A.editHabit(A.byId(A.state.habits, el.getAttribute('data-id'))); };
  A.actions['habit-unarchive'] = function (el) { A.commit('Restore habit', ['habits'], function (st) { A.byId(st.habits, el.getAttribute('data-id')).archived = false; }); };

  A.editHabit = function (h) {
    var isNew = !h;
    h = h ? A.clone(h) : { id: A.uid(), name: '', color: A.colors[A.state.habits.length % A.colors.length], days: [], target: 1, unit: '', log: {}, created: D.todayKey() };
    var all = !h.days || !h.days.length || h.days.length === 7;
    var m = A.modal({
      title: isNew ? 'New habit' : 'Edit habit', size: 'sm',
      body: '<div class="form"><label class="fld"><span>Habit</span><input id="hf-name" placeholder="Read 20 pages" value="' + esc(h.name) + '" autofocus></label>' +
        '<div class="fld"><span>Which days</span><div class="daypick" id="hf-days">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button type="button" data-d="' + d + '" class="' + (all || h.days.indexOf(d) >= 0 ? 'on' : '') + '">' + D.WD[d].slice(0, 2) + '</button>'; }).join('') + '</div>' +
        '<div class="date-chips"><button type="button" class="chip" data-preset="all">Every day</button><button type="button" class="chip" data-preset="wk">Weekdays</button><button type="button" class="chip" data-preset="mwf">Mon · Wed · Fri</button><button type="button" class="chip" data-preset="we">Weekends</button></div></div>' +
        '<div class="grid2"><label class="fld"><span>Target per day</span><input type="number" id="hf-target" min="1" max="999" value="' + (h.target || 1) + '"></label>' +
        '<label class="fld"><span>Unit</span><input id="hf-unit" placeholder="glasses, pages, km" value="' + esc(h.unit || '') + '"></label></div>' +
        '<div class="fld"><span>Colour</span>' + A.f.swatches('hf-c', h.color) + '</div></div>',
      foot: (isNew ? '' : '<button class="btn danger ghost" id="hf-del">' + A.icon('trash') + 'Delete</button><button class="btn ghost" id="hf-arch">' + A.icon('archive') + 'Archive</button>') +
        '<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="hf-save">Save</button>'
    });
    var root = m.root;
    A.$$('#hf-days button', root).forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); }); });
    A.$$('[data-preset]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var set = { all: [0, 1, 2, 3, 4, 5, 6], wk: [1, 2, 3, 4, 5], mwf: [1, 3, 5], we: [0, 6] }[b.getAttribute('data-preset')];
        A.$$('#hf-days button', root).forEach(function (x) { x.classList.toggle('on', set.indexOf(+x.getAttribute('data-d')) >= 0); });
      });
    });
    function save() {
      var name = A.$('#hf-name', root).value.trim(); if (!name) { A.$('#hf-name', root).focus(); return; }
      var days = A.$$('#hf-days .on', root).map(function (b) { return +b.getAttribute('data-d'); });
      var v = { name: name, days: days.length === 7 || !days.length ? [] : days, target: Math.max(1, +A.$('#hf-target', root).value || 1), unit: A.$('#hf-unit', root).value.trim(), color: (A.$('input[name=hf-c]:checked', root) || {}).value || h.color };
      A.commit(isNew ? 'Add habit' : 'Edit habit', ['habits'], function (st) {
        if (isNew) st.habits.push(Object.assign(h, v)); else Object.assign(A.byId(st.habits, h.id), v);
      });
      m.close();
    }
    A.$('#hf-save', root).addEventListener('click', save);
    A.$('#hf-name', root).addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
    if (!isNew) {
      A.$('#hf-arch', root).addEventListener('click', function () { A.commit('Archive habit', ['habits'], function (st) { A.byId(st.habits, h.id).archived = true; }); m.close(); A.toast('Archived "' + h.name + '"', { undo: true }); });
      A.$('#hf-del', root).addEventListener('click', function () {
        A.confirm('Delete "' + h.name + '" and its whole history? Archive keeps the history instead.', { ok: 'Delete habit', danger: true }).then(function (ok) {
          if (!ok) return;
          A.commit('Delete habit', ['habits'], function (st) { st.habits = st.habits.filter(function (x) { return x.id !== h.id; }); });
          m.close(); A.toast('Deleted "' + h.name + '"', { undo: true });
        });
      });
    }
  };

  /* ============================================================= GOALS */
  A.views.goals = function (main) {
    var active = A.state.goals.filter(function (g) { return !g.archived && !g.done; });
    var done = A.state.goals.filter(function (g) { return g.done && !g.archived; });
    function card(g) {
      var p = A.goalProgress(g), c = g.catId ? A.cat(g.catId).color : 'var(--accent)';
      var dl = g.deadline ? D.diffDays(D.today(), D.parse(g.deadline)) : null;
      var tasks = A.state.tasks.filter(function (t) { return t.goalId === g.id; });
      var openT = tasks.filter(A.taskOpen);
      var ms = g.milestones || [];
      /* expected progress if the deadline is linear from creation */
      var pace = '';
      if (g.deadline && g.created) {
        var total = D.diffDays(D.parse(g.created), D.parse(g.deadline)), gone = D.diffDays(D.parse(g.created), D.today());
        if (total > 0) { var exp = A.clamp(gone / total, 0, 1); pace = p + 0.05 >= exp ? '<span class="pill good">On track</span>' : '<span class="pill warn">Behind pace</span>'; }
      }
      return '<article class="goal card" style="--c:' + c + '">' +
        '<header><div><h3><button class="linkish" data-act="goal-edit" data-id="' + g.id + '">' + esc(g.title) + '</button></h3>' +
        (g.why ? '<p class="why">' + esc(g.why) + '</p>' : '') + '</div><span style="--ring:' + c + '">' + A.ring(p, 56, 6, Math.round(p * 100) + '%') + '</span></header>' +
        '<div class="gmeta">' + (g.catId ? '<span class="pill" style="--c:' + c + '"><i class="dot"></i>' + esc(A.cat(g.catId).name) + '</span>' : '') +
        (dl != null ? '<span class="pill' + (dl < 0 ? ' bad' : dl < 14 ? ' warn' : '') + '">' + A.icon('flag') + (dl < 0 ? Math.abs(dl) + ' days past deadline' : dl === 0 ? 'Due today' : dl + ' days left') + '</span>' : '') + pace + '</div>' +
        (g.target ? '<div class="gnum"><div class="bar"><i style="width:' + Math.round(A.clamp((g.current || 0) / g.target, 0, 1) * 100) + '%"></i></div>' +
          '<span><b>' + (g.current || 0) + '</b> / ' + g.target + ' ' + esc(g.unit || '') + '</span>' +
          '<button class="icon-btn small" data-act="goal-dec" data-id="' + g.id + '" aria-label="Decrease">−</button><button class="icon-btn small" data-act="goal-inc" data-id="' + g.id + '" aria-label="Increase">+</button></div>' : '') +
        (ms.length ? '<ul class="ms">' + ms.map(function (mm) {
          return '<li class="' + (mm.done ? 'done' : '') + '"><button class="cbox small" data-act="goal-ms" data-id="' + g.id + '" data-ms="' + mm.id + '" aria-label="Toggle milestone">' + (mm.done ? A.icon('check') : '') + '</button><span>' + esc(mm.title) + '</span>' + (mm.due ? '<small>' + D.rel(D.parse(mm.due)) + '</small>' : '') + '</li>';
        }).join('') + '</ul>' : '') +
        '<footer><button class="btn small" data-act="goal-tasks" data-id="' + g.id + '">' + A.icon('tasks') + (tasks.length ? openT.length + ' open of ' + tasks.length + ' tasks' : 'Add tasks') + '</button>' +
        (p >= 1 ? '<button class="btn small primary" data-act="goal-complete" data-id="' + g.id + '">Mark achieved</button>' : '') + '</footer></article>';
    }
    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Goals</h1><span class="muted">' + active.length + ' active' + (done.length ? ' · ' + done.length + ' achieved' : '') + '</span></div>' +
      '<div class="vh-right"><button class="btn primary" data-act="goal-new">' + A.icon('plus') + '<span>New goal</span></button></div></div>' +
      (active.length ? '<div class="goals">' + active.map(card).join('') + '</div>' :
        '<div class="empty"><h3>No goals yet</h3><p>A goal can track milestones, linked tasks, a number (books read, kilometres run, money saved), or all three. Progress combines whatever you use.</p><button class="btn primary" data-act="goal-new">' + A.icon('plus') + 'Set a goal</button></div>') +
      (done.length ? '<h2 class="sec">Achieved</h2><div class="goals small">' + done.map(card).join('') + '</div>' : '');
  };

  A.editGoal = function (g) {
    var isNew = !g;
    g = g ? A.clone(g) : { id: A.uid(), title: '', why: '', catId: '', deadline: '', milestones: [], target: null, current: 0, unit: '', created: D.todayKey() };
    var ms = (g.milestones || []).map(function (x) { return Object.assign({}, x); });
    var m = A.modal({
      title: isNew ? 'New goal' : 'Edit goal', size: 'md',
      body: '<div class="form"><input id="gf-title" class="big-input" placeholder="Run a half marathon" value="' + esc(g.title) + '" autofocus>' +
        '<label class="fld"><span>Why it matters</span><input id="gf-why" placeholder="One line you can come back to on a bad day" value="' + esc(g.why || '') + '"></label>' +
        '<div class="grid2"><label class="fld"><span>Deadline</span><input type="date" id="gf-dl" value="' + esc(g.deadline || '') + '"></label><label class="fld"><span>Category</span>' + A.f.catSelect('gf-cat', g.catId) + '</label></div>' +
        '<div class="grid3"><label class="fld"><span>Numeric target</span><input type="number" id="gf-target" min="0" placeholder="e.g. 24" value="' + (g.target || '') + '"></label>' +
        '<label class="fld"><span>Current</span><input type="number" id="gf-cur" min="0" value="' + (g.current || 0) + '"></label>' +
        '<label class="fld"><span>Unit</span><input id="gf-unit" placeholder="books, km, $" value="' + esc(g.unit || '') + '"></label></div>' +
        '<div class="fld"><span>Milestones</span><div id="gf-ms" class="subs"></div><form id="gf-msadd" class="sub-add"><input id="gf-msin" placeholder="Add a milestone and press Enter"></form></div></div>',
      foot: (isNew ? '' : '<button class="btn danger ghost" id="gf-del">' + A.icon('trash') + 'Delete</button>') + '<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="gf-save">Save</button>'
    });
    var root = m.root;
    function paint() {
      A.$('#gf-ms', root).innerHTML = ms.map(function (x, i) {
        return '<div class="sub' + (x.done ? ' done' : '') + '"><button type="button" class="cbox small" data-mi="' + i + '">' + (x.done ? A.icon('check') : '') + '</button><input data-mt="' + i + '" value="' + esc(x.title) + '" aria-label="Milestone">' +
          '<input type="date" data-md="' + i + '" value="' + esc(x.due || '') + '" aria-label="Milestone date"><button type="button" class="icon-btn subtle" data-mx="' + i + '" aria-label="Remove">' + A.icon('x') + '</button></div>';
      }).join('');
      A.$$('[data-mi]', root).forEach(function (b) { b.addEventListener('click', function () { var x = ms[+b.getAttribute('data-mi')]; x.done = !x.done; paint(); }); });
      A.$$('[data-mx]', root).forEach(function (b) { b.addEventListener('click', function () { ms.splice(+b.getAttribute('data-mx'), 1); paint(); }); });
      A.$$('[data-mt]', root).forEach(function (b) { b.addEventListener('input', function () { ms[+b.getAttribute('data-mt')].title = b.value; }); });
      A.$$('[data-md]', root).forEach(function (b) { b.addEventListener('change', function () { ms[+b.getAttribute('data-md')].due = b.value; }); });
    }
    paint();
    A.$('#gf-msadd', root).addEventListener('submit', function (e) { e.preventDefault(); var v = A.$('#gf-msin', root).value.trim(); if (!v) return; ms.push({ id: A.uid(), title: v, done: false, due: '' }); A.$('#gf-msin', root).value = ''; paint(); });
    A.$('#gf-save', root).addEventListener('click', function () {
      var title = A.$('#gf-title', root).value.trim(); if (!title) { A.$('#gf-title', root).focus(); return; }
      var v = { title: title, why: A.$('#gf-why', root).value.trim(), deadline: A.$('#gf-dl', root).value, catId: A.$('#gf-cat', root).value,
        target: +A.$('#gf-target', root).value || null, current: +A.$('#gf-cur', root).value || 0, unit: A.$('#gf-unit', root).value.trim(), milestones: ms.filter(function (x) { return x.title.trim(); }) };
      A.commit(isNew ? 'Add goal' : 'Edit goal', ['goals'], function (st) { if (isNew) st.goals.push(Object.assign(g, v)); else Object.assign(A.byId(st.goals, g.id), v); });
      m.close();
    });
    var del = A.$('#gf-del', root);
    if (del) del.addEventListener('click', function () {
      A.confirm('Delete "' + g.title + '"? Linked tasks stay, unlinked.', { ok: 'Delete goal', danger: true }).then(function (ok) {
        if (!ok) return;
        A.commit('Delete goal', ['goals', 'tasks'], function (st) { st.goals = st.goals.filter(function (x) { return x.id !== g.id; }); st.tasks.forEach(function (t) { if (t.goalId === g.id) t.goalId = ''; }); });
        m.close(); A.toast('Deleted goal', { undo: true });
      });
    });
  };
  function goalSet(id, fn, label) { A.commit(label || 'Update goal', ['goals'], function (st) { fn(A.byId(st.goals, id)); }); }
  A.actions['goal-new'] = function () { A.editGoal(null); };
  A.actions['goal-edit'] = function (el) { A.editGoal(A.byId(A.state.goals, el.getAttribute('data-id'))); };
  A.actions['goal-inc'] = function (el) { goalSet(el.getAttribute('data-id'), function (g) { g.current = (g.current || 0) + 1; }); };
  A.actions['goal-dec'] = function (el) { goalSet(el.getAttribute('data-id'), function (g) { g.current = Math.max(0, (g.current || 0) - 1); }); };
  A.actions['goal-ms'] = function (el) { goalSet(el.getAttribute('data-id'), function (g) { var x = A.byId(g.milestones, el.getAttribute('data-ms')); x.done = !x.done; }, 'Toggle milestone'); };
  A.actions['goal-complete'] = function (el) { goalSet(el.getAttribute('data-id'), function (g) { g.done = true; g.doneAt = D.todayKey(); }, 'Achieve goal'); A.celebrate && A.celebrate(true); A.toast('Goal achieved.', { undo: true }); };
  A.actions['goal-tasks'] = function (el) { A.tasksUI.list = 'goal:' + el.getAttribute('data-id'); A.go('tasks'); };

  /* =========================================================== JOURNAL */
  var MOODS = [['', '—'], [1, 'Awful'], [2, 'Low'], [3, 'Okay'], [4, 'Good'], [5, 'Great']];
  A.journalUI = { date: null };

  A.views.journal = function (main) {
    var J = A.journalUI;
    if (!J.date) J.date = D.today();
    var date = J.date, k = D.key(date), e = A.state.journal[k] || {};
    var first = new Date(date.getFullYear(), date.getMonth(), 1), start = D.startOfWeek(first, A.state.settings.weekStart);
    var cal = '';
    for (var i = 0; i < 7; i++) cal += '<span class="jwd">' + D.WD[(A.state.settings.weekStart + i) % 7].slice(0, 2) + '</span>';
    for (var j = 0; j < 42; j++) {
      var d = D.addDays(start, j), dk = D.key(d), je = A.state.journal[dk];
      cal += '<button class="jd' + (d.getMonth() !== date.getMonth() ? ' out' : '') + (dk === k ? ' sel' : '') + (D.sameDay(d, D.today()) ? ' today' : '') + (je && je.mood ? ' m' + je.mood : '') + (je && je.text ? ' txt' : '') + '"' +
        (d > D.today() ? ' disabled' : '') + ' data-act="journal-day" data-day="' + dk + '">' + d.getDate() + '</button>';
    }
    /* last 30 days of mood for the sparkline */
    var pts = [];
    for (var n = 29; n >= 0; n--) { var dd = D.addDays(D.today(), -n), x = A.state.journal[D.key(dd)]; pts.push(x && x.mood ? x.mood : null); }
    var monthEntries = Object.keys(A.state.journal).filter(function (x) { return x.slice(0, 7) === k.slice(0, 7) && (A.state.journal[x].text || A.state.journal[x].mood); });
    var moods = monthEntries.map(function (x) { return A.state.journal[x].mood; }).filter(Boolean);
    var avg = moods.length ? A.sum(moods) / moods.length : 0;
    var wstreak = 0, wd = D.today(); if (!(A.state.journal[D.key(wd)] || {}).text) wd = D.addDays(wd, -1);
    while ((A.state.journal[D.key(wd)] || {}).text) { wstreak++; wd = D.addDays(wd, -1); }
    var grat = e.gratitude || ['', '', ''];
    var prompts = ['What would make tomorrow great?', 'What drained you today, and what gave you energy?', 'One thing you learned today.', 'What are you avoiding, and why?', 'Who helped you this week?', 'What went better than expected?', 'If today repeated for a year, where would you end up?'];
    var prompt = prompts[(date.getDate() + date.getMonth()) % prompts.length];

    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">Journal</h1><span class="muted">' + (wstreak ? wstreak + '-day writing streak' : 'Write a few lines a day') + '</span></div>' +
      '<div class="vh-right"><button class="btn" data-act="journal-today">Today</button></div></div>' +
      '<div class="journal">' +
      '<aside class="jside card"><div class="jhead"><button class="icon-btn" data-act="journal-month" data-dir="-1" aria-label="Previous month">' + A.icon('left') + '</button><b>' + D.fmt(date, 'month') + '</b>' +
      '<button class="icon-btn" data-act="journal-month" data-dir="1" aria-label="Next month">' + A.icon('right') + '</button></div><div class="jcal">' + cal + '</div>' +
      '<div class="jlegend">' + MOODS.slice(1).map(function (mm) { return '<span><i class="jm m' + mm[0] + '"></i>' + mm[1] + '</span>'; }).join('') + '</div>' +
      '<div class="jstats"><div><b>' + monthEntries.length + '</b><small>entries this month</small></div><div><b>' + (avg ? avg.toFixed(1) : '–') + '</b><small>average mood</small></div></div>' +
      '<div class="spark-wrap"><small class="muted">Mood, last 30 days</small>' + A.sparkline(pts, 5) + '</div></aside>' +
      '<section class="jentry card"><h2>' + D.fmt(date, 'long') + '</h2>' +
      '<div class="fld"><span>Mood</span><div class="mood" id="j-mood">' + MOODS.slice(1).map(function (mm) { return '<button type="button" class="m' + mm[0] + (e.mood === mm[0] ? ' on' : '') + '" data-v="' + mm[0] + '"><i class="jm m' + mm[0] + '"></i>' + mm[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="grid2"><div class="fld"><span>Energy</span><div class="seg" id="j-energy">' + [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" data-v="' + v + '" class="' + (e.energy === v ? 'on' : '') + '">' + v + '</button>'; }).join('') + '</div></div>' +
      '<label class="fld"><span>Sleep (hours)</span><input type="number" id="j-sleep" min="0" max="24" step="0.5" value="' + (e.sleep != null ? e.sleep : '') + '" placeholder="7.5"></label></div>' +
      '<div class="fld"><span>Three good things</span>' + [0, 1, 2].map(function (i) { return '<input class="grat" data-g="' + i + '" value="' + esc(grat[i] || '') + '" placeholder="' + ['Something small that went right', 'Someone you are glad for', 'Something you are looking forward to'][i] + '">'; }).join('') + '</div>' +
      '<label class="fld"><span>Notes <em class="muted">· ' + esc(prompt) + '</em></span><textarea id="j-text" rows="9" placeholder="Write freely. It saves as you type.">' + esc(e.text || '') + '</textarea></label>' +
      '<p class="muted small" id="j-saved">' + (e.text || e.mood ? 'Saved' : '') + '</p></section></div>';

    var root = main;
    function save(patch) {
      A.commit('Edit journal', ['journal'], function (st) {
        var cur = Object.assign({}, st.journal[k] || {}, patch);
        var empty = !cur.mood && !cur.energy && cur.sleep == null && !cur.text && !(cur.gratitude || []).some(Boolean);
        if (empty) delete st.journal[k]; else st.journal[k] = cur;
      });
    }
    var quiet = A.debounce(function (patch) { A.silent = true; save(patch()); A.silent = false; var s = A.$('#j-saved'); if (s) s.textContent = 'Saved ' + D.time(new Date()); }, 700);
    A.$$('#j-mood button', root).forEach(function (b) { b.addEventListener('click', function () { var v = +b.getAttribute('data-v'); save({ mood: e.mood === v ? null : v }); }); });
    A.$$('#j-energy button', root).forEach(function (b) { b.addEventListener('click', function () { var v = +b.getAttribute('data-v'); save({ energy: e.energy === v ? null : v }); }); });
    A.$('#j-sleep', root).addEventListener('change', function (ev) { save({ sleep: ev.target.value === '' ? null : +ev.target.value }); });
    A.$('#j-text', root).addEventListener('input', function (ev) { var v = ev.target.value; A.$('#j-saved').textContent = 'Saving…'; quiet(function () { return { text: v }; }); });
    A.$$('.grat', root).forEach(function (inp) {
      inp.addEventListener('input', function () {
        quiet(function () { return { gratitude: A.$$('.grat', root).map(function (x) { return x.value; }) }; });
      });
    });
  };
  A.actions['journal-day'] = function (el) { A.journalUI.date = D.parse(el.getAttribute('data-day')); A.render(); };
  A.actions['journal-today'] = function () { A.journalUI.date = D.today(); A.render(); };
  A.actions['journal-month'] = function (el) {
    var d = D.addMonths(new Date(A.journalUI.date.getFullYear(), A.journalUI.date.getMonth(), 1), +el.getAttribute('data-dir'));
    if (d > D.today()) d = D.today();
    A.journalUI.date = d; A.render();
  };

  /* Small SVG line for 1–max values with gaps. */
  A.sparkline = function (pts, max, w, h) {
    w = w || 240; h = h || 48;
    var step = w / Math.max(1, pts.length - 1), d = '', area = '', pen = false, lastX = 0, firstX = null, dots = '';
    pts.forEach(function (v, i) {
      if (v == null) { pen = false; return; }
      var x = i * step, y = h - 4 - (v - 1) / Math.max(1, max - 1) * (h - 8);
      d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      pen = true; lastX = x; if (firstX == null) firstX = x;
      dots = '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="var(--accent)"/>';
    });
    if (!d) return '<p class="muted small">Log your mood to see a trend.</p>';
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Trend">' +
      '<line x1="0" x2="' + w + '" y1="' + (h / 2) + '" y2="' + (h / 2) + '" stroke="var(--line)" stroke-dasharray="3 3"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg>';
  };
})();
