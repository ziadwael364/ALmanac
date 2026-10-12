/* Almanac — tasks: smart lists, projects, board, matrix, editor, scheduling. */
'use strict';
(function () {
  var D = A.D, esc = A.esc;
  var T = A.tasksUI = { list: 'today', layout: 'list', sort: 'smart', group: 'due', showDone: false };

  A.prioFlag = function (t) {
    if (!t.priority) return '';
    return '<span class="prio p' + t.priority + '" title="' + ['', 'Low', 'Medium', 'High'][t.priority] + ' priority">' + A.icon('flag') + '</span>';
  };

  /* -------------------------------------------------------- filters */
  var SMART = [
    { id: 'inbox', name: 'Inbox', icon: 'inbox', test: function (t) { return !t.projectId && !t.due; } },
    { id: 'today', name: 'Today', icon: 'today', test: function (t) { return t.due && t.due <= D.todayKey(); } },
    { id: 'upcoming', name: 'Next 7 days', icon: 'calendar', test: function (t) { return t.due && t.due <= D.key(D.addDays(D.today(), 7)); } },
    { id: 'overdue', name: 'Overdue', icon: 'clock', test: function (t) { return A.taskOverdue(t); } },
    { id: 'someday', name: 'No date', icon: 'layers', test: function (t) { return !t.due; } },
    { id: 'high', name: 'High priority', icon: 'flag', test: function (t) { return t.priority >= 3; } },
    { id: 'all', name: 'All tasks', icon: 'tasks', test: function () { return true; } },
    { id: 'done', name: 'Completed', icon: 'check', test: function (t) { return t.status === 'done'; }, done: true }
  ];
  T.smart = SMART;
  function currentFilter() {
    var sm = SMART.filter(function (s) { return s.id === T.list; })[0];
    if (sm) return sm;
    if (T.list.indexOf('p:') === 0) { var p = A.project(T.list.slice(2)); return { id: T.list, name: p.name, color: p.color, project: p, test: function (t) { return (t.projectId || '') === (p.system ? '' : p.id); } }; }
    if (T.list.indexOf('tag:') === 0) { var tag = T.list.slice(4); return { id: T.list, name: '#' + tag, test: function (t) { return (t.tags || []).indexOf(tag) >= 0; } }; }
    if (T.list.indexOf('goal:') === 0) { var g = A.byId(A.state.goals, T.list.slice(5)) || { title: 'Goal' }; return { id: T.list, name: g.title, test: function (t) { return t.goalId === g.id; } }; }
    T.list = 'today'; return SMART[1];
  }
  T.count = function (id) {
    var f = SMART.filter(function (s) { return s.id === id; })[0]; if (!f) return 0;
    return A.state.tasks.filter(function (t) { return (f.done || t.status !== 'done') && f.test(t); }).length;
  };
  function allTags() {
    var set = {}; A.state.tasks.forEach(function (t) { (t.tags || []).forEach(function (g) { set[g] = (set[g] || 0) + 1; }); });
    return Object.keys(set).sort();
  }
  function sorted(list) {
    var key = T.sort;
    return list.slice().sort(function (a, b) {
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
      if (key === 'priority') return (b.priority || 0) - (a.priority || 0) || cmpDue(a, b);
      if (key === 'due') return cmpDue(a, b) || (b.priority || 0) - (a.priority || 0);
      if (key === 'title') return a.title.localeCompare(b.title);
      if (key === 'created') return (b.created || '').localeCompare(a.created || '');
      if (key === 'manual') return (a.order || 0) - (b.order || 0);
      /* smart: overdue first, then due date, then priority, then estimate */
      var ao = A.taskOverdue(a) ? 0 : 1, bo = A.taskOverdue(b) ? 0 : 1;
      return ao - bo || cmpDue(a, b) || (b.priority || 0) - (a.priority || 0) || (a.estimate || 999) - (b.estimate || 999);
    });
  }
  function cmpDue(a, b) { var x = (a.due || '9999') + (a.dueTime || '99'), y = (b.due || '9999') + (b.dueTime || '99'); return x < y ? -1 : x > y ? 1 : 0; }
  function bucket(t) {
    if (t.status === 'done') return ['9', 'Completed'];
    if (!t.due) return ['8', 'No date'];
    var n = D.diffDays(D.today(), D.parse(t.due));
    if (n < 0) return ['0', 'Overdue'];
    if (n === 0) return ['1', 'Today'];
    if (n === 1) return ['2', 'Tomorrow'];
    if (n < 7) return ['3', 'This week'];
    if (n < 31) return ['4', 'This month'];
    return ['5', 'Later'];
  }
  function groupOf(t) {
    if (T.group === 'none') return ['0', ''];
    if (T.group === 'project') { var p = A.project(t.projectId); return [p.system ? '0' : '1' + p.name, p.name]; }
    if (T.group === 'priority') return [String(3 - (t.priority || 0)), ['No priority', 'Low', 'Medium', 'High'][t.priority || 0]];
    if (T.group === 'category') { var c = A.cat(t.catId); return [t.catId ? '0' + c.name : '9', t.catId ? c.name : 'No category']; }
    return bucket(t);
  }

  /* ------------------------------------------------------------ rows */
  function row(t) {
    var sub = t.subtasks || [], subDone = sub.filter(function (s) { return s.done; }).length;
    var due = t.due ? D.parse(t.due) : null, over = A.taskOverdue(t);
    var ev = t.eventId ? A.byId(A.state.events, t.eventId) : null;
    var p = A.project(t.projectId);
    return '<div class="trow' + (t.status === 'done' ? ' done' : '') + (t.status === 'doing' ? ' doing' : '') + '" data-task="' + t.id + '" draggable="true">' +
      '<button class="cbox p' + (t.priority || 0) + '" data-act="task-toggle" data-id="' + t.id + '" aria-label="' + (t.status === 'done' ? 'Mark not done' : 'Complete') + '">' + (t.status === 'done' ? A.icon('check') : '') + '</button>' +
      '<button class="tmain" data-act="task-open" data-id="' + t.id + '">' +
      '<span class="tt">' + esc(t.title) + '</span>' +
      '<span class="tmeta">' +
      (t.status === 'doing' ? '<span class="pill doing">In progress</span>' : '') +
      (due ? '<span class="due' + (over ? ' over' : '') + '">' + A.icon('calendar') + D.rel(due) + (t.dueTime ? ' ' + D.time(D.parse(t.due + 'T' + t.dueTime)) : '') + '</span>' : '') +
      (ev ? '<span class="sched">' + A.icon('clock') + D.rel(D.parse(ev.start)) + ' ' + D.time(D.parse(ev.start)) + '</span>' : '') +
      (sub.length ? '<span>' + A.icon('tasks') + subDone + '/' + sub.length + '</span>' : '') +
      (t.estimate ? '<span>~' + D.dur(t.estimate) + '</span>' : '') +
      (t.spent ? '<span title="Focus time logged">' + A.icon('focus') + D.dur(t.spent) + '</span>' : '') +
      (t.repeat ? '<span title="Repeats">' + A.icon('repeat') + '</span>' : '') +
      (!p.system && T.list.indexOf('p:') !== 0 ? '<span class="proj" style="--c:' + p.color + '"><i></i>' + esc(p.name) + '</span>' : '') +
      (t.tags || []).map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('') +
      '</span></button>' + A.prioFlag(t) +
      '<button class="icon-btn subtle" data-act="task-more" data-id="' + t.id + '" aria-label="More">' + A.icon('more') + '</button></div>';
  }

  function listLayout(tasks) {
    if (!tasks.length) return empty();
    var groups = {}, order = [];
    sorted(tasks).forEach(function (t) {
      var g = groupOf(t), k = g[0] + '|' + g[1];
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(t);
    });
    order.sort();
    return '<div class="tlist">' + order.map(function (k) {
      var label = k.split('|')[1], list = groups[k];
      var est = A.sum(list.filter(A.taskOpen), function (t) { return t.estimate || 0; });
      return '<section class="tgroup">' + (label ? '<h3>' + esc(label) + ' <span class="muted">' + list.length + (est ? ' · ~' + D.dur(est) : '') + '</span></h3>' : '') + list.map(row).join('') + '</section>';
    }).join('') + '</div>';
  }

  function boardLayout(tasks) {
    var cols = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
    return '<div class="board">' + cols.map(function (c) {
      var list = sorted(tasks.filter(function (t) { return (t.status || 'todo') === c[0]; }));
      return '<section class="bcol" data-status="' + c[0] + '"><h3>' + c[1] + ' <span class="muted">' + list.length + '</span></h3><div class="bcards">' +
        list.map(function (t) {
          var sub = t.subtasks || [];
          return '<div class="bcard" draggable="true" data-task="' + t.id + '" data-act="task-open" data-id="' + t.id + '" tabindex="0">' +
            '<div class="bt">' + A.prioFlag(t) + esc(t.title) + '</div><div class="tmeta">' +
            (t.due ? '<span class="due' + (A.taskOverdue(t) ? ' over' : '') + '">' + D.rel(D.parse(t.due)) + '</span>' : '') +
            (sub.length ? '<span>' + sub.filter(function (s) { return s.done; }).length + '/' + sub.length + '</span>' : '') +
            (t.estimate ? '<span>~' + D.dur(t.estimate) + '</span>' : '') + '</div></div>';
        }).join('') + '</div></section>';
    }).join('') + '</div>';
  }

  function isImportant(t) { return t.important != null ? t.important : (t.priority || 0) >= 2; }
  function isUrgent(t) { return t.urgent != null ? t.urgent : !!(t.due && D.diffDays(D.today(), D.parse(t.due)) <= 2); }
  function matrixLayout(tasks) {
    var q = [
      ['do', 'Do now', 'Important and urgent', true, true],
      ['plan', 'Schedule', 'Important, not urgent', true, false],
      ['delegate', 'Delegate or batch', 'Urgent, not important', false, true],
      ['drop', 'Drop or later', 'Neither', false, false]
    ];
    var open = tasks.filter(A.taskOpen);
    return '<div class="matrix">' + q.map(function (x) {
      var list = sorted(open.filter(function (t) { return isImportant(t) === x[3] && isUrgent(t) === x[4]; }));
      return '<section class="mq mq-' + x[0] + '" data-imp="' + x[3] + '" data-urg="' + x[4] + '"><h3>' + x[1] + '<small>' + x[2] + '</small></h3><div class="mlist">' +
        (list.length ? list.map(function (t) {
          return '<div class="mitem" draggable="true" data-task="' + t.id + '"><button class="cbox" data-act="task-toggle" data-id="' + t.id + '" aria-label="Complete"></button>' +
            '<button class="linkish" data-act="task-open" data-id="' + t.id + '">' + esc(t.title) + '</button>' + (t.due ? '<small class="' + (A.taskOverdue(t) ? 'over' : '') + '">' + D.rel(D.parse(t.due)) + '</small>' : '') + '</div>';
        }).join('') : '<p class="muted small">Drop tasks here.</p>') + '</div></section>';
    }).join('') + '</div>';
  }

  function empty() {
    var f = currentFilter();
    var msg = f.id === 'today' ? 'Nothing due today. Enjoy it, or pull something forward.' : f.id === 'overdue' ? 'Nothing overdue. Nice.' : 'No tasks here yet.';
    return '<div class="empty"><h3>' + esc(msg) + '</h3><p>Type in the box above. <code>Email Sam fri !2 ~15m +work</code> sets a date, priority, estimate and project in one go.</p></div>';
  }

  /* ------------------------------------------------------------ view */
  A.views.tasks = function (main) {
    var f = currentFilter();
    var tasks = A.state.tasks.filter(function (t) { return f.test(t) && (f.done || T.showDone || T.layout === 'board' || t.status !== 'done'); });
    var openEst = A.sum(tasks.filter(A.taskOpen), function (t) { return t.estimate || 0; });
    var side = '<nav class="tside" aria-label="Task lists">' +
      SMART.map(function (s) {
        var n = T.count(s.id);
        return '<button class="tl' + (T.list === s.id ? ' on' : '') + (s.id === 'overdue' && n ? ' alert' : '') + '" data-act="tasks-list" data-list="' + s.id + '">' + A.icon(s.icon) + '<span>' + s.name + '</span>' + (n && s.id !== 'done' && s.id !== 'all' ? '<em>' + n + '</em>' : '') + '</button>';
      }).join('') +
      '<h4>Projects <button class="icon-btn subtle" data-act="project-new" aria-label="New project">' + A.icon('plus') + '</button></h4>' +
      A.state.projects.filter(function (p) { return !p.system; }).map(function (p) {
        var n = A.state.tasks.filter(function (t) { return t.projectId === p.id && t.status !== 'done'; }).length;
        return '<button class="tl' + (T.list === 'p:' + p.id ? ' on' : '') + '" data-act="tasks-list" data-list="p:' + p.id + '"><i class="dot" style="--c:' + p.color + '"></i><span>' + esc(p.name) + '</span>' + (n ? '<em>' + n + '</em>' : '') + '</button>';
      }).join('') +
      (allTags().length ? '<h4>Tags</h4><div class="tagcloud">' + allTags().map(function (g) { return '<button class="tag' + (T.list === 'tag:' + g ? ' on' : '') + '" data-act="tasks-list" data-list="tag:' + esc(g) + '">#' + esc(g) + '</button>'; }).join('') + '</div>' : '') +
      '</nav>';

    var listSelect = '<select class="tside-mobile" id="t-list-m" aria-label="List">' + SMART.map(function (s) { return A.f.opt(s.id, s.name, T.list); }).join('') +
      A.state.projects.filter(function (p) { return !p.system; }).map(function (p) { return A.f.opt('p:' + p.id, 'Project: ' + p.name, T.list); }).join('') + '</select>';

    var body = T.layout === 'board' ? boardLayout(tasks) : T.layout === 'matrix' ? matrixLayout(tasks) : listLayout(tasks);
    main.innerHTML =
      '<div class="view-head"><div class="vh-left"><h1 class="vh-title">' + (f.color ? '<i class="dot big" style="--c:' + f.color + '"></i>' : '') + esc(f.name) + '</h1>' +
      '<span class="muted">' + tasks.filter(A.taskOpen).length + ' open' + (openEst ? ' · ~' + D.dur(openEst) + ' of work' : '') + '</span>' + listSelect + '</div>' +
      '<div class="vh-right"><div class="seg">' + [['list', 'List', 'list'], ['board', 'Board', 'board'], ['matrix', 'Matrix', 'matrix']].map(function (l) {
        return '<button class="' + (T.layout === l[0] ? 'on' : '') + '" data-act="tasks-layout" data-l="' + l[0] + '">' + A.icon(l[2]) + '<span>' + l[1] + '</span></button>';
      }).join('') + '</div>' +
      (T.layout === 'list' ? '<select id="t-group" aria-label="Group by">' + [['due', 'Group: due date'], ['project', 'Group: project'], ['priority', 'Group: priority'], ['category', 'Group: category'], ['none', 'No grouping']].map(function (o) { return A.f.opt(o[0], o[1], T.group); }).join('') + '</select>' : '') +
      '<select id="t-sort" aria-label="Sort">' + [['smart', 'Sort: smart'], ['due', 'Sort: due date'], ['priority', 'Sort: priority'], ['created', 'Sort: newest'], ['title', 'Sort: A–Z']].map(function (o) { return A.f.opt(o[0], o[1], T.sort); }).join('') + '</select>' +
      (T.layout === 'list' && !f.done ? '<label class="toggle small"><input type="checkbox" id="t-done"' + (T.showDone ? ' checked' : '') + '><span>Show done</span></label>' : '') +
      (f.project && !f.project.system ? '<button class="icon-btn" data-act="project-edit" data-id="' + f.project.id + '" aria-label="Edit project">' + A.icon('edit') + '</button>' : '') +
      '</div></div>' +
      '<div class="tasks-wrap">' + side + '<div class="tmainc">' +
      '<form class="tadd" id="t-add"><span class="plus">' + A.icon('plus') + '</span><input id="t-add-in" autocomplete="off" placeholder="Add a task to ' + esc(f.name) + '… try “Revise notes fri ~45m !2 #study”"><div class="tadd-prev" id="t-add-prev"></div></form>' +
      body + '</div></div>';

    var g = A.$('#t-group', main); if (g) g.addEventListener('change', function () { T.group = g.value; A.remember(); A.render(); });
    A.$('#t-sort', main).addEventListener('change', function (e) { T.sort = e.target.value; A.remember(); A.render(); });
    var dn = A.$('#t-done', main); if (dn) dn.addEventListener('change', function () { T.showDone = dn.checked; A.render(); });
    A.$('#t-list-m', main).addEventListener('change', function (e) { T.list = e.target.value; A.render(); });

    var input = A.$('#t-add-in', main), prev = A.$('#t-add-prev', main);
    input.addEventListener('input', function () {
      var p = A.parseQuick('task: ' + input.value);
      prev.innerHTML = input.value.trim() ? p.chips.map(function (c) { return '<span class="chip chip-' + c.type + '">' + esc(c.label) + '</span>'; }).join('') : '';
    });
    A.$('#t-add', main).addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.value.trim()) return;
      var p = A.parseQuick('task: ' + input.value);
      if (!p.date && (f.id === 'today')) p.date = D.today();
      if (!p.date && f.id === 'upcoming') p.date = D.addDays(D.today(), 1);
      if (!p.projectId && f.project && !f.project.system) p.projectId = f.project.id;
      if (f.id === 'high' && !p.priority) p.priority = 3;
      if (T.list.indexOf('tag:') === 0 && p.tags.indexOf(T.list.slice(4)) < 0) p.tags.push(T.list.slice(4));
      var r = A.applyQuick(p);
      if (r && T.list.indexOf('goal:') === 0) A.commit('Link task', ['tasks'], function () { r.item.goalId = T.list.slice(5); });
      A.toast('Added task: ' + p.title, { undo: true });
      setTimeout(function () { var i = A.$('#t-add-in'); if (i) i.focus(); }, 20);
    });

    bindTaskDnD(main);
  };

  function bindTaskDnD(main) {
    A.$$('[data-task][draggable]', main).forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/x-task', el.getAttribute('data-task')); el.classList.add('dragging'); });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
    });
    A.$$('.bcol', main).forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('drop');
        var t = A.byId(A.state.tasks, e.dataTransfer.getData('text/x-task')); if (!t) return;
        var st = col.getAttribute('data-status');
        if (st === 'done' && t.status !== 'done') return A.toggleTask(t);
        A.commit('Move task', ['tasks'], function () { t.status = st; if (st !== 'done') t.completedAt = null; });
      });
    });
    A.$$('.mq', main).forEach(function (q) {
      q.addEventListener('dragover', function (e) { e.preventDefault(); q.classList.add('drop'); });
      q.addEventListener('dragleave', function () { q.classList.remove('drop'); });
      q.addEventListener('drop', function (e) {
        e.preventDefault(); q.classList.remove('drop');
        var t = A.byId(A.state.tasks, e.dataTransfer.getData('text/x-task')); if (!t) return;
        A.commit('Reprioritise task', ['tasks'], function () {
          t.important = q.getAttribute('data-imp') === 'true'; t.urgent = q.getAttribute('data-urg') === 'true';
          if (t.important && (t.priority || 0) < 2) t.priority = 2;
          if (!t.important && (t.priority || 0) >= 2) t.priority = 1;
        });
      });
    });
    /* drop a task row onto a smart list or project in the side nav */
    A.$$('.tside .tl', main).forEach(function (b) {
      b.addEventListener('dragover', function (e) { e.preventDefault(); b.classList.add('drop'); });
      b.addEventListener('dragleave', function () { b.classList.remove('drop'); });
      b.addEventListener('drop', function (e) {
        e.preventDefault(); b.classList.remove('drop');
        var t = A.byId(A.state.tasks, e.dataTransfer.getData('text/x-task')); if (!t) return;
        var l = b.getAttribute('data-list');
        A.commit('Move task', ['tasks'], function () {
          if (l.indexOf('p:') === 0) t.projectId = l.slice(2);
          else if (l === 'today') t.due = D.todayKey();
          else if (l === 'upcoming') t.due = D.key(D.addDays(D.today(), 1));
          else if (l === 'someday' || l === 'inbox') { t.due = ''; if (l === 'inbox') t.projectId = ''; }
          else if (l === 'high') t.priority = 3;
          else if (l === 'done' && t.status !== 'done') { t.status = 'done'; t.completedAt = new Date().toISOString(); }
        });
        A.toast('Moved "' + t.title + '"', { undo: true });
      });
    });
  }

  /* --------------------------------------------------- task mutations */
  A.newTask = function (o) {
    return Object.assign({
      id: A.uid(), title: '', notes: '', status: 'todo', priority: 0, due: '', dueTime: '', projectId: '', tags: [],
      estimate: null, subtasks: [], created: D.todayKey(), completedAt: null, spent: 0, repeat: null, catId: '', goalId: '', eventId: null
    }, o || {});
  };

  function nextDue(t) {
    var r = t.repeat, base = D.parse(t.due) || D.today(), iv = r.interval || 1;
    if (base < D.today() && r.fromCompletion) base = D.today();
    switch (r.freq) {
      case 'daily': return D.addDays(base, iv);
      case 'weekly':
        if (r.byDay && r.byDay.length) { for (var i = 1; i <= 7 * iv; i++) { var d = D.addDays(base, i); if (r.byDay.indexOf(d.getDay()) >= 0) return d; } }
        return D.addDays(base, 7 * iv);
      case 'monthly': return D.addMonths(base, iv);
      case 'yearly': return D.addMonths(base, 12 * iv);
    }
    return D.addDays(base, 1);
  }

  A.toggleTask = function (t) {
    var wasDone = t.status === 'done', created = null;
    A.commit(wasDone ? 'Reopen task' : 'Complete task', ['tasks'], function (st) {
      var x = A.byId(st.tasks, t.id); if (!x) return;
      if (wasDone) { x.status = 'todo'; x.completedAt = null; return; }
      x.status = 'done'; x.completedAt = new Date().toISOString();
      if (x.repeat && x.repeat.freq) {
        created = A.newTask(Object.assign(A.clone(x), { id: A.uid(), status: 'todo', completedAt: null, spent: 0, eventId: null, created: D.todayKey(),
          subtasks: (x.subtasks || []).map(function (s) { return { id: A.uid(), title: s.title, done: false }; }), due: D.key(nextDue(x)) }));
        x.repeat = null; /* the finished copy keeps history; the new one carries the rule */
        st.tasks.push(created);
      }
    });
    if (!wasDone) {
      A.celebrate && A.celebrate();
      A.toast('Done: ' + t.title + (created ? ' · next one ' + D.rel(D.parse(created.due)) : ''), { undo: true });
    }
  };

  A.deleteTask = function (t) {
    A.commit('Delete task', ['tasks', 'events'], function (st) {
      st.tasks = st.tasks.filter(function (x) { return x.id !== t.id; });
      st.events.forEach(function (e) { if (e.taskId === t.id) e.taskId = null; });
    });
    A.toast('Deleted "' + t.title + '"', { undo: true });
  };

  /* Put a task on the calendar as a time block. */
  A.scheduleTask = function (t, start, silent) {
    var len = t.estimate || 30;
    var ev = { id: A.uid(), title: t.title, start: D.stamp(start), end: D.stamp(D.addMin(start, len)), allDay: false, catId: t.catId || '', location: '', notes: t.notes || '', reminders: [], exdates: [], recur: null, taskId: t.id };
    A.commit('Schedule task', ['tasks', 'events'], function (st) {
      var x = A.byId(st.tasks, t.id);
      if (x && x.eventId) st.events = st.events.filter(function (e) { return e.id !== x.eventId; });
      st.events.push(ev); if (x) x.eventId = ev.id;
    });
    if (!silent) A.toast('Scheduled "' + t.title + '" for ' + D.rel(start) + ' ' + D.time(start), { undo: true });
    return ev;
  };
  A.unscheduleTask = function (t) {
    A.commit('Unschedule task', ['tasks', 'events'], function (st) {
      var x = A.byId(st.tasks, t.id); if (!x) return;
      st.events = st.events.filter(function (e) { return e.id !== x.eventId; });
      x.eventId = null;
    });
  };

  /* Next free slots of `len` minutes inside working hours. */
  A.findSlots = function (len, days, max) {
    var s = A.state.settings, out = [], now = new Date();
    for (var i = 0; i < (days || 7) && out.length < (max || 3); i++) {
      var day = D.addDays(D.today(), i);
      var from = s.workStart * 60, to = s.workEnd * 60;
      if (i === 0) from = Math.max(from, Math.ceil((D.minutesOfDay(now) + 5) / s.snap) * s.snap);
      if (to - from < len) continue;
      A.freeSlots(day, from, to, len).forEach(function (g) { if (out.length < (max || 3)) out.push(g.start); });
    }
    return out;
  };

  /* Fill a day's free time with open tasks, most pressing first. */
  A.autoSchedule = function (day) {
    day = D.startOfDay(day || D.today());
    var s = A.state.settings, isToday = D.sameDay(day, D.today());
    var from = s.workStart * 60, to = s.workEnd * 60;
    if (isToday) from = Math.max(from, Math.ceil((D.minutesOfDay(new Date()) + 5) / s.snap) * s.snap);
    var k = D.key(day);
    var pool = A.state.tasks.filter(function (t) { return t.status !== 'done' && !t.eventId && (!t.due || t.due <= D.key(D.addDays(day, 7))); });
    pool.sort(function (a, b) {
      var ad = a.due && a.due <= k ? 0 : 1, bd = b.due && b.due <= k ? 0 : 1;
      return ad - bd || (b.priority || 0) - (a.priority || 0) || cmpDue(a, b);
    });
    var gaps = from < to ? A.freeSlots(day, from, to, 15) : [], plan = [], BUF = 5;
    pool.forEach(function (t) {
      var len = t.estimate || 30;
      for (var i = 0; i < gaps.length; i++) {
        var g = gaps[i], avail = (g.end - g.start) / 60000;
        if (avail >= len) {
          plan.push({ task: t, start: new Date(g.start), len: len });
          g.start = D.addMin(g.start, len + BUF);
          break;
        }
      }
    });
    if (!plan.length) {
      A.toast(gaps.length ? 'No open task fits the free time on ' + D.rel(day) + '.' : 'No free time left in working hours on ' + D.rel(day) + '.');
      return;
    }
    var m = A.modal({
      title: 'Plan ' + D.rel(day).toLowerCase(), size: 'md',
      body: '<p class="lede">Fits ' + plan.length + ' task' + (plan.length > 1 ? 's' : '') + ' into free time between ' + D.time(D.fromMinutes(day, from)) + ' and ' + D.time(D.fromMinutes(day, to)) + ', most pressing first, with ' + BUF + ' minutes between blocks. Untick anything you don\'t want.</p>' +
        '<div class="plan-list">' + plan.map(function (p, i) {
          return '<label class="plan-i"><input type="checkbox" checked data-i="' + i + '"><span class="ag-time">' + D.time(p.start) + '–' + D.time(D.addMin(p.start, p.len)) + '</span><span>' + A.prioFlag(p.task) + esc(p.task.title) + '</span><small class="muted">' + D.dur(p.len) + (p.task.estimate ? '' : ' (default)') + '</small></label>';
        }).join('') + '</div>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="plan-go">Add to calendar</button>'
    });
    A.$('#plan-go', m.root).addEventListener('click', function () {
      var chosen = A.$$('input[data-i]:checked', m.root).map(function (c) { return plan[+c.getAttribute('data-i')]; });
      if (!chosen.length) { m.close(); return; }
      A.commit('Plan day', ['tasks', 'events'], function (st) {
        chosen.forEach(function (p) {
          var ev = { id: A.uid(), title: p.task.title, start: D.stamp(p.start), end: D.stamp(D.addMin(p.start, p.len)), allDay: false, catId: p.task.catId || '', location: '', notes: '', reminders: [], exdates: [], recur: null, taskId: p.task.id };
          st.events.push(ev);
          var x = A.byId(st.tasks, p.task.id); if (x) x.eventId = ev.id;
        });
      });
      m.close();
      A.toast('Added ' + chosen.length + ' time block' + (chosen.length > 1 ? 's' : ''), { undo: true });
      A.ui.date = day; A.cal.mode = A.cal.mode === 'week' ? 'week' : 'day'; A.go('calendar');
    });
  };

  /* ---------------------------------------------------------- editor */
  A.editTask = function (t, defaults) {
    var isNew = !t;
    var x = isNew ? A.newTask(defaults) : A.clone(t);
    var subs = (x.subtasks || []).map(function (s) { return Object.assign({}, s); });
    var ev = x.eventId ? A.byId(A.state.events, x.eventId) : null;
    var body = '<div class="form">' +
      '<div class="row"><button type="button" class="cbox big p' + (x.priority || 0) + (x.status === 'done' ? ' on' : '') + '" id="tf-done" aria-label="Done">' + (x.status === 'done' ? A.icon('check') : '') + '</button>' +
      '<input id="tf-title" class="big-input" placeholder="What needs doing?" value="' + esc(x.title) + '" autofocus></div>' +
      '<div class="grid3">' +
      '<label class="fld"><span>Status</span><select id="tf-status">' + A.f.opt('todo', 'To do', x.status) + A.f.opt('doing', 'In progress', x.status) + A.f.opt('done', 'Done', x.status) + '</select></label>' +
      '<div class="fld"><span>Priority</span><div class="seg prio-seg" id="tf-prio">' + [0, 1, 2, 3].map(function (p) { return '<button type="button" data-p="' + p + '" class="' + ((x.priority || 0) === p ? 'on' : '') + ' p' + p + '">' + ['None', 'Low', 'Med', 'High'][p] + '</button>'; }).join('') + '</div></div>' +
      '<label class="fld"><span>Estimate</span><select id="tf-est">' + A.f.opt('', 'None', x.estimate || '') + [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480].map(function (m) { return A.f.opt(m, D.dur(m), x.estimate || ''); }).join('') + '</select></label>' +
      '</div>' +
      '<div class="grid3">' +
      '<label class="fld"><span>Due date</span><input type="date" id="tf-due" value="' + esc(x.due || '') + '"></label>' +
      '<label class="fld"><span>Due time</span><input type="time" id="tf-time" value="' + esc(x.dueTime || '') + '"></label>' +
      '<label class="fld"><span>Repeat</span><select id="tf-rep">' + A.f.opt('', 'No', x.repeat ? x.repeat.freq : '') + A.f.opt('daily', 'Daily', x.repeat ? x.repeat.freq : '') + A.f.opt('weekly', 'Weekly', x.repeat ? x.repeat.freq : '') + A.f.opt('monthly', 'Monthly', x.repeat ? x.repeat.freq : '') + A.f.opt('yearly', 'Yearly', x.repeat ? x.repeat.freq : '') + '</select></label>' +
      '</div>' +
      '<div class="date-chips">' + [['Today', 0], ['Tomorrow', 1], ['In 2 days', 2], ['Next week', 7], ['No date', null]].map(function (c) { return '<button type="button" class="chip" data-d="' + c[1] + '">' + c[0] + '</button>'; }).join('') + '</div>' +
      '<div class="grid3">' +
      '<label class="fld"><span>Project</span>' + A.f.projectSelect('tf-proj', x.projectId) + '</label>' +
      '<label class="fld"><span>Category</span>' + A.f.catSelect('tf-cat', x.catId) + '</label>' +
      '<label class="fld"><span>Goal</span><select id="tf-goal">' + A.f.opt('', 'None', x.goalId) + A.state.goals.filter(function (g) { return !g.archived; }).map(function (g) { return A.f.opt(g.id, g.title, x.goalId); }).join('') + '</select></label>' +
      '</div>' +
      '<label class="fld"><span>Tags</span><input id="tf-tags" placeholder="reading, deep-work" value="' + esc((x.tags || []).join(', ')) + '"></label>' +
      '<div class="fld"><span>Subtasks</span><div class="subs" id="tf-subs"></div><form class="sub-add" id="tf-subadd"><input id="tf-subin" placeholder="Add a step and press Enter"></form></div>' +
      '<label class="fld"><span>Notes</span><textarea id="tf-notes" rows="3">' + esc(x.notes || '') + '</textarea></label>' +
      '<div class="fld"><span>Time block</span><div class="row wrap" id="tf-sched">' +
      (ev ? '<span class="pill">' + A.icon('clock') + D.fmt(D.parse(ev.start), 'medium') + ' ' + D.time(D.parse(ev.start)) + '–' + D.time(D.parse(ev.end)) + '</span><button type="button" class="btn small" id="tf-unsched">Remove block</button>' :
        '<span class="muted small">Not on the calendar.</span><button type="button" class="btn small" id="tf-find">' + A.icon('wand') + 'Find a slot</button>') +
      '</div><div id="tf-slots" class="date-chips"></div></div>' +
      (x.spent ? '<p class="muted small">' + A.icon('focus') + ' ' + D.dur(x.spent) + ' of focus time logged on this task.</p>' : '') +
      (x.completedAt ? '<p class="muted small">Completed ' + D.fmt(new Date(x.completedAt), 'medium') + '.</p>' : '') +
      '</div>';
    var foot = (isNew ? '' : '<button class="btn danger ghost" id="tf-del">' + A.icon('trash') + 'Delete</button><button class="btn ghost" id="tf-focus">' + A.icon('focus') + 'Focus</button>') +
      '<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="tf-save">' + (isNew ? 'Add task' : 'Save') + '</button>';
    var m = A.modal({ title: isNew ? 'New task' : 'Task', size: 'md', body: body, foot: foot });
    var root = m.root, $ = function (s) { return A.$(s, root); };
    var prio = x.priority || 0, status = x.status;

    function paintSubs() {
      $('#tf-subs').innerHTML = subs.map(function (s, i) {
        return '<div class="sub' + (s.done ? ' done' : '') + '"><button type="button" class="cbox small" data-si="' + i + '">' + (s.done ? A.icon('check') : '') + '</button>' +
          '<input value="' + esc(s.title) + '" data-st="' + i + '" aria-label="Subtask"><button type="button" class="icon-btn subtle" data-sd="' + i + '" aria-label="Remove">' + A.icon('x') + '</button></div>';
      }).join('') + (subs.length ? '<div class="subbar"><i style="width:' + Math.round(subs.filter(function (s) { return s.done; }).length / subs.length * 100) + '%"></i></div>' : '');
      A.$$('[data-si]', root).forEach(function (b) { b.addEventListener('click', function () { var s = subs[+b.getAttribute('data-si')]; s.done = !s.done; paintSubs(); }); });
      A.$$('[data-sd]', root).forEach(function (b) { b.addEventListener('click', function () { subs.splice(+b.getAttribute('data-sd'), 1); paintSubs(); }); });
      A.$$('[data-st]', root).forEach(function (inp) { inp.addEventListener('input', function () { subs[+inp.getAttribute('data-st')].title = inp.value; }); });
    }
    paintSubs();
    $('#tf-subadd').addEventListener('submit', function (e) {
      e.preventDefault(); var v = $('#tf-subin').value.trim(); if (!v) return;
      subs.push({ id: A.uid(), title: v, done: false }); $('#tf-subin').value = ''; paintSubs();
    });
    A.$$('#tf-prio button', root).forEach(function (b) {
      b.addEventListener('click', function () { prio = +b.getAttribute('data-p'); A.$$('#tf-prio button', root).forEach(function (y) { y.classList.toggle('on', y === b); }); $('#tf-done').className = 'cbox big p' + prio + (status === 'done' ? ' on' : ''); });
    });
    $('#tf-done').addEventListener('click', function () { status = status === 'done' ? 'todo' : 'done'; $('#tf-status').value = status; $('#tf-done').classList.toggle('on', status === 'done'); $('#tf-done').innerHTML = status === 'done' ? A.icon('check') : ''; });
    $('#tf-status').addEventListener('change', function (e) { status = e.target.value; $('#tf-done').classList.toggle('on', status === 'done'); $('#tf-done').innerHTML = status === 'done' ? A.icon('check') : ''; });
    A.$$('.date-chips [data-d]', root).forEach(function (b) {
      b.addEventListener('click', function () { var d = b.getAttribute('data-d'); $('#tf-due').value = d === 'null' ? '' : D.key(D.addDays(D.today(), +d)); });
    });

    function collect() {
      var tags = $('#tf-tags').value.split(',').map(function (s) { return s.trim().replace(/^#/, '').toLowerCase(); }).filter(Boolean);
      var rep = $('#tf-rep').value;
      return {
        title: $('#tf-title').value.trim() || 'Untitled task', status: status, priority: prio,
        estimate: +$('#tf-est').value || null, due: $('#tf-due').value, dueTime: $('#tf-due').value ? $('#tf-time').value : '',
        projectId: $('#tf-proj').value, catId: $('#tf-cat').value, goalId: $('#tf-goal').value, tags: tags,
        notes: $('#tf-notes').value, subtasks: subs.filter(function (s) { return s.title.trim(); }),
        repeat: rep ? { freq: rep, interval: 1, byDay: rep === 'weekly' && x.repeat && x.repeat.byDay ? x.repeat.byDay : null } : null
      };
    }
    function save() {
      var v = collect();
      if (isNew) {
        var nt = Object.assign(x, v);
        if (nt.status === 'done') nt.completedAt = new Date().toISOString();
        A.commit('Add task', ['tasks'], function (st) { st.tasks.push(nt); });
        A.toast('Added task: ' + nt.title, { undo: true });
        m.close(); return;
      }
      var becameDone = t.status !== 'done' && v.status === 'done';
      A.commit('Edit task', ['tasks', 'events'], function (st) {
        var y = A.byId(st.tasks, t.id); if (!y) return;
        var doneFlag = v.status; if (becameDone) v.status = 'todo';
        Object.assign(y, v);
        if (doneFlag !== 'done') y.completedAt = null;
        if (y.eventId) { var e = A.byId(st.events, y.eventId); if (e) { e.title = y.title; e.catId = y.catId || e.catId; } }
      });
      m.close();
      if (becameDone) A.toggleTask(A.byId(A.state.tasks, t.id));
      else A.toast('Saved "' + v.title + '"', { undo: true });
    }
    $('#tf-save').addEventListener('click', save);
    $('#tf-title').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    root.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } });
    if (!isNew) {
      $('#tf-del').addEventListener('click', function () { m.close(); A.deleteTask(t); });
      $('#tf-focus').addEventListener('click', function () { m.close(); A.focusOn(t.id); });
    }
    var find = $('#tf-find');
    if (find) find.addEventListener('click', function () {
      var len = +$('#tf-est').value || 30, slots = A.findSlots(len, 10, 6);
      $('#tf-slots').innerHTML = slots.length ? slots.map(function (s, i) { return '<button type="button" class="chip" data-slot="' + i + '">' + D.rel(s) + ' ' + D.time(s) + '</button>'; }).join('') : '<span class="muted small">No free ' + D.dur(len) + ' gap in working hours over the next 10 days.</span>';
      A.$$('[data-slot]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = collect(), target = t || x;
          if (isNew) { Object.assign(x, v); A.commit('Add task', ['tasks'], function (st) { st.tasks.push(x); }); target = x; }
          else { A.commit('Edit task', ['tasks'], function (st) { Object.assign(A.byId(st.tasks, t.id), v); }); target = A.byId(A.state.tasks, t.id); }
          A.scheduleTask(target, slots[+b.getAttribute('data-slot')]);
          m.close();
        });
      });
    });
    var un = $('#tf-unsched');
    if (un) un.addEventListener('click', function () { A.unscheduleTask(t); m.close(); A.toast('Removed the time block', { undo: true }); });
  };

  /* --------------------------------------------------------- projects */
  A.editProject = function (p) {
    var isNew = !p;
    p = p ? A.clone(p) : { id: A.uid(), name: '', color: A.colors[A.state.projects.length % A.colors.length] };
    var m = A.modal({
      title: isNew ? 'New project' : 'Edit project', size: 'sm',
      body: '<div class="form"><label class="fld"><span>Name</span><input id="pf-name" value="' + esc(p.name) + '" autofocus></label><div class="fld"><span>Colour</span>' + A.f.swatches('pf-c', p.color) + '</div></div>',
      foot: (isNew ? '' : '<button class="btn danger ghost" id="pf-del">' + A.icon('trash') + 'Delete</button>') + '<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="pf-save">Save</button>'
    });
    function save() {
      var name = A.$('#pf-name', m.root).value.trim(); if (!name) return;
      var color = (A.$('input[name=pf-c]:checked', m.root) || {}).value || p.color;
      A.commit(isNew ? 'Add project' : 'Edit project', ['projects'], function (st) {
        if (isNew) st.projects.push({ id: p.id, name: name, color: color });
        else Object.assign(A.byId(st.projects, p.id), { name: name, color: color });
      });
      m.close(); if (isNew) { T.list = 'p:' + p.id; A.go('tasks'); }
    }
    A.$('#pf-save', m.root).addEventListener('click', save);
    A.$('#pf-name', m.root).addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
    var del = A.$('#pf-del', m.root);
    if (del) del.addEventListener('click', function () {
      A.confirm('Delete "' + p.name + '"? Its tasks move to the Inbox.', { ok: 'Delete project', danger: true }).then(function (ok) {
        if (!ok) return;
        A.commit('Delete project', ['projects', 'tasks'], function (st) {
          st.projects = st.projects.filter(function (x) { return x.id !== p.id; });
          st.tasks.forEach(function (t) { if (t.projectId === p.id) t.projectId = ''; });
        });
        m.close(); T.list = 'inbox'; A.render(); A.toast('Deleted project', { undo: true });
      });
    });
  };

  /* ---------------------------------------------------------- actions */
  A.actions['task-toggle'] = function (el) { var t = A.byId(A.state.tasks, el.getAttribute('data-id')); if (t) A.toggleTask(t); };
  A.actions['task-open'] = function (el) { var t = A.byId(A.state.tasks, el.getAttribute('data-id')); if (t) A.editTask(t); };
  A.actions['tasks-list'] = function (el) { T.list = el.getAttribute('data-list'); A.remember(); A.render(); };
  A.actions['tasks-layout'] = function (el) { T.layout = el.getAttribute('data-l'); A.remember(); A.render(); };
  A.actions['project-new'] = function () { A.editProject(null); };
  A.actions['project-edit'] = function (el) { A.editProject(A.byId(A.state.projects, el.getAttribute('data-id'))); };
  A.actions['task-more'] = function (el) {
    var t = A.byId(A.state.tasks, el.getAttribute('data-id')); if (!t) return;
    var set = function (patch, label) { return function () { A.commit(label, ['tasks'], function (st) { Object.assign(A.byId(st.tasks, t.id), patch); }); }; };
    A.menu(el, [
      { label: 'Edit', icon: 'edit', fn: function () { A.editTask(t); } },
      { label: t.status === 'doing' ? 'Mark to do' : 'Start (in progress)', icon: 'play', fn: set({ status: t.status === 'doing' ? 'todo' : 'doing' }, 'Update task') },
      { label: 'Focus on this', icon: 'focus', fn: function () { A.focusOn(t.id); } },
      '-',
      { label: 'Due today', icon: 'today', fn: set({ due: D.todayKey() }, 'Reschedule task') },
      { label: 'Due tomorrow', icon: 'calendar', fn: set({ due: D.key(D.addDays(D.today(), 1)) }, 'Reschedule task') },
      { label: 'Due next week', icon: 'calendar', fn: set({ due: D.key(D.addDays(D.startOfWeek(D.today(), A.state.settings.weekStart), 7)) }, 'Reschedule task') },
      { label: 'Remove date', icon: 'x', fn: set({ due: '', dueTime: '' }, 'Reschedule task') },
      '-',
      { label: t.eventId ? 'Remove time block' : 'Find a time slot', icon: 'wand', fn: function () {
        if (t.eventId) { A.unscheduleTask(t); return; }
        var s = A.findSlots(t.estimate || 30, 10, 1)[0];
        if (s) A.scheduleTask(t, s); else A.toast('No free slot in working hours over the next 10 days.');
      } },
      { label: 'Duplicate', icon: 'copy', fn: function () { A.commit('Duplicate task', ['tasks'], function (st) { st.tasks.push(Object.assign(A.clone(t), { id: A.uid(), status: 'todo', completedAt: null, eventId: null, spent: 0 })); }); } },
      { label: 'Delete', icon: 'trash', danger: true, fn: function () { A.deleteTask(t); } }
    ], { alignRight: true });
  };
})();
