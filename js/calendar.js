/* Almanac — calendar: day, 3-day, week, month, agenda, year; drag; event editor. */
'use strict';
(function () {
  var D = A.D, R = A.R, esc = A.esc;
  A.views = A.views || {};
  var cal = A.cal = { mode: 'week', scrollTop: null, tray: false };

  /* ------------------------------------------------------------ helpers */
  function S() { return A.state.settings; }
  function rangeFor(mode, date) {
    var ws = S().weekStart;
    switch (mode) {
      case 'day': return { from: D.startOfDay(date), days: 1 };
      case '3day': return { from: D.startOfDay(date), days: 3 };
      case 'week': return { from: D.startOfWeek(date, ws), days: 7 };
      case 'month': {
        var first = new Date(date.getFullYear(), date.getMonth(), 1);
        return { from: D.startOfWeek(first, ws), days: 42 };
      }
      case 'agenda': return { from: D.startOfDay(date), days: 45 };
      case 'year': return { from: new Date(date.getFullYear(), 0, 1), days: 366 };
    }
  }
  cal.step = function (dir) {
    var d = A.ui.date;
    switch (cal.mode) {
      case 'day': A.ui.date = D.addDays(d, dir); break;
      case '3day': A.ui.date = D.addDays(d, 3 * dir); break;
      case 'week': A.ui.date = D.addDays(d, 7 * dir); break;
      case 'month': A.ui.date = D.addMonths(new Date(d.getFullYear(), d.getMonth(), 1), dir); break;
      case 'agenda': A.ui.date = D.addDays(d, 30 * dir); break;
      case 'year': A.ui.date = new Date(d.getFullYear() + dir, 0, 1); break;
    }
    A.render();
  };
  function titleFor(mode, date) {
    var r = rangeFor(mode, date), end = D.addDays(r.from, r.days - 1);
    if (mode === 'day') return D.fmt(date, 'long');
    if (mode === 'month') return D.fmt(date, 'month');
    if (mode === 'year') return String(date.getFullYear());
    if (mode === 'agenda') return 'From ' + D.fmt(r.from, 'medium');
    if (r.from.getMonth() === end.getMonth()) return D.MONTHS[r.from.getMonth()] + ' ' + r.from.getDate() + '–' + end.getDate() + ', ' + end.getFullYear();
    return D.fmt(r.from, 'short') + ' – ' + D.fmt(end, 'short') + ' ' + end.getFullYear();
  }

  /* Lay out overlapping timed occurrences in side-by-side columns. */
  function layoutDay(occs) {
    var clusters = [], cur = null, curEnd = 0;
    occs.forEach(function (o) {
      if (!cur || o.start >= curEnd) { cur = []; clusters.push(cur); curEnd = 0; }
      cur.push(o); curEnd = Math.max(curEnd, +o.end);
    });
    clusters.forEach(function (cl) {
      var lanes = [];
      cl.forEach(function (o) {
        var lane = 0;
        while (lanes[lane] && lanes[lane] > o.start) lane++;
        lanes[lane] = o.end; o.lane = lane;
      });
      cl.forEach(function (o) { o.lanes = lanes.length; });
    });
    /* let a block stretch right into free lanes */
    occs.forEach(function (o) {
      var span = 1;
      for (var l = o.lane + 1; l < o.lanes; l++) {
        var blocked = occs.some(function (x) { return x !== o && x.lane === l && x.start < o.end && x.end > o.start; });
        if (blocked) break; span++;
      }
      o.span = span;
    });
  }

  function occKey(o) { return o.ev.id + '@' + o.key; }

  /* ------------------------------------------------------ view: header */
  function head() {
    var modes = [['day', 'Day', 'D'], ['3day', '3 days', 'X'], ['week', 'Week', 'W'], ['month', 'Month', 'M'], ['agenda', 'Agenda', 'A'], ['year', 'Year', 'Y']];
    return '<div class="view-head cal-top">' +
      '<div class="vh-left">' +
      '<button class="btn" data-act="cal-today">Today</button>' +
      '<div class="btn-group"><button class="icon-btn" data-act="cal-prev" aria-label="Previous">' + A.icon('left') + '</button>' +
      '<button class="icon-btn" data-act="cal-next" aria-label="Next">' + A.icon('right') + '</button></div>' +
      '<h1 class="vh-title">' + esc(titleFor(cal.mode, A.ui.date)) + '</h1>' +
      (cal.mode === 'week' && S().showWeekNumbers ? '<span class="pill subtle">Week ' + D.isoWeek(D.addDays(rangeFor('week', A.ui.date).from, 3)) + '</span>' : '') +
      '</div><div class="vh-right">' +
      '<div class="seg" role="tablist" aria-label="Calendar view">' + modes.map(function (m) {
        return '<button role="tab" data-act="cal-mode" data-mode="' + m[0] + '" class="' + (cal.mode === m[0] ? 'on' : '') + '" title="' + m[1] + ' (' + m[2] + ')">' + m[1] + '</button>';
      }).join('') + '</div>' +
      '<button class="btn" data-act="cal-plan" title="Fit open tasks into today\'s free time">' + A.icon('wand') + '<span>Plan day</span></button>' +
      '<button class="btn tray-btn' + (cal.tray ? ' on' : '') + '" data-act="cal-tray" title="Drag unscheduled tasks onto the calendar">' + A.icon('tasks') + '<span>Tasks</span></button>' +
      '</div></div>';
  }

  /* ------------------------------------------------------- time grid */
  function timeGrid(from, days) {
    var s = S(), hh = s.hourHeight, h0 = s.dayStart, h1 = s.dayEnd, to = D.addDays(from, days);
    var occs = A.occurrences(from, to), conflicts = A.conflicts(occs);
    var today = D.today(), now = new Date();
    cal.occMap = {};
    occs.forEach(function (o) { cal.occMap[occKey(o)] = o; });

    var cols = [];
    for (var i = 0; i < days; i++) cols.push(D.addDays(from, i));
    var tasksByDay = {};
    A.state.tasks.forEach(function (t) {
      if (!t.due || (t.status === 'done' && !s.showCompleted) || t.eventId) return;
      (tasksByDay[t.due] = tasksByDay[t.due] || []).push(t);
    });

    var html = '<div class="cal cal-' + days + '" style="--hh:' + hh + 'px;--cols:' + days + '"><div class="cal-scroll" id="cal-scroll"><div class="cal-sticky">';
    /* day headers */
    html += '<div class="cal-head"><div class="gut"></div>' + cols.map(function (d) {
      var isT = D.sameDay(d, today), we = d.getDay() === 0 || d.getDay() === 6;
      var dayOccs = occs.filter(function (o) { return !o.ev.allDay && D.sameDay(o.start, d); });
      var load = A.sum(dayOccs, function (o) { return (o.end - o.start) / 60000; });
      return '<button class="cal-dh' + (isT ? ' today' : '') + (we ? ' weekend' : '') + '" data-act="cal-goto-day" data-day="' + D.key(d) + '">' +
        '<span class="wd">' + D.WD[d.getDay()] + '</span><span class="dn">' + d.getDate() + '</span>' +
        (load ? '<span class="load" title="' + D.dur(load) + ' planned"><i style="width:' + Math.min(100, load / 6) + '%"></i></span>' : '') + '</button>';
    }).join('') + '</div>';

    /* all-day row */
    html += '<div class="cal-allday"><div class="gut">all day</div>' + cols.map(function (d) {
      var k = D.key(d);
      var ad = occs.filter(function (o) { return o.ev.allDay && o.start <= d && o.end > d; });
      var tasks = tasksByDay[k] || [];
      return '<div class="cal-adc" data-day="' + k + '">' +
        ad.map(function (o) {
          return '<button class="chip-ev" style="--c:' + A.cat(o.ev.catId).color + '" data-act="cal-open" data-occ="' + esc(occKey(o)) + '">' + esc(o.ev.title) + '</button>';
        }).join('') +
        tasks.map(function (t) {
          return '<div class="chip-task' + (t.status === 'done' ? ' done' : '') + '" draggable="true" data-task="' + t.id + '">' +
            '<button class="cbox" data-act="task-toggle" data-id="' + t.id + '" aria-label="Complete">' + (t.status === 'done' ? A.icon('check') : '') + '</button>' +
            '<button class="ct" data-act="task-open" data-id="' + t.id + '">' + esc(t.title) + '</button></div>';
        }).join('') + '</div>';
    }).join('') + '</div></div>';

    /* the grid */
    var hours = '';
    for (var h = h0; h < h1; h++) hours += '<div class="hr" style="top:' + ((h - h0) * hh) + 'px"><span>' + (h === h0 ? '' : D.hourLabel(h)) + '</span></div>';
    var lines = '';
    for (var h2 = h0; h2 < h1; h2++) {
      lines += '<div class="ln" style="top:' + ((h2 - h0) * hh) + 'px"></div><div class="ln half" style="top:' + ((h2 - h0) * hh + hh / 2) + 'px"></div>';
    }
    html += '<div class="cal-grid" id="cal-grid" style="height:' + ((h1 - h0) * hh) + 'px">' +
      '<div class="gut hours">' + hours + '</div>';
    cols.forEach(function (d) {
      var k = D.key(d), isT = D.sameDay(d, today);
      var timed = occs.filter(function (o) { return !o.ev.allDay && D.sameDay(o.start, d); });
      /* occurrences that started the day before and run past midnight */
      occs.forEach(function (o) { if (!o.ev.allDay && o.start < d && o.end > d && !D.sameDay(o.start, d)) timed.push(Object.assign({}, o, { start: d, cont: true })); });
      timed.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
      layoutDay(timed);
      var work = '';
      if (d.getDay() > 0 && d.getDay() < 6 && s.workEnd > s.workStart) {
        var wt = Math.max(0, (s.workStart - h0) * hh), wb = Math.min((h1 - h0) * hh, (s.workEnd - h0) * hh);
        if (wb > wt) work = '<div class="work" style="top:' + wt + 'px;height:' + (wb - wt) + 'px"></div>';
      }
      html += '<div class="cal-col' + (isT ? ' today' : '') + '" data-day="' + k + '">' + work + lines;
      timed.forEach(function (o) {
        var startMin = (o.start - d) / 60000, endMin = Math.min(1440, (o.end - d) / 60000);
        var top = A.clamp((startMin - h0 * 60) / 60 * hh, 0, (h1 - h0) * hh - 6);
        var bottom = A.clamp((endMin - h0 * 60) / 60 * hh, top + 14, (h1 - h0) * hh);
        var c = A.cat(o.ev.catId), short = bottom - top < 34, ck = conflicts[occKey(o)];
        var w = 100 / o.lanes;
        var task = o.ev.taskId ? A.byId(A.state.tasks, o.ev.taskId) : null;
        html += '<div class="ev' + (short ? ' short' : '') + (ck ? ' clash' : '') + (o.end < now ? ' past' : '') + (task && task.status === 'done' ? ' done' : '') + '" tabindex="0" role="button" ' +
          'style="--c:' + c.color + ';top:' + top + 'px;height:' + (bottom - top - 2) + 'px;left:calc(' + (o.lane * w) + '% + 1px);width:calc(' + (w * o.span) + '% - 3px)" ' +
          'data-occ="' + esc(occKey(o)) + '"' + (o.cont ? ' data-cont="1"' : '') + '>' +
          '<div class="ev-t">' + (task ? '<span class="ev-task">' + (task.status === 'done' ? '✓' : '○') + '</span>' : '') + esc(o.ev.title) + '</div>' +
          '<div class="ev-m">' + D.time(o.start) + '–' + D.time(o.end) + (o.ev.location && !short ? ' · ' + esc(o.ev.location) : '') +
          (o.recurring ? ' <span class="rec" title="' + esc(R.describe(o.ev.recur)) + '">' + A.icon('repeat') + '</span>' : '') +
          (ck ? ' <span class="warn" title="Overlaps another event">overlap</span>' : '') + '</div>' +
          (o.cont ? '' : '<div class="rz" data-rz="1" aria-hidden="true"></div>') + '</div>';
      });
      if (isT) {
        var nm = D.minutesOfDay(now);
        if (nm >= h0 * 60 && nm < h1 * 60) html += '<div class="nowline" id="now-line" style="top:' + ((nm - h0 * 60) / 60 * hh) + 'px"><i></i></div>';
      }
      html += '</div>';
    });
    html += '</div></div></div>';
    return html;
  }

  /* --------------------------------------------------------- month */
  function monthGrid(date) {
    var r = rangeFor('month', date), to = D.addDays(r.from, r.days), today = D.today();
    var occs = A.occurrences(r.from, to), s = S();
    var tasks = {};
    A.state.tasks.forEach(function (t) { if (t.due && t.status !== 'done' && !t.eventId) (tasks[t.due] = tasks[t.due] || []).push(t); });
    var html = '<div class="month' + (s.showWeekNumbers ? ' wk' : '') + '"><div class="month-h">' + (s.showWeekNumbers ? '<span class="wkn"></span>' : '');
    for (var i = 0; i < 7; i++) html += '<span>' + D.WD[(s.weekStart + i) % 7] + '</span>';
    html += '</div><div class="month-g">';
    for (var w = 0; w < 6; w++) {
      if (s.showWeekNumbers) html += '<span class="wkn">' + D.isoWeek(D.addDays(r.from, w * 7 + 3)) + '</span>';
      for (var d = 0; d < 7; d++) {
        var day = D.addDays(r.from, w * 7 + d), k = D.key(day), next = D.addDays(day, 1);
        var list = occs.filter(function (o) { return o.start < next && o.end > day && (o.ev.allDay || D.sameDay(o.start, day)); });
        var tl = tasks[k] || [];
        var max = 3, shown = list.slice(0, max);
        html += '<div class="mc' + (day.getMonth() !== date.getMonth() ? ' out' : '') + (D.sameDay(day, today) ? ' today' : '') + '" data-day="' + k + '">' +
          '<button class="mc-d" data-act="cal-goto-day" data-day="' + k + '">' + day.getDate() + (day.getDate() === 1 ? ' ' + D.MON[day.getMonth()] : '') + '</button>' +
          shown.map(function (o) {
            var c = A.cat(o.ev.catId).color;
            return '<button class="mchip' + (o.ev.allDay ? ' ad' : '') + '" style="--c:' + c + '" draggable="true" data-act="cal-open" data-occ="' + esc(occKey(o)) + '">' +
              (o.ev.allDay ? '' : '<b>' + D.time(o.start) + '</b>') + esc(o.ev.title) + '</button>';
          }).join('') +
          (list.length > max ? '<button class="more" data-act="cal-goto-day" data-day="' + k + '">+' + (list.length - max) + ' more</button>' : '') +
          (tl.length ? '<span class="mtasks" title="' + esc(tl.map(function (t) { return t.title; }).join(', ')) + '">' + A.icon('tasks') + tl.length + '</span>' : '') +
          '</div>';
        list.forEach(function (o) { cal.occMap[occKey(o)] = o; });
      }
    }
    return html + '</div></div>';
  }

  /* -------------------------------------------------------- agenda */
  function agenda(date) {
    var r = rangeFor('agenda', date), to = D.addDays(r.from, r.days);
    var occs = A.occurrences(r.from, to), html = '<div class="agenda">', any = false;
    for (var i = 0; i < r.days; i++) {
      var day = D.addDays(r.from, i), next = D.addDays(day, 1), k = D.key(day);
      var list = occs.filter(function (o) { return o.start < next && o.end > day && (o.ev.allDay || D.sameDay(o.start, day)); });
      var tasks = A.state.tasks.filter(function (t) { return t.due === k && t.status !== 'done' && !t.eventId; });
      if (!list.length && !tasks.length) continue;
      any = true;
      html += '<section class="ag-day' + (D.sameDay(day, D.today()) ? ' today' : '') + '"><button class="ag-date" data-act="cal-goto-day" data-day="' + k + '">' +
        '<span class="dn">' + day.getDate() + '</span><span><b>' + D.WEEKDAYS[day.getDay()] + '</b><small>' + D.fmt(day, 'month') + '</small></span></button><div class="ag-items">';
      list.forEach(function (o) {
        cal.occMap[occKey(o)] = o;
        html += '<button class="ag-i" data-act="cal-open" data-occ="' + esc(occKey(o)) + '" style="--c:' + A.cat(o.ev.catId).color + '">' +
          '<span class="ag-time">' + (o.ev.allDay ? 'All day' : D.time(o.start) + ' – ' + D.time(o.end)) + '</span><i class="dot"></i>' +
          '<span class="ag-t">' + esc(o.ev.title) + (o.ev.location ? '<small>' + A.icon('pin') + esc(o.ev.location) + '</small>' : '') + '</span>' +
          (o.recurring ? A.icon('repeat', 'muted') : '') + '</button>';
      });
      tasks.forEach(function (t) {
        html += '<div class="ag-i task"><span class="ag-time">' + (t.dueTime ? D.time(D.parse(k + 'T' + t.dueTime)) : 'Task') + '</span>' +
          '<button class="cbox" data-act="task-toggle" data-id="' + t.id + '" aria-label="Complete"></button>' +
          '<button class="ag-t linkish" data-act="task-open" data-id="' + t.id + '">' + esc(t.title) + '</button>' + A.prioFlag(t) + '</div>';
      });
      html += '</div></section>';
    }
    if (!any) html += '<div class="empty"><h3>Nothing in the next ' + r.days + ' days</h3><p>Press <kbd>N</kbd> and type something like <code>Dinner with Lea fri 8pm</code>.</p></div>';
    return html + '<div class="ag-more"><button class="btn" data-act="cal-next">Show the following 45 days</button></div></div>';
  }

  /* ---------------------------------------------------------- year */
  function year(date) {
    var y = date.getFullYear(), from = new Date(y, 0, 1), to = new Date(y + 1, 0, 1), today = D.today();
    var load = {};
    A.occurrences(from, to).forEach(function (o) {
      var k = D.key(o.start); load[k] = (load[k] || 0) + (o.ev.allDay ? 120 : (o.end - o.start) / 60000);
    });
    var html = '<div class="year">';
    for (var m = 0; m < 12; m++) {
      var first = new Date(y, m, 1), start = D.startOfWeek(first, S().weekStart);
      html += '<div class="ym"><button class="ym-h" data-act="cal-goto-month" data-day="' + D.key(first) + '">' + D.MONTHS[m] + '</button><div class="ym-g">';
      for (var i = 0; i < 7; i++) html += '<span class="ym-wd">' + D.WD[(S().weekStart + i) % 7][0] + '</span>';
      for (var j = 0; j < 42; j++) {
        var d = D.addDays(start, j), k = D.key(d), l = load[k] || 0;
        if (d.getMonth() !== m) { html += '<span></span>'; continue; }
        var lvl = l === 0 ? 0 : l < 90 ? 1 : l < 240 ? 2 : l < 420 ? 3 : 4;
        html += '<button class="ym-d l' + lvl + (D.sameDay(d, today) ? ' today' : '') + '" data-act="cal-goto-day" data-day="' + k + '" title="' + D.fmt(d, 'medium') + (l ? ' · ' + D.dur(l) + ' planned' : '') + '">' + d.getDate() + '</button>';
      }
      html += '</div></div>';
    }
    return html + '</div><p class="legend">Shading shows how much is planned each day. <span class="ym-d l1"></span><span class="ym-d l2"></span><span class="ym-d l3"></span><span class="ym-d l4"></span></p>';
  }

  /* --------------------------------------------------------- tray */
  function tray() {
    var open = A.state.tasks.filter(function (t) { return t.status !== 'done' && !t.eventId; });
    open.sort(function (a, b) { return (b.priority || 0) - (a.priority || 0) || ((a.due || '9999') < (b.due || '9999') ? -1 : 1); });
    return '<aside class="tray"><header><h3>Unscheduled</h3><span class="muted">Drag onto a time</span></header>' +
      (open.length ? open.map(function (t) {
        return '<div class="tray-i" draggable="true" data-task="' + t.id + '">' + A.prioFlag(t) +
          '<span class="tt">' + esc(t.title) + '</span><small>' + (t.estimate ? D.dur(t.estimate) : '30m') + (t.due ? ' · ' + D.rel(D.parse(t.due)) : '') + '</small></div>';
      }).join('') : '<p class="muted pad">Every open task already has a time.</p>') + '</aside>';
  }

  /* ------------------------------------------------------- render */
  A.views.calendar = function (main) {
    cal.occMap = {};
    var body;
    switch (cal.mode) {
      case 'month': body = monthGrid(A.ui.date); break;
      case 'agenda': body = agenda(A.ui.date); break;
      case 'year': body = year(A.ui.date); break;
      default: { var r = rangeFor(cal.mode, A.ui.date); body = timeGrid(r.from, r.days); }
    }
    var useTray = cal.tray && /day|week/.test(cal.mode);
    main.innerHTML = head() + '<div class="cal-wrap' + (useTray ? ' with-tray' : '') + '">' + body + (useTray ? tray() : '') + '</div>';
    var sc = A.$('#cal-scroll', main);
    if (sc) {
      if (cal.scrollTop == null) {
        var target = Math.max(0, (Math.max(S().dayStart, Math.min(new Date().getHours() - 1, 8)) - S().dayStart) * S().hourHeight);
        if (D.sameDay(A.ui.date, D.today()) || cal.mode !== 'day') target = Math.max(0, (new Date().getHours() - 2 - S().dayStart) * S().hourHeight);
        sc.scrollTop = target;
      } else sc.scrollTop = cal.scrollTop;
      sc.addEventListener('scroll', function () { cal.scrollTop = sc.scrollTop; }, { passive: true });
      bindGrid(main);
    }
    bindDnD(main);
  };

  A.updateNowLine = function () {
    var el = A.$('#now-line'); if (!el) return;
    var s = S(), nm = D.minutesOfDay(new Date());
    el.style.top = ((nm - s.dayStart * 60) / 60 * s.hourHeight) + 'px';
  };

  /* --------------------------------------------- grid pointer drags */
  function bindGrid(main) {
    var grid = A.$('#cal-grid', main); if (!grid) return;
    var s = S(), hh = s.hourHeight, snap = s.snap || 15, drag = null, lastType = 'mouse';

    function colAt(x) {
      var cols = A.$$('.cal-col', grid), best = cols[0], bd = Infinity;
      cols.forEach(function (c) { var r = c.getBoundingClientRect(); var dd = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (dd < bd) { bd = dd; best = c; } });
      return best;
    }
    function minAt(y) {
      var r = grid.getBoundingClientRect();
      var m = (y - r.top) / hh * 60 + s.dayStart * 60;
      return A.clamp(Math.round(m / snap) * snap, s.dayStart * 60, s.dayEnd * 60);
    }
    function px(min) { return (min - s.dayStart * 60) / 60 * hh; }
    function label(a, b) { return D.time(D.fromMinutes(D.today(), a)) + '–' + D.time(D.fromMinutes(D.today(), b)); }

    grid.addEventListener('pointerdown', function (e) {
      lastType = e.pointerType;
      if (e.button !== 0) return;
      var evEl = e.target.closest('.ev'), col = e.target.closest('.cal-col');
      if (!col) return;
      if (e.pointerType === 'touch' && !evEl) return; /* let touch scroll; tap handled by click */
      if (evEl) {
        var o = cal.occMap[evEl.getAttribute('data-occ')]; if (!o) return;
        if (evEl.hasAttribute('data-cont')) return;
        if (e.pointerType === 'touch') return; /* tap opens the editor */
        var sm = D.minutesOfDay(o.start), dur = (o.end - o.start) / 60000;
        drag = { type: e.target.hasAttribute('data-rz') ? 'resize' : 'move', el: evEl, occ: o, startMin: sm, dur: dur,
          grab: minAt(e.clientY) - sm, x0: e.clientX, y0: e.clientY, moved: false, col: col, day: col.getAttribute('data-day') };
      } else {
        var m0 = minAt(e.clientY);
        drag = { type: 'create', col: col, day: col.getAttribute('data-day'), a: m0, b: m0 + snap, x0: e.clientX, y0: e.clientY, moved: false };
      }
      grid.setPointerCapture(e.pointerId);
    });
    grid.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        if (drag.type === 'create') {
          drag.ghost = A.el('<div class="ev ghost"><div class="ev-t">New event</div><div class="ev-m"></div></div>');
          drag.col.appendChild(drag.ghost);
        } else drag.el.classList.add('dragging');
        document.body.classList.add('is-dragging');
      }
      var m = minAt(e.clientY);
      if (drag.type === 'create') {
        var a = Math.min(drag.a, m), b = Math.max(drag.a + snap, m);
        if (m < drag.a) { a = m; b = drag.a + snap; }
        drag.ns = a; drag.ne = b;
        drag.ghost.style.top = px(a) + 'px'; drag.ghost.style.height = (px(b) - px(a) - 2) + 'px';
        A.$('.ev-m', drag.ghost).textContent = label(a, b);
      } else if (drag.type === 'move') {
        var col = colAt(e.clientX);
        var ns = A.clamp(m - drag.grab, s.dayStart * 60, s.dayEnd * 60 - snap);
        ns = Math.round(ns / snap) * snap;
        drag.ns = ns; drag.ne = ns + drag.dur; drag.day = col.getAttribute('data-day');
        if (drag.el.parentNode !== col) col.appendChild(drag.el);
        drag.el.style.left = '1px'; drag.el.style.width = 'calc(100% - 3px)';
        drag.el.style.top = px(ns) + 'px';
        A.$('.ev-m', drag.el).textContent = label(ns, ns + drag.dur);
      } else {
        var ne = Math.max(drag.startMin + snap, m);
        drag.ne = ne;
        drag.el.style.height = (px(ne) - px(drag.startMin) - 2) + 'px';
        A.$('.ev-m', drag.el).textContent = label(drag.startMin, ne);
      }
    });
    function end(e) {
      if (!drag) return;
      var d = drag; drag = null;
      document.body.classList.remove('is-dragging');
      try { grid.releasePointerCapture(e.pointerId); } catch (x) {}
      if (e.type === 'pointercancel') { A.render(); return; }
      if (!d.moved) {
        if (d.type === 'create') {
          var day = D.parse(d.day), st = D.fromMinutes(day, d.a);
          A.editEvent(null, null, { start: st, end: D.addMin(st, S().defaultDuration) });
        } else A.editEvent(d.occ.ev, d.occ);
        return;
      }
      if (d.type === 'create') {
        if (d.ghost) d.ghost.remove();
        var dd = D.parse(d.day);
        A.editEvent(null, null, { start: D.fromMinutes(dd, d.ns), end: D.fromMinutes(dd, d.ne) });
      } else if (d.type === 'move') {
        var nd = D.parse(d.day);
        var ns = D.fromMinutes(nd, d.ns), ne = D.addMin(ns, d.dur);
        if (+ns === +d.occ.start) { A.render(); return; }
        A.moveOccurrence(d.occ, ns, ne);
      } else {
        var ne2 = D.fromMinutes(D.startOfDay(d.occ.start), d.ne);
        if (+ne2 === +d.occ.end) { A.render(); return; }
        A.moveOccurrence(d.occ, d.occ.start, ne2);
      }
    }
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);
    /* touch tap on an event / empty slot */
    grid.addEventListener('click', function (e) {
      if (lastType !== 'touch') return; /* mouse and pen are handled on pointerup */
      var evEl = e.target.closest('.ev');
      if (evEl) { var o = cal.occMap[evEl.getAttribute('data-occ')]; if (o) A.editEvent(o.ev, o); return; }
      var col = e.target.closest('.cal-col');
      if (col) {
        var st = D.fromMinutes(D.parse(col.getAttribute('data-day')), minAt(e.clientY));
        A.editEvent(null, null, { start: st, end: D.addMin(st, S().defaultDuration) });
      }
    });
    grid.addEventListener('keydown', function (e) {
      var evEl = e.target.closest('.ev');
      if (evEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var o = cal.occMap[evEl.getAttribute('data-occ')]; if (o) A.editEvent(o.ev, o); }
      if (evEl && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); var o2 = cal.occMap[evEl.getAttribute('data-occ')]; if (o2) A.deleteOccurrence(o2); }
    });
  }

  /* HTML5 drag-and-drop: tasks onto the grid, month chips between days. */
  function bindDnD(main) {
    A.$$('[data-task][draggable]', main).forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/x-task', el.getAttribute('data-task')); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('is-dragging'); });
      el.addEventListener('dragend', function () { document.body.classList.remove('is-dragging'); });
    });
    A.$$('.mchip[draggable]', main).forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/x-occ', el.getAttribute('data-occ')); e.dataTransfer.effectAllowed = 'move'; });
    });
    var s = S();
    A.$$('.cal-col, .cal-adc, .mc', main).forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        var types = Array.prototype.slice.call(e.dataTransfer.types || []);
        if (types.indexOf('text/x-task') < 0 && types.indexOf('text/x-occ') < 0) return;
        e.preventDefault(); col.classList.add('drop');
      });
      col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
      col.addEventListener('drop', function (e) {
        col.classList.remove('drop');
        var day = D.parse(col.getAttribute('data-day'));
        var tid = e.dataTransfer.getData('text/x-task'), okey = e.dataTransfer.getData('text/x-occ');
        e.preventDefault();
        if (tid) {
          var t = A.byId(A.state.tasks, tid); if (!t) return;
          if (col.classList.contains('cal-col')) {
            var r = A.$('#cal-grid', main).getBoundingClientRect();
            var m = Math.round(((e.clientY - r.top) / s.hourHeight * 60 + s.dayStart * 60) / s.snap) * s.snap;
            A.scheduleTask(t, D.fromMinutes(day, m));
          } else {
            A.commit('Move task', ['tasks'], function () { t.due = D.key(day); });
            A.toast('Moved "' + t.title + '" to ' + D.rel(day), { undo: true });
          }
        } else if (okey && cal.occMap[okey]) {
          var o = cal.occMap[okey], delta = D.diffDays(D.startOfDay(o.start), day);
          if (!delta) return;
          A.moveOccurrence(o, D.addDays(o.start, delta), D.addDays(o.end, delta));
        }
      });
    });
  }

  /* -------------------------------------- edit helpers with scope */
  function askScope(verb) {
    return A.choose(verb + ' a repeating event', [
      { label: 'Only this one', value: 'one', desc: 'The rest of the series stays as it is.' },
      { label: 'This and following', value: 'following', desc: 'Splits the series from this date on.' },
      { label: 'Every occurrence', value: 'all', desc: 'Changes the whole series.' }
    ]);
  }
  /* Apply `patch` (fields, plus start/end as Dates) to an occurrence. */
  function applyScoped(o, patch, scope, label) {
    var ev = o.ev;
    A.commit(label, ['events'], function (st) {
      var series = A.byId(st.events, ev.id); if (!series) return;
      var fields = Object.assign({}, patch); delete fields.start; delete fields.end;
      var ns = patch.start || o.start, ne = patch.end || o.end;
      if (!series.recur || !series.recur.freq || scope === 'all') {
        if (series.recur && series.recur.freq) {
          /* shift the whole series by the same delta */
          var sStart = D.parse(series.start), dStart = ns - o.start, dayDelta = D.diffDays(D.startOfDay(o.start), D.startOfDay(ns));
          var newStart = new Date(+sStart + dStart), len = ne - ns;
          series.start = D.stamp(newStart); series.end = D.stamp(new Date(+newStart + len));
          if (series.allDay) { series.start = D.key(newStart); series.end = D.key(D.addDays(newStart, Math.max(0, Math.round(len / D.DAY) - 1))); }
          if (dayDelta && series.recur.byDay) series.recur.byDay = series.recur.byDay.map(function (d) { return ((d + dayDelta) % 7 + 7) % 7; });
          if (dayDelta && series.exdates) series.exdates = series.exdates.map(function (x) { return D.key(D.addDays(D.parse(x), dayDelta)); });
        } else {
          if (series.allDay) { series.start = D.key(ns); series.end = D.key(D.addDays(ne, -1) < ns ? ns : D.addDays(ne, -1)); }
          else { series.start = D.stamp(ns); series.end = D.stamp(ne); }
        }
        Object.assign(series, fields);
        return;
      }
      var copy = A.clone(series);
      copy.id = A.uid();
      Object.assign(copy, fields);
      if (copy.allDay) { copy.start = D.key(ns); copy.end = D.key(D.addDays(ne, -1) < ns ? ns : D.addDays(ne, -1)); }
      else { copy.start = D.stamp(ns); copy.end = D.stamp(ne); }
      if (scope === 'one') {
        series.exdates = (series.exdates || []).concat([o.key]);
        delete copy.recur; copy.exdates = []; copy.seriesId = series.id;
        st.events.push(copy);
      } else {
        if (o.key === D.key(D.parse(series.start))) { /* first occurrence: same as all */
          Object.assign(series, fields); series.start = copy.start; series.end = copy.end; return;
        }
        if (series.recur.count) {
          var before = R.expand(series, D.parse(series.start), D.startOfDay(o.start)).length;
          copy.recur.count = Math.max(1, series.recur.count - before); series.recur.count = before;
        } else series.recur.until = D.key(D.addDays(D.startOfDay(o.start), -1));
        copy.exdates = (series.exdates || []).filter(function (x) { return x >= o.key; });
        series.exdates = (series.exdates || []).filter(function (x) { return x < o.key; });
        if (copy.recur.byDay && D.diffDays(D.startOfDay(o.start), D.startOfDay(ns))) {
          var dd = D.diffDays(D.startOfDay(o.start), D.startOfDay(ns));
          copy.recur.byDay = copy.recur.byDay.map(function (d) { return ((d + dd) % 7 + 7) % 7; });
        }
        st.events.push(copy);
      }
    });
  }

  A.moveOccurrence = function (o, ns, ne) {
    var go = function (scope) {
      if (!scope) { A.render(); return; }
      applyScoped(o, { start: ns, end: ne }, scope, 'Move event');
      A.toast('Moved "' + o.ev.title + '" to ' + D.rel(ns) + (o.ev.allDay ? '' : ' ' + D.time(ns)), { undo: true });
    };
    if (o.recurring) askScope('Move').then(go); else go('all');
  };

  A.deleteOccurrence = function (o, after) {
    var ev = o.ev;
    var go = function (scope) {
      if (!scope) return;
      A.commit('Delete event', ['events', 'tasks'], function (st) {
        var series = A.byId(st.events, ev.id); if (!series) return;
        if (scope === 'one') series.exdates = (series.exdates || []).concat([o.key]);
        else if (scope === 'following' && o.key !== D.key(D.parse(series.start))) {
          if (series.recur.count) series.recur.count = R.expand(series, D.parse(series.start), D.startOfDay(o.start)).length;
          else series.recur.until = D.key(D.addDays(D.startOfDay(o.start), -1));
        } else {
          st.events = st.events.filter(function (x) { return x.id !== ev.id; });
          st.tasks.forEach(function (t) { if (t.eventId === ev.id) t.eventId = null; });
        }
      });
      A.toast('Deleted "' + ev.title + '"', { undo: true });
      if (after) after();
    };
    if (o && o.recurring) askScope('Delete').then(go); else go('all');
  };

  /* ------------------------------------------------------ event editor */
  var REMINDERS = [[0, 'At start'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 hour'], [120, '2 hours'], [1440, '1 day'], [2880, '2 days']];

  A.editEvent = function (ev, occ, defaults) {
    var isNew = !ev;
    defaults = defaults || {};
    var s = S();
    var base = ev ? A.clone(ev) : {
      id: A.uid(), title: defaults.title || '', catId: defaults.catId || '', location: '', notes: '', allDay: !!defaults.allDay,
      reminders: s.defaultReminder ? [s.defaultReminder] : [], exdates: [], recur: null, taskId: defaults.taskId || null
    };
    var st = occ ? occ.start : defaults.start || D.fromMinutes(A.ui.date || D.today(), Math.max(s.workStart, Math.min(new Date().getHours() + 1, 20)) * 60);
    var en = occ ? occ.end : defaults.end || D.addMin(st, s.defaultDuration);
    if (base.allDay && !occ && ev) { st = D.parse(ev.start); en = D.addDays(D.parse(ev.end || ev.start), 1); }
    if (base.allDay && defaults.allDay && !ev) { st = D.startOfDay(st); en = D.addDays(st, 1); }
    var r = base.recur || {};
    var rsel = !r.freq ? '' : r.freq === 'weekly' && (r.interval || 1) === 1 && (!r.byDay || r.byDay.length <= 1) ? 'weekly' :
      (r.interval || 1) === 1 && !r.byDay && r.freq !== 'weekly' && !r.until && !r.count && r.monthMode !== 'nth' ? r.freq : 'custom';
    if (r.freq === 'weekdays') rsel = 'weekdays';
    var nth = Math.ceil(st.getDate() / 7);
    var linkedTask = base.taskId ? A.byId(A.state.tasks, base.taskId) : null;

    var body =
      '<div class="form ev-form">' +
      '<input id="ef-title" class="big-input" placeholder="Event title" value="' + esc(base.title) + '" autofocus>' +
      '<div class="row wrap">' +
      '<label class="toggle"><input type="checkbox" id="ef-allday"' + (base.allDay ? ' checked' : '') + '><span>All day</span></label>' +
      '<span class="muted" id="ef-dur"></span></div>' +
      '<div class="grid2">' +
      '<label class="fld"><span>Starts</span><div class="row"><input type="date" id="ef-sd" value="' + D.key(st) + '"><input type="time" id="ef-st" step="300" value="' + D.hm(st) + '"></div></label>' +
      '<label class="fld"><span>Ends</span><div class="row"><input type="date" id="ef-ed" value="' + D.key(base.allDay ? D.addDays(en, -1) : en) + '"><input type="time" id="ef-et" step="300" value="' + D.hm(en) + '"></div></label>' +
      '</div>' +
      '<div class="quick-durs" id="ef-qd">' + [15, 30, 45, 60, 90, 120, 180].map(function (m) { return '<button type="button" class="chip" data-m="' + m + '">' + D.dur(m) + '</button>'; }).join('') + '</div>' +
      '<div class="warnbox" id="ef-clash" hidden></div>' +
      '<div class="fld"><span>Category</span><div class="cat-pick" id="ef-cat">' +
      '<button type="button" class="cp' + (!base.catId ? ' on' : '') + '" data-c="" style="--c:var(--muted)">None</button>' +
      A.state.categories.map(function (c) { return '<button type="button" class="cp' + (c.id === base.catId ? ' on' : '') + '" data-c="' + c.id + '" style="--c:' + c.color + '">' + esc(c.name) + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="grid2">' +
      '<label class="fld"><span>Repeat</span><select id="ef-rep">' +
      A.f.opt('', 'Does not repeat', rsel) + A.f.opt('daily', 'Every day', rsel) + A.f.opt('weekdays', 'Every weekday (Mon–Fri)', rsel) +
      A.f.opt('weekly', 'Every week on ' + D.WEEKDAYS[st.getDay()], rsel) + A.f.opt('monthly', 'Every month on the ' + D.nth(st.getDate()), rsel) +
      A.f.opt('yearly', 'Every year on ' + D.fmt(st, 'short'), rsel) + A.f.opt('custom', 'Custom…', rsel) + '</select></label>' +
      '<label class="fld"><span>Location</span><input id="ef-loc" placeholder="Room 204, Zoom, gym…" value="' + esc(base.location || '') + '"></label>' +
      '</div>' +
      '<div class="custom-rep" id="ef-custom"' + (rsel === 'custom' ? '' : ' hidden') + '>' +
      '<div class="row wrap"><span>Every</span><input type="number" id="ef-iv" min="1" max="99" value="' + (r.interval || 1) + '" class="num">' +
      '<select id="ef-freq">' + A.f.opt('daily', 'day(s)', r.freq || 'weekly') + A.f.opt('weekly', 'week(s)', r.freq || 'weekly') + A.f.opt('monthly', 'month(s)', r.freq) + A.f.opt('yearly', 'year(s)', r.freq) + '</select></div>' +
      '<div class="daypick" id="ef-days">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        var on = r.byDay ? r.byDay.indexOf(d) >= 0 : d === st.getDay();
        return '<button type="button" class="' + (on ? 'on' : '') + '" data-d="' + d + '">' + D.WD[d].slice(0, 2) + '</button>';
      }).join('') + '</div>' +
      '<div class="row wrap" id="ef-mm"><label class="radio"><input type="radio" name="ef-mm" value="date"' + (r.monthMode !== 'nth' ? ' checked' : '') + '> On day ' + st.getDate() + '</label>' +
      '<label class="radio"><input type="radio" name="ef-mm" value="nth"' + (r.monthMode === 'nth' ? ' checked' : '') + '> On the ' + (nth >= 5 ? 'last' : D.nth(nth)) + ' ' + D.WEEKDAYS[st.getDay()] + '</label></div>' +
      '<div class="row wrap"><span>Ends</span><select id="ef-endmode">' + A.f.opt('never', 'Never', r.until ? 'until' : r.count ? 'count' : 'never') + A.f.opt('until', 'On date', r.until ? 'until' : '') + A.f.opt('count', 'After', r.count ? 'count' : '') + '</select>' +
      '<input type="date" id="ef-until" value="' + esc(r.until || D.key(D.addMonths(st, 3))) + '"><input type="number" id="ef-count" class="num" min="1" max="999" value="' + (r.count || 10) + '"><span id="ef-count-l">times</span></div>' +
      '</div>' +
      '<div class="fld"><span>Reminders</span><div class="rem-list" id="ef-rem"></div></div>' +
      '<label class="fld"><span>Notes</span><textarea id="ef-notes" rows="3" placeholder="Agenda, links, what to bring…">' + esc(base.notes || '') + '</textarea></label>' +
      (linkedTask ? '<div class="linked">' + A.icon('tasks') + ' Time block for task <button class="link" data-act="task-open" data-id="' + linkedTask.id + '">' + esc(linkedTask.title) + '</button></div>' : '') +
      (occ && occ.recurring ? '<p class="muted small">' + A.icon('repeat') + ' ' + esc(R.describe(ev.recur)) + '. You will be asked which occurrences to change.</p>' : '') +
      '</div>';

    var foot = (isNew ? '' : '<button class="btn danger ghost" id="ef-del">' + A.icon('trash') + 'Delete</button><button class="btn ghost" id="ef-dup">' + A.icon('copy') + 'Duplicate</button>') +
      '<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="ef-save">' + (isNew ? 'Add event' : 'Save') + '</button>';

    var m = A.modal({ title: isNew ? 'New event' : 'Edit event', size: 'md', body: body, foot: foot });
    var root = m.root, $ = function (s) { return A.$(s, root); };
    var reminders = (base.reminders || []).slice();
    var catId = base.catId || '';

    function readTimes() {
      var allDay = $('#ef-allday').checked;
      var sd = D.parse($('#ef-sd').value), ed = D.parse($('#ef-ed').value) || sd;
      if (!sd) return null;
      if (allDay) return { allDay: true, start: sd, end: D.addDays(ed < sd ? sd : ed, 1) };
      var stt = ($('#ef-st').value || '09:00').split(':'), ett = ($('#ef-et').value || '10:00').split(':');
      var a = new Date(sd); a.setHours(+stt[0], +stt[1]);
      var b = new Date(ed); b.setHours(+ett[0], +ett[1]);
      if (b <= a) b = D.addMin(a, 30);
      return { allDay: false, start: a, end: b };
    }
    function refresh() {
      var allDay = $('#ef-allday').checked;
      $('#ef-st').hidden = allDay; $('#ef-et').hidden = allDay; $('#ef-qd').hidden = allDay;
      var t = readTimes(); if (!t) return;
      $('#ef-dur').textContent = allDay ? Math.round((t.end - t.start) / D.DAY) + ' day(s)' : D.dur((t.end - t.start) / 60000);
      var rep = $('#ef-rep').value;
      $('#ef-custom').hidden = rep !== 'custom';
      var freq = $('#ef-freq').value;
      $('#ef-days').hidden = freq !== 'weekly'; $('#ef-mm').hidden = freq !== 'monthly';
      var em = $('#ef-endmode').value;
      $('#ef-until').hidden = em !== 'until'; $('#ef-count').hidden = em !== 'count'; $('#ef-count-l').hidden = em !== 'count';
      /* overlap warning */
      if (!allDay) {
        var clash = A.occurrences(D.startOfDay(t.start), D.addDays(D.startOfDay(t.start), 1), { all: true }).filter(function (o) {
          return !o.ev.allDay && o.ev.id !== base.id && o.start < t.end && o.end > t.start;
        });
        var box = $('#ef-clash');
        box.hidden = !clash.length;
        if (clash.length) box.innerHTML = A.icon('clock') + ' Overlaps ' + clash.map(function (o) { return '<b>' + esc(o.ev.title) + '</b> (' + D.time(o.start) + '–' + D.time(o.end) + ')'; }).join(', ');
      } else $('#ef-clash').hidden = true;
    }
    function paintRem() {
      $('#ef-rem').innerHTML = reminders.sort(function (a, b) { return a - b; }).map(function (mn, i) {
        var lab = (REMINDERS.filter(function (x) { return x[0] === mn; })[0] || [0, D.dur(mn)])[1];
        return '<span class="chip">' + A.icon('bell') + esc(lab) + (mn ? ' before' : '') + '<button type="button" data-ri="' + i + '" aria-label="Remove">' + A.icon('x') + '</button></span>';
      }).join('') + '<select id="ef-addrem"><option value="">+ Add reminder</option>' + REMINDERS.map(function (x) { return A.f.opt(x[0], x[1] + (x[0] ? ' before' : ''), ''); }).join('') + '</select>';
      A.$$('[data-ri]', $('#ef-rem')).forEach(function (b) { b.addEventListener('click', function () { reminders.splice(+b.getAttribute('data-ri'), 1); paintRem(); }); });
      $('#ef-addrem').addEventListener('change', function (e) { var v = e.target.value; if (v !== '' && reminders.indexOf(+v) < 0) reminders.push(+v); paintRem(); });
    }
    paintRem();
    ['#ef-allday', '#ef-sd', '#ef-st', '#ef-ed', '#ef-et', '#ef-rep', '#ef-freq', '#ef-endmode'].forEach(function (sel) { $(sel).addEventListener('change', refresh); $(sel).addEventListener('input', refresh); });
    /* keep end after start when the start moves */
    var lastStart = readTimes();
    function shiftEnd() {
      var t = readTimes(); if (!t || !lastStart) { lastStart = t; return; }
      var len = lastStart.end - lastStart.start, ne = new Date(+t.start + len);
      $('#ef-ed').value = D.key(t.allDay ? D.addDays(ne, -1) : ne); $('#ef-et').value = D.hm(ne);
      lastStart = readTimes(); refresh();
    }
    $('#ef-sd').addEventListener('change', shiftEnd); $('#ef-st').addEventListener('change', shiftEnd);
    ['#ef-ed', '#ef-et'].forEach(function (sel) { $(sel).addEventListener('change', function () { lastStart = readTimes(); }); });
    A.$$('#ef-qd [data-m]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = readTimes(), ne = D.addMin(t.start, +b.getAttribute('data-m'));
        $('#ef-ed').value = D.key(ne); $('#ef-et').value = D.hm(ne); lastStart = readTimes(); refresh();
      });
    });
    A.$$('#ef-cat .cp', root).forEach(function (b) {
      b.addEventListener('click', function () { catId = b.getAttribute('data-c'); A.$$('#ef-cat .cp', root).forEach(function (x) { x.classList.toggle('on', x === b); }); });
    });
    A.$$('#ef-days button', root).forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); }); });
    refresh();

    function collect() {
      var t = readTimes(); if (!t) return null;
      var rep = $('#ef-rep').value, recur = null, sd = t.start;
      if (rep === 'daily' || rep === 'monthly' || rep === 'yearly' || rep === 'weekdays') recur = { freq: rep, interval: 1 };
      if (rep === 'weekly') recur = { freq: 'weekly', interval: 1, byDay: [sd.getDay()] };
      if (rep === 'custom') {
        var f = $('#ef-freq').value;
        recur = { freq: f, interval: Math.max(1, +$('#ef-iv').value || 1) };
        if (f === 'weekly') { recur.byDay = A.$$('#ef-days .on', root).map(function (b) { return +b.getAttribute('data-d'); }); if (!recur.byDay.length) recur.byDay = [sd.getDay()]; }
        if (f === 'monthly' && (A.$('input[name=ef-mm]:checked', root) || {}).value === 'nth') recur.monthMode = 'nth';
        var em = $('#ef-endmode').value;
        if (em === 'until') recur.until = $('#ef-until').value;
        if (em === 'count') recur.count = Math.max(1, +$('#ef-count').value || 1);
      }
      if (recur && recur.until && recur.until < D.key(sd)) recur.until = D.key(sd);
      return {
        title: $('#ef-title').value.trim() || 'Untitled', allDay: t.allDay, start: t.start, end: t.end, catId: catId,
        location: $('#ef-loc').value.trim(), notes: $('#ef-notes').value, reminders: reminders.slice(), recur: recur
      };
    }

    function save() {
      var v = collect(); if (!v) return;
      if (isNew) {
        var ne = Object.assign(base, v);
        ne.start = v.allDay ? D.key(v.start) : D.stamp(v.start);
        ne.end = v.allDay ? D.key(D.addDays(v.end, -1)) : D.stamp(v.end);
        A.commit('Add event', ['events', 'tasks'], function (st) {
          st.events.push(ne);
          if (ne.taskId) { var tk = A.byId(st.tasks, ne.taskId); if (tk) tk.eventId = ne.id; }
        });
        m.close();
        A.toast('Added "' + ne.title + '" · ' + D.rel(v.start) + (v.allDay ? '' : ' ' + D.time(v.start)), { undo: true });
        return;
      }
      var patch = { title: v.title, allDay: v.allDay, catId: v.catId, location: v.location, notes: v.notes, reminders: v.reminders, start: v.start, end: v.end };
      var recurChanged = JSON.stringify(v.recur || null) !== JSON.stringify(ev.recur || null);
      if (occ && occ.recurring) {
        A.choose('Save a repeating event', [
          { label: 'Only this one', value: 'one', desc: 'Edits just ' + D.fmt(occ.start, 'medium') + '.' },
          { label: 'This and following', value: 'following', desc: 'Splits the series here.' },
          { label: 'Every occurrence', value: 'all', desc: 'Changes the whole series.' }
        ]).then(function (scope) {
          if (!scope) return;
          if (recurChanged && scope !== 'one') patch.recur = v.recur;
          applyScoped(occ, patch, scope, 'Edit event');
          m.close(); A.toast('Saved "' + v.title + '"', { undo: true });
        });
        return;
      }
      patch.recur = v.recur;
      if (v.recur && !ev.recur) patch.exdates = [];
      applyScoped(occ || { ev: ev, start: D.parse(ev.start), end: D.parse(ev.end), key: D.key(D.parse(ev.start)), recurring: false }, patch, 'all', 'Edit event');
      m.close(); A.toast('Saved "' + v.title + '"', { undo: true });
    }
    $('#ef-save').addEventListener('click', save);
    root.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } });
    $('#ef-title').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    if (!isNew) {
      $('#ef-del').addEventListener('click', function () {
        var o = occ || { ev: ev, start: D.parse(ev.start), end: D.parse(ev.end), key: D.key(D.parse(ev.start)), recurring: false };
        A.deleteOccurrence(o, function () { m.close(); });
      });
      $('#ef-dup').addEventListener('click', function () {
        var v = collect(); m.close();
        var copy = Object.assign(A.clone(ev), { id: A.uid(), title: v.title + ' (copy)', exdates: [], recur: v.recur });
        copy.start = v.allDay ? D.key(v.start) : D.stamp(v.start); copy.end = v.allDay ? D.key(D.addDays(v.end, -1)) : D.stamp(v.end);
        A.commit('Duplicate event', ['events'], function (st) { st.events.push(copy); });
        A.toast('Duplicated "' + ev.title + '"', { undo: true });
        A.editEvent(copy, null);
      });
    }
  };

  /* ------------------------------------------------------- actions */
  A.actions['cal-today'] = function () { A.ui.date = D.today(); cal.scrollTop = null; A.render(); };
  A.actions['cal-prev'] = function () { cal.step(-1); };
  A.actions['cal-next'] = function () { cal.step(1); };
  A.actions['cal-mode'] = function (el) { cal.mode = el.getAttribute('data-mode'); A.remember(); A.render(); };
  A.actions['cal-goto-day'] = function (el) { A.ui.date = D.parse(el.getAttribute('data-day')); cal.mode = 'day'; A.go('calendar'); };
  A.actions['cal-goto-month'] = function (el) { A.ui.date = D.parse(el.getAttribute('data-day')); cal.mode = 'month'; A.render(); };
  A.actions['cal-open'] = function (el) { var o = cal.occMap[el.getAttribute('data-occ')]; if (o) A.editEvent(o.ev, o); };
  A.actions['cal-tray'] = function () { cal.tray = !cal.tray; if (cal.tray && !/day|week/.test(cal.mode)) cal.mode = 'week'; A.render(); };
  A.actions['cal-plan'] = function () { A.autoSchedule(cal.mode === 'day' ? A.ui.date : D.today()); };
})();
