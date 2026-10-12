/* Almanac — natural-language quick add.
 *
 *   "Gym tomorrow 6-7:30pm #health every mon,wed,fri"
 *   "Call the bank fri !2 ~15m +errands"
 *   "Dentist 14 oct at 3pm @clinic remind 30m"
 *   "task: read chapter 4 by sunday #study"
 *
 * Returns what it understood plus the leftover text as the title. */
'use strict';
(function () {
  var D = A.D;
  var WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var WDRE = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
  var MONRE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  var MONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var wdIndex = function (s) { return WD.indexOf(s.slice(0, 3).toLowerCase()); };
  var monIndex = function (s) { return MONS.indexOf(s.slice(0, 3).toLowerCase()); };

  /* "5", "5pm", "5:30", "17:30", "noon" -> {h, m, mer} */
  function time(tok) {
    tok = tok.toLowerCase().replace(/\s+/g, '');
    if (tok === 'noon' || tok === 'midday') return { h: 12, m: 0, mer: 'x' };
    if (tok === 'midnight') return { h: 0, m: 0, mer: 'x' };
    var m = /^(\d{1,2})(?:[:.h](\d{2}))?(am|pm|a|p)?$/.exec(tok);
    if (!m) return null;
    var h = +m[1], mi = m[2] ? +m[2] : 0, mer = m[3] ? m[3][0] : '';
    if (h > 24 || mi > 59) return null;
    return { h: h, m: mi, mer: mer, colon: !!m[2] };
  }
  function to24(t, fallbackMer) {
    var h = t.h, mer = t.mer || fallbackMer || '';
    if (mer === 'x') return t.h * 60 + t.m;
    if (mer === 'p' && h < 12) h += 12;
    if (mer === 'a' && h === 12) h = 0;
    if (!mer && h >= 1 && h <= 7 && !t.colon) h += 12; /* "at 5" means 5pm */
    return (h % 24) * 60 + t.m + (h === 24 ? 1440 : 0);
  }

  var TIME = '(noon|midday|midnight|\\d{1,2}(?:[:.h]\\d{2})?\\s?(?:am|pm|a|p)?)';

  A.parseQuick = function (input, now) {
    now = now || new Date();
    var today = D.startOfDay(now);
    var text = ' ' + String(input || '') + ' ';
    var r = { kind: null, title: '', date: null, startMin: null, endMin: null, duration: null, allDay: false,
      recur: null, catId: '', tags: [], projectId: '', priority: 0, estimate: null, location: '', reminders: [], chips: [] };
    function take(re, fn) {
      text = text.replace(re, function () { var res = fn.apply(null, arguments); return res === false ? arguments[0] : ' '; });
    }
    function chip(type, label) { r.chips.push({ type: type, label: label }); }

    /* kind prefix */
    take(/^\s*(task|todo|t)\s*:\s*/i, function () { r.kind = 'task'; });
    take(/^\s*(event|e|ev)\s*:\s*/i, function () { r.kind = 'event'; });

    /* #category or #tag */
    take(/\s#([\w-]+)/g, function (_, w) {
      var c = A.state.categories.filter(function (c) { return c.name.toLowerCase().indexOf(w.toLowerCase()) === 0; })[0];
      if (c && !r.catId) { r.catId = c.id; chip('cat', c.name); }
      else { r.tags.push(w.toLowerCase()); chip('tag', '#' + w); }
    });
    /* +project */
    take(/\s\+([\w-]+)/g, function (_, w) {
      var p = A.state.projects.filter(function (p) { return p.name.toLowerCase().replace(/\s+/g, '-').indexOf(w.toLowerCase()) === 0; })[0];
      if (p) { r.projectId = p.id; chip('project', p.name); }
      else { r._newProject = w.replace(/[-_]/g, ' '); chip('project', 'New project: ' + r._newProject); }
    });
    /* @location */
    take(/\s@([^\s#!+~]+)/g, function (_, w) { r.location = w.replace(/_/g, ' '); chip('loc', r.location); });
    /* priority */
    take(/\s(!{1,3})(?=\s)/g, function (_, b) { r.priority = b.length; });
    take(/\s!(\d|high|hi|med(?:ium)?|low|urgent)\b/gi, function (_, p) {
      p = p.toLowerCase();
      r.priority = /^\d$/.test(p) ? A.clamp(+p, 1, 3) : (p === 'low' ? 1 : /^med/.test(p) ? 2 : 3);
    });
    if (r.priority) chip('prio', ['', 'Low', 'Medium', 'High'][r.priority] + ' priority');

    /* reminders */
    take(/\sremind(?:\s+me)?\s+(\d+)\s*(m|min|mins|minutes|h|hr|hours?)(?:\s+before)?\b/gi, function (_, n, u) {
      var m = /^h/i.test(u) ? +n * 60 : +n; r.reminders.push(m); chip('rem', 'Remind ' + D.dur(m) + ' before');
    });

    /* recurrence */
    var recur = null;
    take(/\s(every\s+day|daily)\b/gi, function () { recur = { freq: 'daily', interval: 1 }; });
    take(/\s(every\s+weekday|weekdays|on\s+weekdays)\b/gi, function () { recur = { freq: 'weekdays', interval: 1 }; });
    take(/\severy\s+(other\s+)?week\b|\sweekly\b/gi, function (_, o) { recur = { freq: 'weekly', interval: o ? 2 : 1 }; });
    take(/\severy\s+(other\s+)?month\b|\smonthly\b/gi, function (_, o) { recur = { freq: 'monthly', interval: o ? 2 : 1 }; });
    take(/\severy\s+year\b|\syearly\b|\sannually\b/gi, function () { recur = { freq: 'yearly', interval: 1 }; });
    take(/\severy\s+(\d+)\s+(day|week|month|year)s?\b/gi, function (_, n, u) { recur = { freq: { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }[u.toLowerCase()], interval: +n }; });
    take(new RegExp('\\severy\\s+(other\\s+)?(' + WDRE + '(?:\\s*(?:,|and|&)\\s*' + WDRE + ')*)', 'gi'), function (_, o, list) {
      var days = list.split(/\s*(?:,|and|&)\s*/i).map(wdIndex).filter(function (d) { return d >= 0; });
      recur = { freq: 'weekly', interval: o ? 2 : 1, byDay: days };
    });
    take(new RegExp('\\suntil\\s+(\\d{1,2})\\s+' + MONRE + '\\b|\\suntil\\s+' + MONRE + '\\s+(\\d{1,2})\\b', 'gi'), function (_, d1, m1, m2, d2) {
      if (!recur) return false;
      var d = new Date(now.getFullYear(), monIndex(m1 || m2), +(d1 || d2)); if (d < today) d.setFullYear(d.getFullYear() + 1);
      recur.until = D.key(d);
    });
    take(/\s(\d+)\s*times\b/gi, function (_, n) { if (!recur) return false; recur.count = +n; });
    if (recur) { r.recur = recur; chip('recur', A.R.describe(recur)); }

    /* durations / estimates */
    take(/\s(?:for\s+|~)(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?)(?:\s*(\d+)\s*(?:m|min|mins)?)?\b/gi, function (_, h, __, m) { r.duration = Math.round(+h * 60) + (+m || 0); });
    take(/\s(?:for\s+|~)(\d+)\s*(m|min|mins|minutes)\b/gi, function (_, m) { r.duration = +m; });

    /* time ranges and times */
    var rangeRe = new RegExp('\\s(?:from\\s+)?' + TIME + '\\s?(?:-|–|to|until|till)\\s?' + TIME + '(?=\\s)', 'i');
    take(rangeRe, function (_, a, b) {
      var t1 = time(a), t2 = time(b); if (!t1 || !t2) return false;
      var mer2 = t2.mer || '', s = to24(t1, t1.mer || (mer2 && mer2 !== 'x' ? mer2 : '')), e = to24(t2, mer2);
      if (!t1.mer && mer2 === 'p' && s > e) s -= 720;
      if (e <= s) e += 720;
      if (e <= s) return false;
      r.startMin = s; r.endMin = e;
    });
    if (r.startMin == null) {
      take(new RegExp('\\s(?:at|@)\\s+' + TIME + '(?=\\s)', 'i'), function (_, a) { var t = time(a); if (!t) return false; r.startMin = to24(t); });
    }
    if (r.startMin == null) {
      take(/\s(noon|midday|midnight|\d{1,2}(?:[:.]\d{2})?\s?(?:am|pm)|\d{1,2}[:.]\d{2})(?=\s)/i, function (_, a) { var t = time(a); if (!t) return false; r.startMin = to24(t); });
    }
    take(/\s(this\s+)?(morning)\b/gi, function () { if (r.startMin == null) r.startMin = 9 * 60; });
    take(/\s(this\s+)?(afternoon)\b/gi, function () { if (r.startMin == null) r.startMin = 14 * 60; });
    take(/\s(this\s+)?(evening)\b/gi, function () { if (r.startMin == null) r.startMin = 18 * 60; });
    take(/\sall[\s-]day\b/gi, function () { r.allDay = true; r.kind = r.kind || 'event'; chip('time', 'All day'); });

    /* dates */
    var date = null;
    take(/\s(?:on\s+|by\s+|due\s+)?today\b/gi, function () { date = today; });
    take(/\s(?:on\s+|by\s+)?tonight\b/gi, function () { date = today; if (r.startMin == null) r.startMin = 20 * 60; });
    take(/\s(?:on\s+|by\s+|due\s+)?(?:the\s+)?day\s+after\s+tomorrow\b/gi, function () { date = D.addDays(today, 2); });
    take(/\s(?:on\s+|by\s+|due\s+)?(tomorrow|tmrw?|tmw)\b/gi, function () { date = D.addDays(today, 1); });
    take(/\s(?:on\s+)?yesterday\b/gi, function () { date = D.addDays(today, -1); });
    take(/\sin\s+(\d+|a|an|one|two|three)\s+(day|week|month)s?\b/gi, function (_, n, u) {
      n = { a: 1, an: 1, one: 1, two: 2, three: 3 }[n.toLowerCase()] || +n;
      date = u.toLowerCase() === 'day' ? D.addDays(today, n) : u.toLowerCase() === 'week' ? D.addDays(today, 7 * n) : D.addMonths(today, n);
    });
    take(/\s(?:by\s+)?next\s+week\b/gi, function () { date = D.addDays(D.startOfWeek(today, A.state.settings.weekStart), 7); });
    take(/\s(?:by\s+)?next\s+month\b/gi, function () { date = new Date(today.getFullYear(), today.getMonth() + 1, 1); });
    take(/\s(?:by\s+)?(?:the\s+)?end\s+of\s+(?:the\s+)?month\b/gi, function () { date = new Date(today.getFullYear(), today.getMonth() + 1, 0); });
    take(/\s(?:by\s+)?(?:this\s+)?weekend\b/gi, function () { date = D.addDays(today, (6 - today.getDay() + 7) % 7); });
    take(new RegExp('\\s(?:on\\s+|by\\s+|due\\s+)?(next\\s+|this\\s+)?' + WDRE + '\\b', 'gi'), function (_, mod, w) {
      var target = wdIndex(w), diff = (target - today.getDay() + 7) % 7;
      if (mod && /next/i.test(mod) && diff === 0) diff = 7;
      date = D.addDays(today, diff);
    });
    take(/\s(?:on\s+|by\s+|due\s+)?(\d{4})-(\d{1,2})-(\d{1,2})\b/g, function (_, y, m, d) { date = new Date(+y, +m - 1, +d); });
    take(new RegExp('\\s(?:on\\s+|by\\s+|due\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MONRE + '\\b(?:\\s+(\\d{4}))?', 'gi'), function (_, d, m, y) {
      date = new Date(y ? +y : now.getFullYear(), monIndex(m), +d); if (!y && date < today) date.setFullYear(date.getFullYear() + 1);
    });
    take(new RegExp('\\s(?:on\\s+|by\\s+|due\\s+)?' + MONRE + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?', 'gi'), function (_, m, d, y) {
      date = new Date(y ? +y : now.getFullYear(), monIndex(m), +d); if (!y && date < today) date.setFullYear(date.getFullYear() + 1);
    });
    take(/\s(?:on\s+|by\s+|due\s+)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, function (_, d, m, y) {
      var yr = y ? (y.length === 2 ? 2000 + +y : +y) : now.getFullYear();
      date = new Date(yr, +m - 1, +d); if (!y && date < today) date.setFullYear(date.getFullYear() + 1);
    });
    take(/\s(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/gi, function (_, d) {
      date = new Date(today.getFullYear(), today.getMonth(), +d); if (date < today) date = D.addMonths(date, 1);
    });

    if (!date && r.recur && r.recur.byDay && r.recur.byDay.length) {
      for (var i = 0; i < 7; i++) { var dd = D.addDays(today, i); if (r.recur.byDay.indexOf(dd.getDay()) >= 0) { date = dd; break; } }
    }
    if (!date && (r.startMin != null || r.recur)) {
      date = today;
      if (r.startMin != null && !r.recur && r.startMin < D.minutesOfDay(now) - 30) date = D.addDays(today, 1);
    }
    r.date = date;

    /* decide the kind */
    if (!r.kind) r.kind = (r.startMin != null || r.allDay) ? 'event' : 'task';
    if (r.kind === 'event') {
      if (r.startMin == null && !r.allDay) r.allDay = true;
      if (r.startMin != null && r.endMin == null) r.endMin = r.startMin + (r.duration || A.state.settings.defaultDuration || 60);
    } else if (r.duration) r.estimate = r.duration;

    if (date) chip('date', D.rel(date) + (D.diffDays(today, date) > 1 && D.diffDays(today, date) < 7 ? ' ' + D.fmt(date, 'short') : ''));
    if (r.startMin != null) {
      var s = D.fromMinutes(date || today, r.startMin), e = r.endMin != null ? D.fromMinutes(date || today, r.endMin) : null;
      chip('time', D.time(s) + (e && r.kind === 'event' ? '–' + D.time(e) : ''));
    }
    if (r.kind === 'task' && r.estimate) chip('est', '~' + D.dur(r.estimate));
    if (r.kind === 'event' && r.duration && r.endMin != null) chip('est', D.dur(r.endMin - r.startMin));

    r.title = text.replace(/\s+/g, ' ').replace(/\s+(at|on|by|from|for|due|in)\s*$/i, '').replace(/^\s*(at|on)\s+/i, '').trim();
    if (r.title) r.title = r.title.charAt(0).toUpperCase() + r.title.slice(1);
    return r;
  };

  /* Turn a parse result into stored records via A.commit. */
  A.applyQuick = function (p) {
    if (!p.title) return null;
    if (p.kind === 'event') {
      var day = p.date || D.today(), ev = {
        id: A.uid(), title: p.title, catId: p.catId, location: p.location, notes: p.tags.length ? p.tags.map(function (t) { return '#' + t; }).join(' ') : '',
        allDay: !!p.allDay, recur: p.recur, exdates: [],
        reminders: p.reminders.length ? p.reminders : (A.state.settings.defaultReminder ? [A.state.settings.defaultReminder] : [])
      };
      if (p.allDay) { ev.start = D.key(day); ev.end = D.key(day); }
      else { ev.start = D.stamp(D.fromMinutes(day, p.startMin)); ev.end = D.stamp(D.fromMinutes(day, p.endMin)); }
      A.commit('Add event', ['events'], function (s) { s.events.push(ev); });
      return { type: 'event', item: ev };
    }
    var kinds = ['tasks'], projectId = p.projectId;
    var t = {
      id: A.uid(), title: p.title, notes: '', status: 'todo', priority: p.priority, due: p.date ? D.key(p.date) : '',
      dueTime: p.startMin != null ? D.hm(D.fromMinutes(D.today(), p.startMin)) : '', projectId: '', tags: p.tags,
      estimate: p.estimate || null, subtasks: [], created: D.todayKey(), completedAt: null, spent: 0,
      repeat: p.recur ? { freq: p.recur.freq === 'weekdays' ? 'weekly' : p.recur.freq, interval: p.recur.interval || 1, byDay: p.recur.freq === 'weekdays' ? [1, 2, 3, 4, 5] : p.recur.byDay } : null,
      catId: p.catId
    };
    if (p._newProject) kinds.push('projects');
    A.commit('Add task', kinds, function (s) {
      if (p._newProject) {
        var np = { id: A.uid(), name: p._newProject.charAt(0).toUpperCase() + p._newProject.slice(1), color: A.colors[s.projects.length % A.colors.length] };
        s.projects.push(np); projectId = np.id;
      }
      t.projectId = projectId || '';
      s.tasks.push(t);
    });
    return { type: 'task', item: t };
  };

  A.colors = ['#3A63E0', '#8A4FD8', '#1F9A5B', '#D9831F', '#D0457A', '#2A9DB0', '#B0533A', '#6B7A72', '#5F6FD6', '#9A8A1E', '#C2410C', '#0E8C7A'];
})();
