/* Almanac — UI toolkit: icons, modals, confirm, toasts, menus, palette, quick add. */
'use strict';
(function () {
  var D = A.D, esc = A.esc;

  /* ------------------------------------------------------------- icons */
  var P = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    timetable: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    habits: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 2.5v4.2h-4.2M6 21.5v-4.2h4.2"/>',
    goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
    journal: '<path d="M5 3.5h11a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3z"/><path d="M5 17.5a3 3 0 0 1 3-3h11M9 7.5h6"/>',
    insights: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    skip: '<path d="m5 4 10 8-10 8zM19 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v3h16v-3"/>',
    upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 17v3h16v-3"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    board: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>',
    matrix: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    wand: '<path d="m15 4 5 5L9 20H4v-5zM13 6l5 5"/><path d="M5 3v4M3 5h4M19 15v4M17 17h4"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v7H2v-7z"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v12h16V8M10 12h4"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8M10 13h4"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
  };
  A.icon = function (name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.more) + '</svg>';
  };

  /* -------------------------------------------------------------- dom */
  A.$ = function (sel, root) { return (root || document).querySelector(sel); };
  A.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  A.el = function (html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* Delegated actions: <button data-act="name" data-id="…"> */
  A.actions = {};
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var fn = A.actions[t.getAttribute('data-act')];
    if (fn) { e.preventDefault(); fn(t, e); }
  });

  /* ------------------------------------------------------------ modal */
  var stack = [];
  A.modal = function (o) {
    var root = A.el(
      '<div class="modal-wrap" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '">' +
      '<div class="modal' + (o.size ? ' m-' + o.size : '') + '">' +
      (o.title ? '<header class="modal-h"><h2>' + esc(o.title) + '</h2>' + (o.headExtra || '') +
        '<button class="icon-btn" data-close aria-label="Close">' + A.icon('x') + '</button></header>' : '') +
      '<div class="modal-b">' + (o.body || '') + '</div>' +
      (o.foot ? '<footer class="modal-f">' + o.foot + '</footer>' : '') +
      '</div></div>');
    var prevFocus = document.activeElement;
    document.body.appendChild(root);
    var api = {
      root: root,
      close: function (val) {
        if (!root.isConnected) return;
        root.classList.add('out');
        var i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        setTimeout(function () { root.remove(); }, 140);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
        if (o.onClose) o.onClose(val);
      }
    };
    stack.push(api);
    root.addEventListener('mousedown', function (e) { if (e.target === root) api.close(); });
    A.$$('[data-close]', root).forEach(function (b) { b.addEventListener('click', function () { api.close(); }); });
    if (o.onMount) o.onMount(root, api);
    setTimeout(function () {
      var f = A.$('[autofocus]', root) || A.$('input:not([type=hidden]),textarea,select,button.primary', root);
      if (f) f.focus();
    }, 30);
    return api;
  };
  A.topModal = function () { return stack[stack.length - 1]; };

  A.confirm = function (message, o) {
    o = o || {};
    return new Promise(function (resolve) {
      var done = false;
      var m = A.modal({
        title: o.title || 'Are you sure?', size: 'sm',
        body: '<p class="lede">' + esc(message) + '</p>',
        foot: '<button class="btn" data-close>Cancel</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-ok>' + esc(o.ok || 'OK') + '</button>',
        onClose: function () { if (!done) resolve(false); }
      });
      A.$('[data-ok]', m.root).addEventListener('click', function () { done = true; resolve(true); m.close(); });
      setTimeout(function () { A.$('[data-ok]', m.root).focus(); }, 40);
    });
  };

  /* Pick one of several options; resolves the value or null. */
  A.choose = function (title, options, message) {
    return new Promise(function (resolve) {
      var done = false;
      var m = A.modal({
        title: title, size: 'sm',
        body: (message ? '<p class="lede">' + esc(message) + '</p>' : '') + '<div class="choices">' + options.map(function (op, i) {
          return '<button class="choice' + (op.danger ? ' danger' : '') + '" data-i="' + i + '"><strong>' + esc(op.label) + '</strong>' + (op.desc ? '<span>' + esc(op.desc) + '</span>' : '') + '</button>';
        }).join('') + '</div>',
        onClose: function () { if (!done) resolve(null); }
      });
      A.$$('[data-i]', m.root).forEach(function (b) {
        b.addEventListener('click', function () { done = true; resolve(options[+b.getAttribute('data-i')].value); m.close(); });
      });
    });
  };

  /* ----------------------------------------------------------- toasts */
  A.toast = function (msg, o) {
    o = o || {};
    var host = A.$('#toasts');
    if (!host) return;
    var t = A.el('<div class="toast" role="status"><span>' + esc(msg) + '</span></div>');
    if (o.undo) {
      var b = A.el('<button class="link">Undo</button>');
      b.addEventListener('click', function () { var l = A.undo(); if (l) A.toast('Undid ' + l.toLowerCase()); t.remove(); });
      t.appendChild(b);
    }
    if (o.action) {
      var a = A.el('<button class="link">' + esc(o.action.label) + '</button>');
      a.addEventListener('click', function () { o.action.fn(); t.remove(); });
      t.appendChild(a);
    }
    host.appendChild(t);
    while (host.children.length > 4) host.firstElementChild.remove();
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, o.ms || 4200);
  };

  /* ------------------------------------------------------------- menu */
  var openMenu = null;
  A.closeMenu = function () { if (openMenu) { openMenu.remove(); openMenu = null; } };
  A.menu = function (anchor, items, o) {
    A.closeMenu();
    o = o || {};
    var m = A.el('<div class="menu" role="menu">' + items.map(function (it, i) {
      if (it === '-') return '<hr>';
      if (it.header) return '<div class="menu-h">' + esc(it.header) + '</div>';
      return '<button role="menuitem" class="' + (it.danger ? 'danger' : '') + (it.active ? ' active' : '') + '" data-i="' + i + '">' +
        (it.color ? '<i class="sw" style="--c:' + esc(it.color) + '"></i>' : it.icon ? A.icon(it.icon) : '<i class="sp"></i>') +
        '<span>' + esc(it.label) + '</span>' + (it.hint ? '<kbd>' + esc(it.hint) + '</kbd>' : '') + '</button>';
    }).join('') + '</div>');
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    var mw = m.offsetWidth, mh = m.offsetHeight;
    var x = o.alignRight ? r.right - mw : r.left, y = r.bottom + 4;
    if (x + mw > innerWidth - 8) x = innerWidth - mw - 8;
    if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
    m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b) return;
      var it = items[+b.getAttribute('data-i')]; A.closeMenu(); if (it.fn) it.fn();
    });
    openMenu = m;
    var first = A.$('button', m); if (first) first.focus();
    return m;
  };
  document.addEventListener('mousedown', function (e) { if (openMenu && !openMenu.contains(e.target)) A.closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (!openMenu) return;
    var btns = A.$$('button', openMenu), i = btns.indexOf(document.activeElement);
    if (e.key === 'Escape') { A.closeMenu(); e.stopPropagation(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0]).focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (btns[i - 1] || btns[btns.length - 1]).focus(); }
  }, true);

  /* ------------------------------------------------------ form pieces */
  A.f = {
    opt: function (v, label, sel) { return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(label) + '</option>'; },
    catSelect: function (id, sel, none) {
      return '<select id="' + id + '">' + (none !== false ? A.f.opt('', 'No category', sel) : '') +
        A.state.categories.map(function (c) { return A.f.opt(c.id, c.name, sel); }).join('') + '</select>';
    },
    projectSelect: function (id, sel) {
      return '<select id="' + id + '">' + A.state.projects.map(function (p) { return A.f.opt(p.system ? '' : p.id, p.name, sel || ''); }).join('') + '</select>';
    },
    swatches: function (name, sel) {
      return '<div class="swatches" role="radiogroup">' + A.colors.map(function (c) {
        return '<label class="swatch" style="--c:' + c + '"><input type="radio" name="' + name + '" value="' + c + '"' + (c === sel ? ' checked' : '') + ' aria-label="' + c + '"><i></i></label>';
      }).join('') + '</div>';
    },
    val: function (root, sel) { var e = A.$(sel, root); return e ? e.value : ''; },
    timeOptions: function (sel, stepMin) {
      var out = '', step = stepMin || 15;
      for (var m = 0; m < 1440; m += step) {
        var d = D.fromMinutes(D.today(), m);
        out += A.f.opt(D.hm(d), D.time(d), sel);
      }
      if (sel && out.indexOf('value="' + sel + '"') < 0) out = A.f.opt(sel, D.time(D.parse('2000-01-01T' + sel)), sel) + out;
      return out;
    }
  };

  /* --------------------------------------------------------- quick add */
  A.openQuickAdd = function (prefill, forceKind) {
    var kind = forceKind || 'auto';
    var m = A.modal({
      title: 'Quick add', size: 'md',
      body:
        '<div class="qa">' +
        '<div class="seg" role="tablist" aria-label="Type">' +
        ['auto', 'event', 'task'].map(function (k) { return '<button role="tab" data-k="' + k + '" class="' + (k === kind ? 'on' : '') + '">' + { auto: 'Detect', event: 'Event', task: 'Task' }[k] + '</button>'; }).join('') +
        '</div>' +
        '<input id="qa-input" class="qa-input" autocomplete="off" spellcheck="false" placeholder="Gym tomorrow 6–7:30pm #health every mon,wed" value="' + esc(prefill || '') + '">' +
        '<div class="qa-preview" id="qa-preview"></div>' +
        '<details class="qa-help"><summary>What can I type?</summary><dl>' +
        '<dt>When</dt><dd><code>today</code> <code>tmrw</code> <code>fri</code> <code>next mon</code> <code>14 oct</code> <code>in 3 days</code> <code>weekend</code></dd>' +
        '<dt>Time</dt><dd><code>3pm</code> <code>at 17:30</code> <code>9-11am</code> <code>noon</code> <code>for 90m</code> <code>all day</code></dd>' +
        '<dt>Repeat</dt><dd><code>daily</code> <code>every weekday</code> <code>every mon,wed</code> <code>every other week</code> <code>until 30 nov</code> <code>10 times</code></dd>' +
        '<dt>Sort</dt><dd><code>#work</code> category or tag · <code>+project</code> · <code>@place</code> · <code>!1</code>–<code>!3</code> priority · <code>~30m</code> estimate · <code>remind 15m</code></dd>' +
        '</dl></details></div>',
      foot: '<span class="hint"><kbd>Enter</kbd> add · <kbd>Shift</kbd>+<kbd>Enter</kbd> add another</span><button class="btn" data-close>Cancel</button><button class="btn primary" id="qa-go">Add</button>'
    });
    var input = A.$('#qa-input', m.root), prev = A.$('#qa-preview', m.root);
    function result() {
      var p = A.parseQuick((kind !== 'auto' ? kind + ': ' : '') + input.value);
      if (kind === 'event' && p.startMin == null && !p.allDay) p.allDay = true;
      return p;
    }
    function render() {
      var p = result();
      if (!input.value.trim()) { prev.innerHTML = '<span class="muted">Type an event or a task. Times make it an event; no time makes it a task.</span>'; return; }
      prev.innerHTML = '<span class="pill kind-' + p.kind + '">' + (p.kind === 'event' ? 'Event' : 'Task') + '</span>' +
        '<strong class="qa-title">' + esc(p.title || 'Untitled') + '</strong>' +
        p.chips.map(function (c) { return '<span class="chip chip-' + c.type + '">' + esc(c.label) + '</span>'; }).join('');
    }
    function submit(keepOpen) {
      var p = result();
      if (!p.title) { input.focus(); return; }
      var res = A.applyQuick(p);
      if (!res) return;
      A.toast((res.type === 'event' ? 'Added event: ' : 'Added task: ') + res.item.title + (p.date ? ' · ' + D.rel(p.date) : ''), { undo: true });
      if (keepOpen) { input.value = ''; render(); input.focus(); } else m.close();
    }
    A.$$('.seg button', m.root).forEach(function (b) {
      b.addEventListener('click', function () {
        kind = b.getAttribute('data-k');
        A.$$('.seg button', m.root).forEach(function (x) { x.classList.toggle('on', x === b); });
        render(); input.focus();
      });
    });
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(e.shiftKey); } });
    A.$('#qa-go', m.root).addEventListener('click', function () { submit(false); });
    render();
    setTimeout(function () { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 40);
  };

  /* --------------------------------------------------- command palette */
  A.commands = [];
  A.addCommand = function (c) { A.commands.push(c); };

  A.openPalette = function (initial) {
    var m = A.modal({
      size: 'palette',
      body: '<div class="pal"><div class="pal-in">' + A.icon('search') + '<input id="pal-input" autocomplete="off" spellcheck="false" placeholder="Search everything, or type a command…" value="' + esc(initial || '') + '"><kbd>Esc</kbd></div><div class="pal-list" id="pal-list" role="listbox"></div></div>'
    });
    var input = A.$('#pal-input', m.root), list = A.$('#pal-list', m.root), items = [], sel = 0;

    function score(text, q) {
      text = text.toLowerCase();
      var i = text.indexOf(q); if (i === 0) return 100; if (i > 0) return 80 - Math.min(i, 40);
      var words = q.split(/\s+/).filter(Boolean);
      if (words.length > 1 && words.every(function (w) { return text.indexOf(w) >= 0; })) return 50;
      var ti = 0; for (var qi = 0; qi < q.length; qi++) { ti = text.indexOf(q[qi], ti); if (ti < 0) return 0; ti++; }
      return 20;
    }
    function build() {
      var q = input.value.trim().toLowerCase(), out = [];
      A.commands.forEach(function (c) {
        if (c.when && !c.when()) return;
        var s = q ? score(c.label + ' ' + (c.keywords || ''), q) : 1;
        if (s) out.push({ group: c.group || 'Commands', label: c.label, hint: c.hint, icon: c.icon || 'sparkle', score: s + 5, run: c.run });
      });
      if (q.length > 1) {
        var now = D.today();
        A.state.events.forEach(function (ev) {
          var s = score(ev.title + ' ' + (ev.location || '') + ' ' + (ev.notes || ''), q); if (!s) return;
          var next = A.R.expand(ev, D.addDays(now, -1), D.addDays(now, 366))[0];
          var when = next ? next.start : D.parse(ev.start);
          out.push({ group: 'Events', label: ev.title, sub: (ev.recur ? A.R.describe(ev.recur) + ' · next ' : '') + D.fmt(when, 'medium') + (ev.allDay ? '' : ' ' + D.time(when)), color: A.cat(ev.catId).color, score: s, run: function () { A.go('calendar', { date: D.startOfDay(when) }); A.editEvent(ev, next); } });
        });
        A.state.tasks.forEach(function (t) {
          var s = score(t.title + ' ' + (t.notes || '') + ' ' + (t.tags || []).join(' '), q); if (!s) return;
          out.push({ group: 'Tasks', label: t.title, sub: (t.status === 'done' ? 'Done' : t.due ? 'Due ' + D.rel(D.parse(t.due)) : 'No date') + ' · ' + A.project(t.projectId).name, icon: t.status === 'done' ? 'check' : 'tasks', score: s - (t.status === 'done' ? 10 : 0), run: function () { A.go('tasks'); A.editTask(t); } });
        });
        A.state.habits.forEach(function (h) { var s = score(h.name, q); if (s) out.push({ group: 'Habits', label: h.name, icon: 'habits', score: s, run: function () { A.go('habits'); } }); });
        A.state.goals.forEach(function (g) { var s = score(g.title + ' ' + (g.why || ''), q); if (s) out.push({ group: 'Goals', label: g.title, icon: 'goals', score: s, run: function () { A.go('goals'); A.editGoal(g); } }); });
        Object.keys(A.state.journal).forEach(function (k) {
          var j = A.state.journal[k], text = (j.text || '') + ' ' + (j.gratitude || []).join(' ');
          var i = text.toLowerCase().indexOf(q); if (i < 0) return;
          out.push({ group: 'Journal', label: D.fmt(D.parse(k), 'long'), sub: '…' + text.slice(Math.max(0, i - 20), i + 50) + '…', icon: 'journal', score: 30, run: function () { A.go('journal', { date: D.parse(k) }); } });
        });
        if (q.length > 2) {
          var p = A.parseQuick(input.value);
          if (p.title && (p.date || p.startMin != null)) {
            out.push({ group: 'Create', label: 'Add ' + p.kind + ': ' + p.title, sub: p.chips.map(function (c) { return c.label; }).join(' · '), icon: 'plus', score: 200, run: function () { var r = A.applyQuick(p); if (r) A.toast('Added ' + r.type + ': ' + r.item.title, { undo: true }); } });
          } else {
            out.push({ group: 'Create', label: 'Add task: ' + (p.title || input.value.trim()), icon: 'plus', score: 1, run: function () { var r = A.applyQuick(Object.assign(p, { kind: 'task', title: p.title || input.value.trim() })); if (r) A.toast('Added task: ' + r.item.title, { undo: true }); } });
          }
        }
      }
      out.sort(function (a, b) { return b.score - a.score; });
      items = out.slice(0, 60); sel = 0; paint();
    }
    function paint() {
      if (!items.length) { list.innerHTML = '<div class="pal-empty">Nothing matches. Press Enter to add it as a task.</div>'; return; }
      var html = '', last = '';
      items.forEach(function (it, i) {
        if (it.group !== last) { html += '<div class="pal-g">' + esc(it.group) + '</div>'; last = it.group; }
        html += '<div class="pal-i' + (i === sel ? ' sel' : '') + '" role="option" data-i="' + i + '">' +
          (it.color ? '<i class="dot" style="--c:' + esc(it.color) + '"></i>' : A.icon(it.icon || 'sparkle')) +
          '<span class="pal-t">' + esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
          (it.hint ? '<kbd>' + esc(it.hint) + '</kbd>' : '') + '</div>';
      });
      list.innerHTML = html;
      var s = A.$('.sel', list); if (s) s.scrollIntoView({ block: 'nearest' });
    }
    function run(i) { var it = items[i]; if (!it) return; m.close(); setTimeout(it.run, 10); }
    input.addEventListener('input', build);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (items.length) run(sel);
        else if (input.value.trim()) { var r = A.applyQuick(Object.assign(A.parseQuick(input.value), { kind: 'task' })); m.close(); if (r) A.toast('Added task: ' + r.item.title, { undo: true }); }
      }
    });
    list.addEventListener('click', function (e) { var r = e.target.closest('[data-i]'); if (r) run(+r.getAttribute('data-i')); });
    list.addEventListener('mousemove', function (e) { var r = e.target.closest('[data-i]'); if (r && +r.getAttribute('data-i') !== sel) { sel = +r.getAttribute('data-i'); A.$$('.pal-i', list).forEach(function (x, i) { x.classList.toggle('sel', i === sel); }); } });
    build();
  };

  /* ------------------------------------------------ small chart helpers */
  A.ring = function (pct, size, stroke, label) {
    size = size || 44; stroke = stroke || 5;
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - A.clamp(pct, 0, 1));
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + Math.round(pct * 100) + '%">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--ring, var(--accent))" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      (label != null ? '<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">' + esc(label) + '</text>' : '') + '</svg>';
  };
})();
