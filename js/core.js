/* Almanac — core: dates, ids, store, undo, persistence, recurrence, ICS. */
'use strict';
var A = window.A = window.A || {};

/* ------------------------------------------------------------------ utils */
A.uid = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};
A.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
A.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};
A.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
A.pad = function (n) { return (n < 10 ? '0' : '') + n; };
A.debounce = function (fn, ms) {
  var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
};
A.byId = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
A.sum = function (arr, f) { var s = 0; arr.forEach(function (x) { s += f ? f(x) : x; }); return s; };

/* ------------------------------------------------------------------ dates
 * Dates are stored as local strings: "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM".
 * They are parsed into local Date objects, so no time-zone drift. */
var D = A.D = {};
D.DAY = 86400000;
D.WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
D.WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
D.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
D.MON = D.MONTHS.map(function (m) { return m.slice(0, 3); });

D.key = function (d) { return d.getFullYear() + '-' + A.pad(d.getMonth() + 1) + '-' + A.pad(d.getDate()); };
D.hm = function (d) { return A.pad(d.getHours()) + ':' + A.pad(d.getMinutes()); };
D.stamp = function (d) { return D.key(d) + 'T' + D.hm(d); };
D.parse = function (s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(s.getTime());
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
};
D.today = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
D.todayKey = function () { return D.key(new Date()); };
D.startOfDay = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
D.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
D.addMin = function (d, n) { return new Date(d.getTime() + n * 60000); };
D.addMonths = function (d, n) {
  var x = new Date(d), day = x.getDate();
  x.setDate(1); x.setMonth(x.getMonth() + n);
  x.setDate(Math.min(day, D.daysInMonth(x.getFullYear(), x.getMonth())));
  return x;
};
D.daysInMonth = function (y, m) { return new Date(y, m + 1, 0).getDate(); };
D.sameDay = function (a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
/* Whole days from a to b, counted on the calendar (DST-safe). */
D.diffDays = function (a, b) {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / D.DAY);
};
D.startOfWeek = function (d, weekStart) {
  var x = D.startOfDay(d), wd = x.getDay();
  return D.addDays(x, -((wd - (weekStart == null ? 1 : weekStart) + 7) % 7));
};
D.minutesOfDay = function (d) { return d.getHours() * 60 + d.getMinutes(); };
D.fromMinutes = function (day, min) { var x = D.startOfDay(day); x.setMinutes(min); return x; };
D.isoWeek = function (d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n);
  var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y) / D.DAY + 1) / 7);
};
D.time = function (d, fmt) {
  if (!d) return '';
  fmt = fmt || (A.state && A.state.settings.timeFormat) || '24';
  var h = d.getHours(), m = d.getMinutes();
  if (fmt === '12') {
    var ap = h < 12 ? 'am' : 'pm', hh = h % 12 || 12;
    return hh + (m ? ':' + A.pad(m) : '') + ap;
  }
  return A.pad(h) + ':' + A.pad(m);
};
D.hourLabel = function (h) {
  var fmt = (A.state && A.state.settings.timeFormat) || '24';
  if (fmt === '12') return (h % 12 || 12) + (h < 12 || h === 24 ? ' am' : ' pm');
  return A.pad(h % 24) + ':00';
};
D.dur = function (min) {
  min = Math.round(min);
  if (min < 60) return min + 'm';
  var h = Math.floor(min / 60), m = min % 60;
  return h + 'h' + (m ? ' ' + m + 'm' : '');
};
D.fmt = function (d, style) {
  if (!d) return '';
  switch (style) {
    case 'long': return D.WEEKDAYS[d.getDay()] + ', ' + d.getDate() + ' ' + D.MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    case 'medium': return D.WD[d.getDay()] + ' ' + d.getDate() + ' ' + D.MON[d.getMonth()];
    case 'month': return D.MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    case 'short': return d.getDate() + ' ' + D.MON[d.getMonth()];
    default: return d.getDate() + ' ' + D.MON[d.getMonth()] + ' ' + d.getFullYear();
  }
};
/* "Today", "Tomorrow", "Yesterday", "Fri", or "12 Oct". */
D.rel = function (d) {
  if (!d) return '';
  var n = D.diffDays(D.today(), d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return D.WD[d.getDay()];
  return D.fmt(d, n > -300 && n < 300 && d.getFullYear() === new Date().getFullYear() ? 'short' : 'default');
};
D.nth = function (n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'); };

/* -------------------------------------------------------------- recurrence
 * recur = { freq: 'daily'|'weekly'|'monthly'|'yearly', interval, byDay:[0-6],
 *           monthMode: 'date'|'nth', until: 'YYYY-MM-DD', count }          */
var R = A.R = {};

R.matches = function (ev, day, seriesStart) {
  var r = ev.recur, s = seriesStart, iv = Math.max(1, r.interval || 1);
  var dd = D.diffDays(s, day);
  if (dd < 0) return false;
  if (r.until && D.key(day) > r.until) return false;
  switch (r.freq) {
    case 'daily': return dd % iv === 0;
    case 'weekdays': return day.getDay() > 0 && day.getDay() < 6;
    case 'weekly': {
      var days = r.byDay && r.byDay.length ? r.byDay : [s.getDay()];
      if (days.indexOf(day.getDay()) < 0) return false;
      var w = Math.floor(D.diffDays(D.startOfWeek(s, 0), D.startOfWeek(day, 0)) / 7);
      return w % iv === 0;
    }
    case 'monthly': {
      var md = (day.getFullYear() - s.getFullYear()) * 12 + day.getMonth() - s.getMonth();
      if (md % iv !== 0) return false;
      if (r.monthMode === 'nth') {
        /* "2nd Tuesday"; a 5th weekday means "last" so every month has one. */
        var nth = Math.ceil(s.getDate() / 7);
        if (day.getDay() !== s.getDay()) return false;
        if (nth >= 5) return day.getDate() + 7 > D.daysInMonth(day.getFullYear(), day.getMonth());
        return Math.ceil(day.getDate() / 7) === nth;
      }
      var target = Math.min(s.getDate(), D.daysInMonth(day.getFullYear(), day.getMonth()));
      return day.getDate() === target;
    }
    case 'yearly': {
      var yd = day.getFullYear() - s.getFullYear();
      return yd % iv === 0 && day.getMonth() === s.getMonth() && day.getDate() === s.getDate();
    }
  }
  return false;
};

/* Every occurrence of `ev` that overlaps [from, to). Returns
 * [{ ev, start: Date, end: Date, key: 'YYYY-MM-DD', recurring }] */
R.expand = function (ev, from, to) {
  var s = D.parse(ev.start), e = D.parse(ev.end) || D.addMin(s, 60);
  if (ev.allDay) { e = D.parse(ev.end) || s; e = D.addDays(D.startOfDay(e), 1); }
  var len = Math.max(0, e - s), out = [];
  if (!ev.recur || !ev.recur.freq) {
    if (s < to && e > from) out.push({ ev: ev, start: s, end: e, key: D.key(s), recurring: false });
    return out;
  }
  var ex = ev.exdates || [], s0 = D.startOfDay(s), spanDays = Math.ceil(len / D.DAY);
  var count = ev.recur.count || 0, seen = 0;
  var day = count ? new Date(s0) : D.addDays(D.startOfDay(from), -spanDays);
  if (day < s0) day = new Date(s0);
  var stop = D.startOfDay(to), guard = 0;
  while (day <= stop && guard++ < 4000) {
    if (R.matches(ev, day, s0)) {
      seen++;
      if (count && seen > count) break;
      var k = D.key(day);
      if (ex.indexOf(k) < 0) {
        var os = new Date(day); os.setHours(s.getHours(), s.getMinutes(), 0, 0);
        var oe = new Date(os.getTime() + len);
        if (os < to && oe > from) out.push({ ev: ev, start: os, end: oe, key: k, recurring: true });
      }
    }
    day = D.addDays(day, 1);
  }
  return out;
};

R.describe = function (r) {
  if (!r || !r.freq) return 'Does not repeat';
  var iv = r.interval || 1, txt;
  switch (r.freq) {
    case 'daily': txt = iv === 1 ? 'Every day' : 'Every ' + iv + ' days'; break;
    case 'weekdays': txt = 'Every weekday'; break;
    case 'weekly':
      txt = (iv === 1 ? 'Weekly' : 'Every ' + iv + ' weeks') +
        (r.byDay && r.byDay.length ? ' on ' + r.byDay.slice().sort().map(function (d) { return D.WD[d]; }).join(', ') : '');
      break;
    case 'monthly': txt = iv === 1 ? 'Monthly' : 'Every ' + iv + ' months'; if (r.monthMode === 'nth') txt += ' (same weekday)'; break;
    case 'yearly': txt = iv === 1 ? 'Yearly' : 'Every ' + iv + ' years'; break;
  }
  if (r.until) txt += ', until ' + D.fmt(D.parse(r.until));
  if (r.count) txt += ', ' + r.count + ' times';
  return txt;
};

/* ------------------------------------------------------------------- store */
A.KINDS = ['settings', 'categories', 'projects', 'events', 'tasks', 'habits', 'goals', 'journal', 'focus', 'templates'];

A.defaultSettings = function () {
  return {
    theme: 'system', weekStart: 1, timeFormat: '24', dayStart: 6, dayEnd: 24,
    snap: 15, hourHeight: 52, defaultDuration: 60, workStart: 9, workEnd: 18,
    notifications: false, defaultReminder: 10, showWeekNumbers: true, showCompleted: true,
    pomo: { focus: 25, short: 5, long: 15, every: 4, autoStart: false, sound: true },
    name: '', sample: false
  };
};

A.defaultCategories = function () {
  return [
    { id: 'c-work', name: 'Work', color: '#3A63E0' },
    { id: 'c-study', name: 'Study', color: '#8A4FD8' },
    { id: 'c-health', name: 'Health', color: '#1F9A5B' },
    { id: 'c-personal', name: 'Personal', color: '#D9831F' },
    { id: 'c-social', name: 'Social', color: '#D0457A' },
    { id: 'c-errands', name: 'Errands', color: '#6B7A72' },
    { id: 'c-rest', name: 'Rest', color: '#2A9DB0' }
  ];
};

A.emptyState = function () {
  return {
    settings: A.defaultSettings(), categories: A.defaultCategories(),
    projects: [{ id: 'p-inbox', name: 'Inbox', color: '#6B7A72', system: true }],
    events: [], tasks: [], habits: [], goals: [], journal: {}, focus: [], templates: []
  };
};

A.state = A.emptyState();
A.savedAt = 0;

/* Every mutation goes through A.commit so it can be undone, saved and
 * re-rendered in one place. `kinds` lists the collections it touched. */
var undoStack = [], redoStack = [], listeners = [];
A.on = function (fn) { listeners.push(fn); };
A.emit = function (why) { listeners.forEach(function (fn) { try { fn(why); } catch (e) { console.error(e); } }); };

A.commit = function (label, kinds, fn) {
  var before = {};
  kinds.forEach(function (k) { before[k] = A.clone(A.state[k]); });
  var result = fn(A.state);
  undoStack.push({ label: label, kinds: kinds, before: before });
  if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
  A.persist.markDirty(kinds);
  A.emit(label);
  return result;
};
A.canUndo = function () { return undoStack.length > 0; };
A.canRedo = function () { return redoStack.length > 0; };
function swap(from, to) {
  var step = from.pop(); if (!step) return null;
  var now = {};
  step.kinds.forEach(function (k) { now[k] = A.clone(A.state[k]); A.state[k] = step.before[k]; });
  to.push({ label: step.label, kinds: step.kinds, before: now });
  A.persist.markDirty(step.kinds);
  A.emit('undo');
  return step.label;
}
A.undo = function () { return swap(undoStack, redoStack); };
A.redo = function () { return swap(redoStack, undoStack); };
A.resetHistory = function () { undoStack.length = 0; redoStack.length = 0; };

A.cat = function (id) { return A.byId(A.state.categories, id) || { id: '', name: 'No category', color: '#7D8781' }; };
A.project = function (id) { return A.byId(A.state.projects, id) || A.state.projects[0]; };

/* Normalise a loaded blob so older or partial saves still work. */
A.hydrate = function (raw) {
  var s = A.emptyState();
  if (!raw || typeof raw !== 'object') return s;
  A.KINDS.forEach(function (k) { if (raw[k] != null) s[k] = raw[k]; });
  s.settings = Object.assign(A.defaultSettings(), s.settings || {});
  s.settings.pomo = Object.assign(A.defaultSettings().pomo, s.settings.pomo || {});
  if (!Array.isArray(s.categories) || !s.categories.length) s.categories = A.defaultCategories();
  if (!Array.isArray(s.projects) || !s.projects.length) s.projects = A.emptyState().projects;
  ['events', 'tasks', 'habits', 'goals', 'focus', 'templates'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
  if (!s.journal || typeof s.journal !== 'object' || Array.isArray(s.journal)) s.journal = {};
  return s;
};

/* ------------------------------------------------------------ persistence
 * 1. localStorage, always (fast start, works from a file:// page).
 * 2. The artifact store, when the page is published and the viewer is
 *    signed in: each collection under the viewer's private subtree,
 *    chunked to stay under the 256 KB document limit.                   */
var LS_KEY = 'almanac.v1';
var P = A.persist = { dirty: {}, db: null, uid: null, status: 'local', lastError: '' };

P.readLocal = function () {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
};
P.writeLocal = function () {
  try {
    var blob = {}; A.KINDS.forEach(function (k) { blob[k] = A.state[k]; });
    blob.savedAt = A.savedAt;
    localStorage.setItem(LS_KEY, JSON.stringify(blob));
    return true;
  } catch (e) { return false; }
};

P.markDirty = function (kinds) {
  kinds.forEach(function (k) { P.dirty[k] = true; });
  A.savedAt = Date.now();
  P.schedule();
};
P.schedule = A.debounce(function () { P.flush(); }, 500);

var flushing = false;
P.flush = function () {
  P.writeLocal();
  if (!P.db || !P.uid || flushing) return;
  var kinds = Object.keys(P.dirty);
  if (!kinds.length) return;
  P.dirty = {};
  flushing = true;
  P.setStatus('saving');
  var chain = Promise.resolve();
  kinds.forEach(function (k) { chain = chain.then(function () { return P.writeKind(k); }); });
  chain.then(function () { return P.writeIndex(); })
    .then(function () { P.setStatus('synced'); })
    .catch(function (e) {
      kinds.forEach(function (k) { P.dirty[k] = true; });
      P.lastError = (e && (e.code || e.message)) || 'error';
      P.setStatus(P.lastError === 'quota_exceeded' ? 'full' : 'offline');
    })
    .then(function () { flushing = false; if (Object.keys(P.dirty).length && P.status === 'synced') P.schedule(); });
};

P.base = function () { return 'data/users/' + P.uid; };
P.chunks = {};

/* Split one collection into <=200 KB parts. Objects (journal) become
 * [key, value] pairs so they can be split the same way. */
P.split = function (k) {
  var v = A.state[k], items;
  if (k === 'settings') return [{ kind: k, part: 0, v: v }];
  items = Array.isArray(v) ? v : Object.keys(v).map(function (key) { return [key, v[key]]; });
  var parts = [], cur = [], size = 0, LIMIT = 200000;
  items.forEach(function (it) {
    var n = JSON.stringify(it).length + 1;
    if (size + n > LIMIT && cur.length) { parts.push(cur); cur = []; size = 0; }
    cur.push(it); size += n;
  });
  parts.push(cur);
  return parts.map(function (p, i) { return { kind: k, part: i, items: p, obj: !Array.isArray(v) }; });
};
P.writeKind = function (k) {
  var parts = P.split(k), col = P.db.collection(P.base());
  var prev = P.chunks[k] || 0, chain = Promise.resolve();
  parts.forEach(function (p) {
    chain = chain.then(function () { return col.doc(k + '-' + p.part).set({ kind: k, part: p.part, obj: !!p.obj, items: p.items || null, v: p.v || null }); });
  });
  for (var i = parts.length; i < prev; i++) (function (i) { chain = chain.then(function () { return col.doc(k + '-' + i).delete(); }); })(i);
  return chain.then(function () { P.chunks[k] = parts.length; });
};
P.writeIndex = function () {
  return P.db.collection(P.base()).doc('index').set({ chunks: P.chunks, savedAt: A.savedAt, v: 1 });
};
P.readRemote = function () {
  var col = P.db.collection(P.base());
  return col.doc('index').get().then(function (snap) {
    if (!snap.exists) return null;
    var idx = snap.data(), out = { savedAt: idx.savedAt || 0 }, jobs = [];
    var chunks = idx.chunks || {};
    Object.keys(chunks).forEach(function (k) {
      for (var i = 0; i < chunks[k]; i++) jobs.push(col.doc(k + '-' + i).get());
    });
    return Promise.all(jobs).then(function (snaps) {
      snaps.forEach(function (s) {
        if (!s.exists) return;
        var d = s.data(), k = d.kind;
        if (k === 'settings') { out.settings = d.v; return; }
        if (d.obj) {
          out[k] = out[k] || {};
          (d.items || []).forEach(function (pair) { out[k][pair[0]] = pair[1]; });
        } else {
          out[k] = (out[k] || []).concat(d.items || []);
        }
      });
      P.chunks = Object.assign({}, chunks);
      return out;
    });
  });
};

P.setStatus = function (s) { P.status = s; A.emit('sync'); };

/* Called once at boot, after the first local render. */
P.connect = function (onRemote) {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
    var db = r[0], user = r[1];
    if (!db || !user) return null;
    return user.id().then(function (id) {
      if (!id) return null;
      P.db = db; P.uid = id;
      P.setStatus('saving');
      return P.readRemote();
    });
  }).then(function (remote) {
    if (!P.db) return;
    if (remote && remote.savedAt > A.savedAt) {
      onRemote(remote);
      P.setStatus('synced');
    } else {
      A.KINDS.forEach(function (k) { P.dirty[k] = true; });
      P.flush();
    }
  }).catch(function (e) {
    P.lastError = (e && (e.code || e.message)) || 'error';
    P.setStatus('local');
  });
};

/* --------------------------------------------------------- queries on data */

/* Event occurrences (all categories, honouring the hidden filter). */
A.hiddenCats = {};
A.occurrences = function (from, to, opts) {
  opts = opts || {};
  var out = [];
  A.state.events.forEach(function (ev) {
    if (!opts.all && A.hiddenCats[ev.catId || '']) return;
    R.expand(ev, from, to).forEach(function (o) { out.push(o); });
  });
  out.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
  return out;
};

/* Occurrences that overlap another on the same day (timed only). */
A.conflicts = function (occs) {
  var timed = occs.filter(function (o) { return !o.ev.allDay; }), set = {};
  for (var i = 0; i < timed.length; i++) {
    for (var j = i + 1; j < timed.length; j++) {
      if (timed[j].start >= timed[i].end) break;
      if (timed[j].start < timed[i].end && timed[j].end > timed[i].start) {
        set[timed[i].ev.id + '@' + timed[i].key] = true;
        set[timed[j].ev.id + '@' + timed[j].key] = true;
      }
    }
  }
  return set;
};

/* Free gaps on a day between `fromMin` and `toMin`, minimum `minLen`. */
A.freeSlots = function (day, fromMin, toMin, minLen) {
  var start = D.fromMinutes(day, fromMin), end = D.fromMinutes(day, toMin);
  var busy = A.occurrences(start, end, { all: true }).filter(function (o) { return !o.ev.allDay; });
  var gaps = [], cur = start;
  busy.forEach(function (o) {
    if (o.start > cur && (o.start - cur) / 60000 >= (minLen || 1)) gaps.push({ start: new Date(cur), end: new Date(o.start) });
    if (o.end > cur) cur = new Date(o.end);
  });
  if (end > cur && (end - cur) / 60000 >= (minLen || 1)) gaps.push({ start: new Date(cur), end: new Date(end) });
  return gaps;
};

A.taskOpen = function (t) { return t.status !== 'done'; };
A.taskOverdue = function (t) { return A.taskOpen(t) && t.due && t.due < D.todayKey(); };

/* Habits: is it scheduled on this weekday, and is it complete that day? */
A.habitDue = function (h, day) { return !h.days || !h.days.length || h.days.indexOf(day.getDay()) >= 0; };
A.habitDone = function (h, key) { return ((h.log || {})[key] || 0) >= (h.target || 1); };
A.habitStreak = function (h) {
  var day = D.today(), streak = 0, guard = 0;
  if (!A.habitDone(h, D.key(day))) day = D.addDays(day, -1);
  while (guard++ < 2000) {
    if (A.habitDue(h, day)) { if (A.habitDone(h, D.key(day))) streak++; else break; }
    day = D.addDays(day, -1);
    if (h.created && D.key(day) < h.created) break;
  }
  return streak;
};
A.habitBest = function (h) {
  var keys = Object.keys(h.log || {}).sort(); if (!keys.length) return 0;
  var day = D.parse(keys[0]), end = D.today(), best = 0, cur = 0;
  while (day <= end) {
    if (A.habitDue(h, day)) { if (A.habitDone(h, D.key(day))) { cur++; best = Math.max(best, cur); } else if (D.key(day) !== D.todayKey()) cur = 0; }
    day = D.addDays(day, 1);
  }
  return best;
};
A.habitRate = function (h, days) {
  var due = 0, done = 0, day = D.today();
  for (var i = 0; i < days; i++) {
    if (A.habitDue(h, day) && (!h.created || D.key(day) >= h.created)) { due++; if (A.habitDone(h, D.key(day))) done++; }
    day = D.addDays(day, -1);
  }
  return due ? done / due : 0;
};

A.goalProgress = function (g) {
  /* A numeric target is the clearest measure, so it wins over linked
   * tasks; milestones always count. */
  var parts = [];
  if (g.milestones && g.milestones.length) parts.push(g.milestones.filter(function (m) { return m.done; }).length / g.milestones.length);
  if (g.target) parts.push(A.clamp((g.current || 0) / g.target, 0, 1));
  else {
    var linked = A.state.tasks.filter(function (t) { return t.goalId === g.id; });
    if (linked.length) parts.push(linked.filter(function (t) { return t.status === 'done'; }).length / linked.length);
  }
  if (!parts.length) return g.done ? 1 : 0;
  return A.sum(parts) / parts.length;
};

/* ----------------------------------------------------------------------- ICS */
var ICS = A.ICS = {};
function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function icsDate(s, allDay) { var d = D.parse(s); return allDay ? D.key(d).replace(/-/g, '') : D.key(d).replace(/-/g, '') + 'T' + D.hm(d).replace(':', '') + '00'; }
ICS.export = function (events) {
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Almanac//Planner//EN', 'CALSCALE:GREGORIAN'];
  var now = new Date(), stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  events.forEach(function (ev) {
    L.push('BEGIN:VEVENT', 'UID:' + ev.id + '@almanac', 'DTSTAMP:' + stamp);
    if (ev.allDay) {
      L.push('DTSTART;VALUE=DATE:' + icsDate(ev.start, true));
      L.push('DTEND;VALUE=DATE:' + icsDate(D.key(D.addDays(D.parse(ev.end || ev.start), 1)), true));
    } else {
      L.push('DTSTART:' + icsDate(ev.start), 'DTEND:' + icsDate(ev.end));
    }
    L.push('SUMMARY:' + icsEsc(ev.title));
    if (ev.location) L.push('LOCATION:' + icsEsc(ev.location));
    if (ev.notes) L.push('DESCRIPTION:' + icsEsc(ev.notes));
    if (ev.catId) L.push('CATEGORIES:' + icsEsc(A.cat(ev.catId).name));
    var r = ev.recur;
    if (r && r.freq) {
      var rule = ['FREQ=' + (r.freq === 'weekdays' ? 'WEEKLY' : r.freq.toUpperCase())];
      if (r.freq === 'weekdays') rule.push('BYDAY=MO,TU,WE,TH,FR');
      if (r.interval > 1) rule.push('INTERVAL=' + r.interval);
      if (r.freq === 'weekly' && r.byDay && r.byDay.length) rule.push('BYDAY=' + r.byDay.map(function (d) { return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]; }).join(','));
      if (r.freq === 'monthly' && r.monthMode === 'nth') {
        var s = D.parse(ev.start); rule.push('BYDAY=' + Math.ceil(s.getDate() / 7) + ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][s.getDay()]);
      }
      if (r.until) rule.push('UNTIL=' + r.until.replace(/-/g, '') + 'T235959');
      if (r.count) rule.push('COUNT=' + r.count);
      L.push('RRULE:' + rule.join(';'));
      (ev.exdates || []).forEach(function (x) { L.push('EXDATE:' + icsDate(x + 'T' + D.hm(D.parse(ev.start)))); });
    }
    (ev.reminders || []).forEach(function (m) { L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title), 'TRIGGER:-PT' + m + 'M', 'END:VALARM'); });
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(function (l) {
    var out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n');
  }).join('\r\n');
};
function icsParseDate(v) {
  var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v || '');
  if (!m) return null;
  if (!m[4]) return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  var d = m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return { date: d, allDay: false };
}
function icsUnesc(s) { return String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }
ICS.parse = function (text) {
  var lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  var out = [], cur = null, inAlarm = false;
  lines.forEach(function (line) {
    if (line === 'BEGIN:VEVENT') { cur = { reminders: [] }; return; }
    if (line === 'END:VEVENT') { if (cur) out.push(cur); cur = null; return; }
    if (!cur) return;
    if (line === 'BEGIN:VALARM') { inAlarm = true; return; }
    if (line === 'END:VALARM') { inAlarm = false; return; }
    var i = line.indexOf(':'); if (i < 0) return;
    var name = line.slice(0, i).split(';')[0].toUpperCase(), val = line.slice(i + 1);
    if (inAlarm) { var t = /-P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/.exec(val); if (name === 'TRIGGER' && t) cur.reminders.push((+t[1] || 0) * 60 + (+t[2] || 0)); return; }
    if (name === 'SUMMARY') cur.title = icsUnesc(val);
    else if (name === 'LOCATION') cur.location = icsUnesc(val);
    else if (name === 'DESCRIPTION') cur.notes = icsUnesc(val);
    else if (name === 'DTSTART') cur.dtstart = icsParseDate(val);
    else if (name === 'DTEND') cur.dtend = icsParseDate(val);
    else if (name === 'RRULE') cur.rrule = val;
    else if (name === 'EXDATE') { cur.exdates = (cur.exdates || []).concat(val.split(',').map(function (x) { var p = icsParseDate(x); return p ? D.key(p.date) : null; }).filter(Boolean)); }
  });
  return out.filter(function (x) { return x.dtstart; }).map(function (x) {
    var allDay = x.dtstart.allDay, s = x.dtstart.date;
    var e = x.dtend ? x.dtend.date : (allDay ? D.addDays(s, 1) : D.addMin(s, 60));
    var ev = {
      id: A.uid(), title: x.title || '(untitled)', allDay: allDay, location: x.location || '', notes: x.notes || '',
      start: allDay ? D.key(s) : D.stamp(s), end: allDay ? D.key(D.addDays(e, -1)) : D.stamp(e),
      catId: '', reminders: x.reminders, exdates: x.exdates || []
    };
    if (x.rrule) {
      var p = {}; x.rrule.split(';').forEach(function (kv) { var a = kv.split('='); p[a[0]] = a[1]; });
      var map = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
      if (map[p.FREQ]) {
        var r = { freq: map[p.FREQ], interval: +p.INTERVAL || 1 };
        if (p.BYDAY) {
          var codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          if (r.freq === 'monthly') r.monthMode = 'nth';
          else r.byDay = p.BYDAY.split(',').map(function (c) { return codes.indexOf(c.slice(-2)); }).filter(function (n) { return n >= 0; });
        }
        if (p.UNTIL) { var u = icsParseDate(p.UNTIL); if (u) r.until = D.key(u.date); }
        if (p.COUNT) r.count = +p.COUNT;
        ev.recur = r;
      }
    }
    return ev;
  });
};

/* -------------------------------------------------------------- downloads */
A.download = function (filename, text, mime) {
  var done = false;
  function fallback() {
    if (done) return; done = true;
    try {
      var blob = new Blob([text], { type: mime || 'application/octet-stream' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { A.toast && A.toast('Your browser blocked the download.'); }
  }
  if (window.claude && window.claude.use) {
    window.claude.use('downloads').then(function (dl) {
      if (!dl) return fallback();
      done = true;
      return dl.save({ filename: filename, data: text }).then(function () {
        A.toast && A.toast('Saved ' + filename);
      }).catch(function (e) {
        var code = e && e.code;
        if (code === 'declined') return;
        if (code === 'rejected_extension' || code === 'extension_not_enabled') { A.toast && A.toast('This viewer cannot save that file type. Use Copy instead.'); return; }
        if (code === 'rate_limited') { A.toast && A.toast('A save prompt is already open.'); return; }
        A.toast && A.toast('The download did not start.');
      });
    }).catch(fallback);
  } else fallback();
};
