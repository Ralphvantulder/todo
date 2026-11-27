/* ============================================================
   To do Ralph — app
   Data: Supabase (tabellen lists, labels, tasks, projects, notes; RLS per eigenaar).
   Demo: voeg ?demo toe aan de URL voor een lokale versie met voorbeelddata (niets wordt opgeslagen).
   ============================================================ */
'use strict';

var CFG_URL = '%%SUPABASE_URL%%';
var CFG_KEY = '%%SUPABASE_KEY%%';
var COLORS = ['groen', 'geel', 'rood', 'blauw', 'paars', 'roze', 'teal', 'grijs'];
var DEFAULT_LABELS = [['Prio', 'groen'], ['Wachten', 'geel']];
var DEMO = /[?&]demo\b/.test(location.search);

/* ---------- hulpfuncties ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function uid() { return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now()); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function todayIso() { return isoDate(today()); }
function parseDate(s) { if (!s) return null; var p = String(s).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
var MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function fmtDate(d, withYear) {
  if (!d) return '';
  if (typeof d === 'string') d = parseDate(d);
  var y = withYear === undefined ? d.getFullYear() !== today().getFullYear() : withYear;
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + (y ? ' ' + d.getFullYear() : '');
}
function fmtStamp(s) {
  if (!s) return '';
  var d = new Date(s), day = new Date(d); day.setHours(0, 0, 0, 0);
  var n = daysBetween(day, today());
  if (n === 0) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (n === 1) return 'gisteren';
  return fmtDate(day);
}
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function icon(name, cls) { return '<svg class="icon' + (cls ? ' ' + cls : '') + '"><use href="#i-' + name + '"/></svg>'; }
function plural(n, one, more) { return n + ' ' + (n === 1 ? one : more); }
function cmpName(a, b) { return norm(a).localeCompare(norm(b), 'nl'); }
function arr(v) { return Array.isArray(v) ? v : []; }
function isMobile() { return window.matchMedia('(max-width:768px)').matches; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* ============================================================
   OPSLAG: Supabase of demo
   ============================================================ */
var TABLES = ['lists', 'labels', 'tasks', 'projects', 'notes', 'deadlines'];
var Store = {
  sb: null, user: null,
  init: function () {
    if (DEMO) return;
    var url = CFG_URL, key = CFG_KEY;
    if (!url || !key || url.indexOf('%%') === 0) {
      url = key = '';
      try { var c = JSON.parse(lsGet('todo.config') || 'null'); if (c) { url = c.url; key = c.key; } } catch (e) {}
    }
    if (!url || !key) return 'config';
    this.sb = supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'todo.auth' } });
  },
  session: async function () {
    if (DEMO) return { user: { email: 'demo@voorbeeld.nl', id: 'demo' } };
    var r = await this.sb.auth.getSession(); return r.data.session;
  },
  signIn: async function (email, pw) { var r = await this.sb.auth.signInWithPassword({ email: email, password: pw }); if (r.error) throw r.error; return r.data.session; },
  signUp: async function (email, pw) {
    var r = await this.sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
    if (r.error) throw r.error; return r.data;
  },
  setName: async function (name) {
    if (DEMO) { this.user.user_metadata = Object.assign({}, this.user.user_metadata, { display_name: name }); return this.user; }
    var r = await this.sb.auth.updateUser({ data: { display_name: name } }); if (r.error) throw r.error; this.user = r.data.user; return this.user;
  },
  signOut: async function () { if (!DEMO) await this.sb.auth.signOut(); },
  loadAll: async function () {
    if (DEMO) return JSON.parse(JSON.stringify(Demo.data));
    var self = this, out = {};
    await Promise.all(TABLES.map(async function (t) {
      var r = await self.sb.from(t).select('*');
      if (r.error) throw r.error; out[t] = r.data;
    }));
    return out;
  },
  insert: async function (t, row) {
    if (DEMO) { row = Object.assign({ id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, row); Demo.data[t].push(row); return JSON.parse(JSON.stringify(row)); }
    var r = await this.sb.from(t).insert(row).select().single(); if (r.error) throw r.error; return r.data;
  },
  insertMany: async function (t, rows) {
    if (!rows.length) return [];
    if (DEMO) { var self = this; return Promise.all(rows.map(function (r) { return self.insert(t, r); })); }
    var r = await this.sb.from(t).insert(rows).select(); if (r.error) throw r.error; return r.data;
  },
  update: async function (t, id, patch) {
    patch = Object.assign({}, patch, { updated_at: new Date().toISOString() });
    if (DEMO) { var row = Demo.data[t].find(function (x) { return x.id === id; }); Object.assign(row, patch); return JSON.parse(JSON.stringify(row)); }
    var r = await this.sb.from(t).update(patch).eq('id', id).select().single(); if (r.error) throw r.error; return r.data;
  },
  remove: async function (t, id) {
    if (DEMO) {
      Demo.data[t] = Demo.data[t].filter(function (x) { return x.id !== id; });
      if (t === 'lists') Demo.data.tasks = Demo.data.tasks.filter(function (x) { return x.list_id !== id; });
      if (t === 'projects') Demo.data.notes = Demo.data.notes.filter(function (x) { return x.project_id !== id; });
      return;
    }
    var r = await this.sb.from(t).delete().eq('id', id); if (r.error) throw r.error;
  }
};

/* ---------- demodata: verzonnen, alleen in ?demo ---------- */
var Demo = { data: null, build: function () {
  var now = new Date().toISOString();
  var labels = DEFAULT_LABELS.map(function (l, i) { return { id: 'lb' + i, name: l[0], color: l[1], sort: i, created_at: now, updated_at: now }; });
  var lists = ['High-prio', 'Privé', 'Project Voorbeeld'].map(function (n, i) { return { id: 'l' + i, name: n, sort: i, created_at: now, updated_at: now }; });
  var T = [
    ['l0', 'Concept-rapport nalopen', ['lb0'], 0, null, []], ['l0', 'Cijfers derde kwartaal verwerken', ['lb0'], 0, 2, []], ['l0', 'Slides businessplan afmaken', ['lb0'], 0, null, []],
    ['l0', 'Balansanalyse opzetten', [], 0, null, []], ['l0', 'Offerte adviseur opvragen', [], 0, -1, []], ['l0', 'Rapport doorsturen naar collega', [], 0, null, []],
    ['l0', 'Agenda teamoverleg rondsturen', [], 1, null, []], ['l0', 'Reiskosten declareren', [], 1, null, []],
    ['l1', 'Verzekering: polis en voorwaarden opvragen', ['lb1'], 0, null, []], ['l1', 'Fiets naar de fietsenmaker', [], 1, null, []], ['l1', 'Cadeau kopen', [], 1, null, []],
    ['l2', 'Kick-off inplannen met het team', [], 0, null, []], ['l2', 'Prijzen toepassen op de P&L', ['lb0'], 0, 5, []], ['l2', 'Akkoord partners ophalen', [], 0, null, []],
    ['l2', 'Businessplan project', ['lb0'], 0, null, ['Marktanalyse', 'Omzetopbouw', 'Kostenstructuur', 'Investeringen', 'Financiering', 'Gevoeligheden', 'Samenvatting', 'Review']],
    ['l2', 'Planning opstellen', [], 1, null, []], ['l2', 'Dataroom inrichten', [], 1, null, []]
  ];
  var tasks = T.map(function (t, i) {
    return { id: 't' + i, list_id: t[0], title: t[1], notes: '', label_ids: t[2], done: !!t[3], done_at: t[3] ? new Date(Date.now() - i * 3600000).toISOString() : null, due_date: t[4] === null ? null : isoDate(addDays(today(), t[4])),
      sort: i, checklist: t[5].map(function (c, j) { return { id: 'c' + i + '-' + j, text: c, done: j === 0 }; }), created_at: now, updated_at: now };
  });
  var projects = ['Project Voorbeeld', 'Kantoor', 'Ideeën'].map(function (n, i) { return { id: 'p' + i, name: n, sort: i, created_at: now, updated_at: now }; });
  var N = [['p0', 'Kick-off', 'Aanwezig: het hele team.\n\nAfspraken\n- Planning rond vóór vrijdag\n- Dataroom staat open vanaf maandag\n- Wekelijks overleg op dinsdag', true, 1], ['p0', 'Vragen voor het management', '1. Hoe is de omzet opgebouwd?\n2. Welke investeringen staan gepland?\n3. Wat zijn de grootste risico\'s?', false, 30],
    ['p0', 'Losse gedachten', 'Marge per vestiging naast elkaar zetten.', false, 60 * 26], ['p1', 'Nieuwe laptop', 'Opties vergelijken en offerte opvragen.', false, 60 * 50], ['p2', 'Onderwerpen voor een blog', '', false, 60 * 200]];
  var notes = N.map(function (n, i) { var t = new Date(Date.now() - n[4] * 60000).toISOString(); return { id: 'n' + i, project_id: n[0], title: n[1], body: n[2], pinned: n[3], created_at: t, updated_at: t }; });
  var D = [['Jaarrekening indienen', 3, '17:00:00', 'Stukken staan klaar in de map.'], ['Offerte verloopt', 9, null, ''], ['Bestuursvergadering', 16, '10:00:00', ''], ['Btw-aangifte', -2, null, '']];
  var deadlines = D.map(function (d, i) { return { id: 'd' + i, title: d[0], due_date: isoDate(addDays(today(), d[1])), due_time: d[2], notes: d[3], done: false, done_at: null, created_at: now, updated_at: now }; });
  this.data = { lists: lists, labels: labels, tasks: tasks, projects: projects, notes: notes, deadlines: deadlines };
} };

/* ============================================================
   STAAT EN AFGELEIDE GEGEVENS
   ============================================================ */
var S = { lists: [], labels: [], tasks: [], projects: [], notes: [], deadlines: [], calMonth: '', loadedAt: 0, q: '', adding: null, openDone: {}, labelFilter: '' };
try { S.openDone = JSON.parse(lsGet('todo.openDone') || '{}') || {}; } catch (e) {}

function bySort(a, b) { return (a.sort - b.sort) || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0); }
function setData(d) {
  S.lists = d.lists; S.labels = d.labels; S.tasks = d.tasks; S.projects = d.projects; S.notes = d.notes; S.deadlines = d.deadlines || [];
  S.tasks.forEach(function (t) { t.checklist = arr(t.checklist); t.label_ids = arr(t.label_ids); });
  S.loadedAt = Date.now(); index();
}
var IX = {};
function index() {
  S.lists.sort(bySort); S.labels.sort(bySort);
  S.projects.sort(function (a, b) { return (a.sort - b.sort) || cmpName(a.name, b.name); });
  IX.list = {}; S.lists.forEach(function (l) { IX.list[l.id] = l; });
  IX.label = {}; S.labels.forEach(function (l) { IX.label[l.id] = l; });
  IX.task = {}; S.tasks.forEach(function (t) { IX.task[t.id] = t; });
  IX.project = {}; S.projects.forEach(function (p) { IX.project[p.id] = p; });
  IX.note = {}; S.notes.forEach(function (n) { IX.note[n.id] = n; });
  IX.deadline = {}; S.deadlines.forEach(function (d) { IX.deadline[d.id] = d; });
}
function taskLabels(t) { return arr(t.label_ids).map(function (id) { return IX.label[id]; }).filter(Boolean).sort(bySort); }
function matchTask(t) {
  if (S.labelFilter && arr(t.label_ids).indexOf(S.labelFilter) < 0) return false;
  if (!S.q) return true;
  var q = norm(S.q);
  return [t.title, t.notes].concat(arr(t.checklist).map(function (c) { return c.text; }), taskLabels(t).map(function (l) { return l.name; })).some(function (v) { return norm(v).indexOf(q) >= 0; });
}
function openTasks(lid, all) { return S.tasks.filter(function (t) { return t.list_id === lid && !t.done && (all || matchTask(t)); }).sort(function (a, b) { return (a.sort - b.sort) || (a.created_at < b.created_at ? 1 : -1); }); }
function doneTasks(lid) { return S.tasks.filter(function (t) { return t.list_id === lid && t.done && matchTask(t); }).sort(function (a, b) { return (a.done_at || '') < (b.done_at || '') ? 1 : -1; }); }
function topSort(lid) { var o = openTasks(lid, true); return o.length ? o[0].sort - 1 : 0; }
function dueCount() { var t = todayIso(); return S.tasks.filter(function (x) { return !x.done && x.due_date && x.due_date <= t; }).length; }
function deadlineCount() { var t = todayIso(); return S.deadlines.filter(function (x) { return !x.done && x.due_date <= t; }).length; }
function notesOf(pid) {
  return S.notes.filter(function (n) { return n.project_id === pid; }).sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0); });
}
function matchNote(n) { var q = norm(S.q); return norm(n.title).indexOf(q) >= 0 || norm(n.body).indexOf(q) >= 0; }
function noteTitle(n) { return (n.title || '').trim() || (n.body || '').trim().split('\n')[0].slice(0, 60) || 'Naamloze notitie'; }

/* ============================================================
   ROUTER EN VIEWS
   ============================================================ */
var route = { view: 'taken', id: null, extra: null };
var rendering = false;
function go(hash) { if (location.hash === '#' + hash) render(); else location.hash = hash; }
function parseHash() {
  var h = location.hash.replace(/^#/, '') || 'taken', p = h.split('/');
  route = { view: p[0], id: p[1] ? decodeURIComponent(p[1]) : null, extra: p[2] ? decodeURIComponent(p[2]) : null };
  if (['taken', 'deadlines', 'notities', 'instellingen'].indexOf(route.view) < 0) route.view = 'taken';
}
function render(keepFocus) {
  parseHash();
  var main = $('#main'), html;
  /* onthoud scrollposities van het bord, de tekst in het invoerveld en (desgewenst) de cursor */
  var keep = { cols: {} }, board = $('#board');
  if (board) { keep.left = board.scrollLeft; $all('.col__body', board).forEach(function (b) { keep.cols[b.dataset.drop] = b.scrollTop; }); }
  var nt = $('#new-task'); if (nt) keep.newTask = nt.value;
  var ae = document.activeElement;
  if (keepFocus && ae && ae.id && main.contains(ae)) { keep.focus = ae.id; try { keep.sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) {} keep.top = ae.scrollTop; }
  $all('.npane__scroll').forEach(function (p, i) { keep['np' + i] = p.scrollTop; });
  try { html = ({ taken: vTaken, deadlines: vDeadlines, notities: vNotities, instellingen: vInstellingen })[route.view](); }
  catch (e) { console.error(e); html = '<section class="container"><div class="actionbar"><h1 class="actionbar__title">Er ging iets mis</h1></div><div class="alert alert--danger">' + icon('alert', 'alert__icon') + '<div class="alert__body">' + esc(e.message) + '</div></div></section>'; }
  rendering = true;
  main.innerHTML = html;
  document.body.dataset.view = route.view;
  $all('[data-nav]').forEach(function (a) {
    var on = a.dataset.nav === route.view;
    a.classList.toggle(a.classList.contains('tabbar__item') ? 'tabbar__item--active' : 'sidenav__item-link--active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  var due = dueCount();
  var dl = deadlineCount();
  $all('[data-count="deadlines"]').forEach(function (b) { b.textContent = dl; b.classList.toggle('hidden', !dl); b.title = 'Vandaag of eerder'; });
  $all('[data-count="taken"]').forEach(function (b) { b.textContent = due; b.classList.toggle('hidden', !due); b.title = 'Vandaag of eerder te doen'; });
  document.title = ({ taken: 'To do\'s', deadlines: 'Deadlines', notities: 'Notities', instellingen: 'Instellingen' })[route.view] + ' · To do';
  board = $('#board');
  if (board) { if (keep.left) board.scrollLeft = keep.left; $all('.col__body', board).forEach(function (b) { if (keep.cols[b.dataset.drop]) b.scrollTop = keep.cols[b.dataset.drop]; }); }
  $all('.npane__scroll').forEach(function (p, i) { if (keep['np' + i]) p.scrollTop = keep['np' + i]; });
  nt = $('#new-task'); if (nt) { if (keep.newTask) nt.value = keep.newTask; nt.focus(); }
  var f = keep.focus ? document.getElementById(keep.focus) : null;
  if (f) { f.focus(); try { f.setSelectionRange(keep.sel[0], keep.sel[1]); } catch (e) {} if (keep.top) f.scrollTop = keep.top; }
  else if (!nt) { var af = $('[data-autofocus]', main); if (af) af.focus(); }
  rendering = false;
}

/* ---------- gedeelde bouwstenen ---------- */
function actionbar(title, actions) { return '<div class="actionbar"><h1 class="actionbar__title">' + esc(title) + '</h1><div class="actionbar__actions">' + (actions || '') + '</div></div>'; }
function emptyState(title, text, btn) { return '<div class="empty"><div class="empty__title">' + esc(title) + '</div><div>' + esc(text) + '</div>' + (btn || '') + '</div>'; }
function fieldRow(label, id, inner, top) { return '<div class="form-input' + (top ? ' form-input--top' : '') + '"><label class="form-input__label" for="' + id + '">' + esc(label) + '</label><div class="form-input__field">' + inner + '</div></div>'; }
function textInput(id, val, opts) {
  opts = opts || {};
  return '<span class="text-field ' + (opts.cls || '') + '"' + (opts.cls === 'text-field--full' ? ' style="width:100%"' : '') + '><input class="text-field__input" id="' + id + '" type="' + (opts.type || 'text') + '" value="' + esc(val || '') + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.af ? ' data-autofocus' : '') + ' autocomplete="off"></span>';
}
function labelChip(l) { return '<span class="lbl lc-' + esc(l.color) + '">' + esc(l.name) + '</span>'; }
function menu(btnCls, label, items, btnInner) {
  return '<div class="drpdwn"><button class="' + btnCls + '" type="button" aria-haspopup="menu" aria-expanded="false" data-drpdwn data-fixed aria-label="' + esc(label) + '" title="' + esc(label) + '">' + (btnInner || icon('dots')) + '</button><div class="drpdwn__menu drpdwn__menu--right" role="menu">' + items + '</div></div>';
}
function menuItem(act, id, ico, text, extra, cls) { return '<button class="drpdwn__item' + (cls ? ' ' + cls : '') + '" role="menuitem" data-act="' + act + '" data-id="' + esc(id) + '"' + (extra || '') + '>' + (ico ? icon(ico) : '<span style="width:14px"></span>') + esc(text) + '</button>'; }

/* ---------- TO DO'S: bord met lijsten ---------- */
function dueHtml(t) {
  if (!t.due_date) return '';
  var n = daysBetween(today(), parseDate(t.due_date));
  var cls = t.done ? '' : n < 0 ? ' tmeta--late' : n === 0 ? ' tmeta--today' : '';
  return '<span class="tmeta' + cls + '" title="Einddatum ' + esc(fmtDate(t.due_date, true)) + '">' + icon('calendar') + esc(n === 0 ? 'vandaag' : n === 1 ? 'morgen' : fmtDate(t.due_date)) + '</span>';
}
function cardHtml(t) {
  var labels = taskLabels(t), cl = arr(t.checklist), clDone = cl.filter(function (c) { return c.done; }).length;
  var meta = (cl.length ? '<span class="tmeta" title="Checklist">' + icon('checklist') + clDone + ' / ' + cl.length + '</span>' : '') + dueHtml(t) + (t.notes ? '<span class="tmeta" title="Heeft notities">' + icon('note') + '</span>' : '');
  var items = menuItem('edit-task', t.id, 'pencil', 'Openen') +
    (S.labels.length ? '<hr class="drpdwn__divider">' + S.labels.map(function (l) { return menuItem('task-label', t.id, arr(t.label_ids).indexOf(l.id) >= 0 ? 'check' : '', l.name, ' data-label="' + esc(l.id) + '"'); }).join('') : '') +
    (S.lists.length > 1 ? '<hr class="drpdwn__divider">' + S.lists.filter(function (l) { return l.id !== t.list_id; }).map(function (l) { return menuItem('move-task', t.id, 'chevron-right', 'Naar ' + l.name, ' data-list="' + esc(l.id) + '"'); }).join('') : '') +
    '<hr class="drpdwn__divider">' + menuItem('delete-task', t.id, 'trash', 'Verwijderen', '', 'drpdwn__item--danger');
  return '<div class="tcard' + (t.done ? ' tcard--done' : '') + '" data-tid="' + esc(t.id) + '" tabindex="0">' +
    (labels.length ? '<div class="tcard__labels">' + labels.map(labelChip).join('') + '</div>' : '') +
    '<div class="tcard__row"><button class="tcheck' + (t.done ? ' tcheck--on' : '') + '" type="button" data-act="toggle-task" data-id="' + esc(t.id) + '" aria-label="' + (t.done ? 'Terugzetten naar niet voltooid' : 'Taak voltooien') + '" title="' + (t.done ? 'Terugzetten' : 'Voltooien') + '">' + icon('check') + '</button>' +
    '<span class="tcard__title">' + esc(t.title) + '</span></div>' +
    (meta ? '<div class="tcard__meta">' + meta + '</div>' : '') +
    menu('tcard__menu', 'Meer opties', items) + '</div>';
}
/* kleur per lijst: High-prio groen, Wachten geel, de overige lijsten op volgorde uit een vast palet */
var LIST_COLORS = ['blauw', 'paars', 'teal', 'roze', 'rood', 'grijs'];
function listColor(l) {
  var n = norm(l.name);
  if (n.indexOf('prio') >= 0) return 'groen';
  if (n.indexOf('wacht') >= 0) return 'geel';
  var rest = S.lists.filter(function (x) { var m = norm(x.name); return m.indexOf('prio') < 0 && m.indexOf('wacht') < 0; });
  return LIST_COLORS[Math.max(0, rest.indexOf(l)) % LIST_COLORS.length];
}
function colHtml(l, i) {
  var open = openTasks(l.id), done = doneTasks(l.id), isOpen = !!S.openDone[l.id] || (!!S.q && done.length > 0);
  var items = menuItem('add-task', l.id, 'plus', 'Taak toevoegen') + menuItem('list-rename', l.id, 'pencil', 'Naam wijzigen') +
    menuItem('list-move', l.id, 'chevron-left', 'Naar links', ' data-dir="-1"' + (i === 0 ? ' disabled' : '')) + menuItem('list-move', l.id, 'chevron-right', 'Naar rechts', ' data-dir="1"' + (i === S.lists.length - 1 ? ' disabled' : '')) +
    '<hr class="drpdwn__divider">' + menuItem('list-delete', l.id, 'trash', 'Lijst verwijderen', '', 'drpdwn__item--danger');
  return '<div class="col col--c lc-' + listColor(l) + '" data-list="' + esc(l.id) + '">' +
    '<div class="col__head"><h2 class="col__title" title="' + esc(l.name) + '"><span class="col__name">' + esc(l.name) + '</span> <span class="col__n">(' + open.length + ')</span></h2>' + menu('col__menu', 'Opties voor deze lijst', items) + '</div>' +
    '<button class="col__add" type="button" data-act="add-task" data-id="' + esc(l.id) + '">' + icon('plus') + 'Taak toevoegen</button>' +
    '<div class="col__body" data-drop="' + esc(l.id) + '">' +
    (S.adding === l.id ? '<div class="tcard tcard--new"><div class="tcard__row"><span class="tcheck tcheck--ghost"></span><input id="new-task" class="tcard__input" type="text" data-list="' + esc(l.id) + '" placeholder="Voer een taaknaam in" autocomplete="off" enterkeyhint="done"></div>' +
      '<div class="tcard__newbar"><button class="btn" type="button" data-act="add-cancel"><span class="btn__text">Sluiten</span></button><button class="btn btn--primary" type="button" data-act="add-confirm" data-id="' + esc(l.id) + '"><span class="btn__text">Toevoegen</span></button></div></div>' : '') +
    open.map(cardHtml).join('') +
    (done.length ? '<button class="col__done" type="button" data-act="toggle-done" data-id="' + esc(l.id) + '" aria-expanded="' + isOpen + '">' + icon(isOpen ? 'chevron-down' : 'chevron-right') + '<span>Voltooide taken</span><span class="col__done-n">' + done.length + '</span></button>' + (isOpen ? done.map(cardHtml).join('') : '') : '') +
    '</div></div>';
}
function vTaken() {
  var filter = S.labels.length ? '<div class="board-bar__filter" role="group" aria-label="Filter op label"><button class="fpill' + (!S.labelFilter ? ' fpill--on' : '') + '" type="button" data-act="label-filter" data-id="">Alles</button>' +
    S.labels.map(function (l) { return '<button class="fpill lc-' + esc(l.color) + (S.labelFilter === l.id ? ' fpill--on' : '') + '" type="button" data-act="label-filter" data-id="' + esc(l.id) + '">' + esc(l.name) + '</button>'; }).join('') + '</div>' : '';
  var totalOpen = S.tasks.filter(function (t) { return !t.done; }).length;
  return '<section class="board-page"><div class="board-bar"><h1 class="board-bar__title">To do\'s</h1>' + filter +
    '<span class="board-bar__search only-m text-field filter-search">' + icon('search') + '<input class="text-field__input" type="search" id="q-m" data-q placeholder="Zoek een taak" value="' + esc(S.q) + '"></span>' +
    '<span class="board-bar__count muted">' + (S.q || S.labelFilter ? 'Gefilterd · ' : '') + plural(totalOpen, 'open taak', 'open taken') + '</span></div>' +
    '<div class="board" id="board">' + S.lists.map(colHtml).join('') +
    '<div class="col col--new"><button class="col__newlist" type="button" data-act="new-list">' + icon('plus') + 'Nieuwe lijst</button></div></div></section>';
}

/* ---------- DEADLINES: maandkalender met losse deadlines en to do's met een einddatum ---------- */
var MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
var DAYS_SHORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
function fmtTime(t) { return t ? String(t).slice(0, 5) : ''; }
/* alles wat op de kalender hoort: { kind: 'deadline' | 'task', id, title, date, time, done, color } */
function calItems() {
  var q = norm(S.q), out = [];
  S.deadlines.forEach(function (d) { out.push({ kind: 'deadline', id: d.id, title: d.title, date: d.due_date, time: fmtTime(d.due_time), done: !!d.done, notes: d.notes || '', color: 'rood', sub: 'Deadline' }); });
  S.tasks.forEach(function (t) { if (!t.due_date) return; var l = IX.list[t.list_id]; out.push({ kind: 'task', id: t.id, title: t.title, date: t.due_date, time: '', done: !!t.done, notes: t.notes || '', color: l ? listColor(l) : 'grijs', sub: 'To do' + (l ? ' · ' + l.name : '') }); });
  if (q) out = out.filter(function (x) { return norm(x.title).indexOf(q) >= 0 || norm(x.notes).indexOf(q) >= 0; });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : cmpName(a.title, b.title); });
}
function calChip(x) {
  return '<button type="button" class="cchip lc-' + esc(x.color) + ' cchip--' + x.kind + (x.done ? ' cchip--done' : '') + '" data-act="' + (x.kind === 'task' ? 'edit-task' : 'edit-deadline') + '" data-id="' + esc(x.id) + '" title="' + esc(x.sub + ': ' + x.title) + '">' +
    icon(x.kind === 'task' ? 'check-circle' : 'clock', 'icon--12') + (x.time ? '<span class="cchip__time">' + esc(x.time) + '</span>' : '') + '<span class="cchip__text">' + esc(x.title) + '</span></button>';
}
function agendaRow(x) {
  var n = daysBetween(today(), parseDate(x.date)), d = parseDate(x.date);
  var when = n === 0 ? 'Vandaag' : n === 1 ? 'Morgen' : n === -1 ? 'Gisteren' : DAYS_LONG[d.getDay()].slice(0, 2) + ' ' + fmtDate(x.date, d.getFullYear() !== today().getFullYear());
  return '<div class="arow' + (x.done ? ' arow--done' : n < 0 ? ' arow--late' : n === 0 ? ' arow--today' : '') + '">' +
    '<button type="button" class="tcheck' + (x.done ? ' tcheck--on' : '') + '" data-act="' + (x.kind === 'task' ? 'toggle-task' : 'toggle-deadline') + '" data-id="' + esc(x.id) + '" aria-label="' + (x.done ? 'Terugzetten' : 'Afvinken') + '">' + icon('check') + '</button>' +
    '<button type="button" class="arow__main" data-act="' + (x.kind === 'task' ? 'edit-task' : 'edit-deadline') + '" data-id="' + esc(x.id) + '"><span class="arow__title">' + esc(x.title) + '</span>' +
    '<span class="arow__meta"><span class="arow__when">' + esc(when + (x.time ? ' · ' + x.time : '')) + '</span><span class="lbl lc-' + esc(x.color) + '">' + esc(x.sub) + '</span></span></button></div>';
}
function vDeadlines() {
  var t0 = today(), ym = /^\d{4}-\d{2}$/.test(S.calMonth) ? S.calMonth : isoDate(t0).slice(0, 7);
  var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1, first = new Date(y, m, 1);
  var start = addDays(first, -((first.getDay() + 6) % 7)), items = calItems(), byDay = {};
  items.forEach(function (x) { (byDay[x.date] = byDay[x.date] || []).push(x); });
  var weeks = Math.ceil((((first.getDay() + 6) % 7) + new Date(y, m + 1, 0).getDate()) / 7), cells = '';
  for (var i = 0; i < weeks * 7; i++) {
    var d = addDays(start, i), iso = isoDate(d), list = byDay[iso] || [], max = 3;
    cells += '<div class="cday' + (d.getMonth() !== m ? ' cday--out' : '') + (iso === isoDate(t0) ? ' cday--today' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' cday--we' : '') + '" data-day="' + iso + '">' +
      '<div class="cday__head"><span class="cday__num">' + d.getDate() + '</span>' + (list.length ? '<span class="cday__dots">' + list.slice(0, 4).map(function (x) { return '<i class="lc-' + esc(x.color) + '"></i>'; }).join('') + '</span>' : '') +
      '<button type="button" class="cday__add" data-act="new-deadline" data-date="' + iso + '" aria-label="Deadline toevoegen op ' + esc(fmtDate(iso, true)) + '" title="Deadline toevoegen">' + icon('plus', 'icon--12') + '</button></div>' +
      '<div class="cday__items">' + list.slice(0, list.length > max ? max - 1 : max).map(calChip).join('') + (list.length > max ? '<span class="cday__more">+ ' + (list.length - max + 1) + ' meer</span>' : '') + '</div></div>';
  }
  var todayS = isoDate(t0), late = items.filter(function (x) { return !x.done && x.date < todayS; }), next = items.filter(function (x) { return !x.done && x.date >= todayS; });
  var monthDone = items.filter(function (x) { return x.done && x.date.slice(0, 7) === ym; });
  var agenda = (late.length ? '<h3 class="agenda__h agenda__h--late">Verlopen</h3>' + late.map(agendaRow).join('') : '') +
    '<h3 class="agenda__h">Komend</h3>' + (next.length ? next.map(agendaRow).join('') : '<p class="muted agenda__empty">' + (S.q ? 'Niets gevonden.' : 'Geen komende deadlines.') + '</p>') +
    (monthDone.length ? '<h3 class="agenda__h">Afgerond in ' + esc(MONTHS_LONG[m]) + '</h3>' + monthDone.map(agendaRow).join('') : '');
  return '<section class="cal-page"><div class="board-bar"><h1 class="board-bar__title">Deadlines</h1>' +
    '<div class="cal-nav"><button class="btn btn--icon-only" type="button" data-act="cal-move" data-dir="-1" aria-label="Vorige maand">' + icon('chevron-left') + '</button>' +
    '<button class="btn" type="button" data-act="cal-today"><span class="btn__text">Vandaag</span></button>' +
    '<button class="btn btn--icon-only" type="button" data-act="cal-move" data-dir="1" aria-label="Volgende maand">' + icon('chevron-right') + '</button>' +
    '<span class="cal-nav__month">' + esc(MONTHS_LONG[m] + ' ' + y) + '</span></div>' +
    '<button class="btn btn--primary cal-new" type="button" data-act="new-deadline">' + icon('plus', 'icon--14') + '<span class="btn__text">Deadline</span></button></div>' +
    '<div class="cal-wrap"><div class="cal"><div class="cal__dow">' + DAYS_SHORT.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div><div class="cal__grid" style="grid-template-rows:repeat(' + weeks + ',minmax(0,1fr))">' + cells + '</div>' +
    '<div class="cal__legend"><span>' + icon('clock', 'icon--12') + 'Losse deadline</span><span>' + icon('check-circle', 'icon--12') + 'To do met einddatum (kleur van de lijst)</span></div></div>' +
    '<aside class="agenda">' + agenda + '</aside></div></section>';
}
function deadlineDialog(d) {
  var isNew = !d.id;
  var body = fieldRow('Deadline', 'd-title', textInput('d-title', d.title, { cls: 'text-field--full', af: isNew, ph: 'Waar gaat het om?' })) +
    fieldRow('Datum', 'd-date', textInput('d-date', d.due_date || '', { type: 'date' })) +
    fieldRow('Tijd', 'd-time', textInput('d-time', fmtTime(d.due_time), { type: 'time' }) + '<span class="muted">optioneel</span>') +
    (isNew ? '' : fieldRow('Afgerond', 'd-done', '<input type="checkbox" class="cl-check" id="d-done"' + (d.done ? ' checked' : '') + '>')) +
    '<div class="tsec"><label class="tsec__title" for="t-notes">' + icon('note') + 'Notities</label><textarea class="textarea tnotes" id="t-notes" placeholder="Typ een toelichting">' + esc(d.notes || '') + '</textarea></div>' +
    '<p class="tsec__hint" style="margin-left:0">Een losse deadline staat alleen in de kalender, niet op het to do-bord.</p>';
  function valid() { var a = !!$('#d-title').value.trim(), b = !!$('#d-date').value; $('#d-title').parentNode.classList.toggle('text-field--error', !a); $('#d-date').parentNode.classList.toggle('text-field--error', !b); if (!a) $('#d-title').focus(); else if (!b) $('#d-date').focus(); return a && b; }
  var buttons = [{ label: isNew ? 'Toevoegen' : 'Opslaan', cls: 'btn--primary', validate: valid }, { label: 'Annuleren', cancel: true }];
  if (!isNew) buttons.push({ label: 'Verwijderen', cls: 'btn--danger', value: 'delete' });
  var p = openPopup({ side: true, title: isNew ? 'Nieuwe deadline' : 'Deadline', body: body, buttons: buttons, collect: function () {
    var done = $('#d-done') ? $('#d-done').checked : false;
    return { title: $('#d-title').value.trim(), due_date: $('#d-date').value, due_time: $('#d-time').value ? $('#d-time').value.slice(0, 5) + ':00' : null, notes: $('#t-notes').value.trim() || null, done: done, done_at: done ? (d.done_at || new Date().toISOString()) : null };
  } });
  autoGrow($('#t-notes'));
  return p;
}

/* ---------- NOTITIES: projecten · notities · editor ---------- */
function notesSel() {
  var mobile = isMobile();
  var pid = route.id && IX.project[route.id] ? route.id : null;
  if (!pid && !mobile) { var last = lsGet('todo.project'); pid = last && IX.project[last] ? last : (S.projects[0] ? S.projects[0].id : null); }
  var nid = route.extra && IX.note[route.extra] && IX.note[route.extra].project_id === pid ? route.extra : null;
  if (!nid && !mobile && pid) { var l = notesOf(pid); nid = l[0] ? l[0].id : null; }
  return { pid: pid, nid: nid, depth: nid && route.extra ? 2 : pid && route.id ? 1 : 0 };
}
function noteItemHtml(n, sel, withProject) {
  var snippet = (n.body || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  return '<a class="nitem' + (n.id === sel ? ' nitem--on' : '') + '" href="#notities/' + esc(n.project_id) + '/' + esc(n.id) + '"><span class="nitem__title">' + (n.pinned ? icon('tack', 'icon--12') : '') + '<span>' + esc(noteTitle(n)) + '</span></span>' +
    '<span class="nitem__snippet">' + esc(snippet || 'Nog geen tekst') + '</span><span class="nitem__date">' + esc(fmtStamp(n.updated_at)) + (withProject && IX.project[n.project_id] ? ' · ' + esc(IX.project[n.project_id].name) : '') + '</span></a>';
}
function noteListHtml(sel) {
  if (S.q) {
    var hits = S.notes.filter(matchNote).sort(function (a, b) { return a.updated_at < b.updated_at ? 1 : -1; });
    return hits.length ? hits.map(function (n) { return noteItemHtml(n, sel.nid, true); }).join('') : emptyState('Niets gevonden', 'Geen notitie met "' + S.q + '".');
  }
  if (!sel.pid) return '';
  var list = notesOf(sel.pid);
  return list.length ? list.map(function (n) { return noteItemHtml(n, sel.nid); }).join('') : emptyState('Nog geen notities', 'Begin met typen in een nieuwe notitie.', '<button class="btn btn--primary" type="button" data-act="new-note">' + icon('plus', 'icon--14') + '<span class="btn__text">Nieuwe notitie</span></button>');
}
function vNotities() {
  var sel = notesSel(), p = sel.pid ? IX.project[sel.pid] : null, n = sel.nid ? IX.note[sel.nid] : null;
  if (p) lsSet('todo.project', p.id);
  var projects = S.projects.length ? S.projects.map(function (x) {
    var c = S.notes.filter(function (y) { return y.project_id === x.id; }).length;
    return '<a class="nproj' + (p && x.id === p.id ? ' nproj--on' : '') + '" href="#notities/' + esc(x.id) + '">' + icon('folder') + '<span class="nproj__name">' + esc(x.name) + '</span><span class="nproj__n">' + c + '</span></a>';
  }).join('') : emptyState('Nog geen projecten', 'Maak een project aan om er notities in te bewaren.', '<button class="btn btn--primary" type="button" data-act="new-project">' + icon('plus', 'icon--14') + '<span class="btn__text">Nieuw project</span></button>');
  var pItems = p ? menuItem('project-rename', p.id, 'pencil', 'Naam wijzigen') + menuItem('project-move', p.id, 'chevron-up', 'Omhoog', ' data-dir="-1"' + (S.projects[0] === p ? ' disabled' : '')) + menuItem('project-move', p.id, 'chevron-down', 'Omlaag', ' data-dir="1"' + (S.projects[S.projects.length - 1] === p ? ' disabled' : '')) +
    '<hr class="drpdwn__divider">' + menuItem('project-delete', p.id, 'trash', 'Project verwijderen', '', 'drpdwn__item--danger') : '';
  var editor = n ? '<div class="npane__head npane__head--editor"><a class="btn btn--icon-only only-m" href="#notities/' + esc(n.project_id) + '" aria-label="Terug">' + icon('chevron-left') + '</a>' +
      '<span class="nstatus" id="note-status" aria-live="polite">' + (NS.dirty && NS.id === n.id ? 'Opslaan…' : 'Laatst gewijzigd ' + esc(fmtStamp(n.updated_at))) + '</span>' +
      '<button class="btn compact' + (n.pinned ? ' btn--pinned' : '') + '" type="button" data-act="note-pin" data-id="' + esc(n.id) + '" title="' + (n.pinned ? 'Losmaken' : 'Bovenaan vastzetten') + '">' + icon('tack', 'icon--14') + '<span class="btn__text">' + (n.pinned ? 'Vastgezet' : 'Vastzetten') + '</span></button>' +
      menu('btn btn--icon-only compact', 'Meer opties', S.projects.filter(function (x) { return x.id !== n.project_id; }).map(function (x) { return menuItem('note-move', n.id, 'folder', 'Naar ' + x.name, ' data-project="' + esc(x.id) + '"'); }).join('') + (S.projects.length > 1 ? '<hr class="drpdwn__divider">' : '') + menuItem('note-delete', n.id, 'trash', 'Notitie verwijderen', '', 'drpdwn__item--danger')) + '</div>' +
      '<input class="neditor__title" id="note-title" type="text" data-note="' + esc(n.id) + '" value="' + esc(n.title) + '" placeholder="Titel" autocomplete="off"' + (!n.title && !n.body ? ' data-autofocus' : '') + '>' +
      '<textarea class="neditor__body" id="note-body" data-note="' + esc(n.id) + '" placeholder="Typ hier je notities…">' + esc(n.body) + '</textarea>'
    : '<div class="npane__empty">' + (p ? emptyState('Geen notitie geopend', 'Kies links een notitie of maak een nieuwe.', '<button class="btn btn--primary" type="button" data-act="new-note">' + icon('plus', 'icon--14') + '<span class="btn__text">Nieuwe notitie</span></button>') : emptyState('Notities per project', 'Maak eerst een project aan.')) + '</div>';
  return '<section class="notes notes--d' + sel.depth + '">' +
    '<div class="npane npane--projects"><div class="npane__head"><h1 class="npane__title">Projecten</h1><button class="btn btn--icon-only compact" type="button" data-act="new-project" title="Nieuw project" aria-label="Nieuw project">' + icon('plus') + '</button></div>' +
    '<div class="npane__scroll">' + projects + '</div></div>' +
    '<div class="npane npane--list"><div class="npane__head"><a class="btn btn--icon-only only-m" href="#notities" aria-label="Terug naar projecten">' + icon('chevron-left') + '</a><h2 class="npane__title">' + esc(S.q ? 'Zoekresultaten' : p ? p.name : 'Notities') + '</h2>' +
    (p && !S.q ? menu('btn btn--icon-only compact', 'Opties voor dit project', pItems) : '') +
    (p ? '<button class="btn btn--primary compact" type="button" data-act="new-note" title="Nieuwe notitie">' + icon('plus', 'icon--14') + '<span class="btn__text">Notitie</span></button>' : '') + '</div>' +
    '<span class="only-m text-field filter-search npane__search">' + icon('search') + '<input class="text-field__input" type="search" id="q-n" data-q placeholder="Zoek in alle notities" value="' + esc(S.q) + '"></span>' +
    '<div class="npane__scroll" id="note-list">' + noteListHtml(sel) + '</div></div>' +
    '<div class="npane npane--editor">' + editor + '</div></section>';
}
/* automatisch opslaan van de geopende notitie */
var NS = { id: null, timer: null, dirty: false };
function setNoteStatus(txt) { var el = $('#note-status'); if (el) el.textContent = txt; }
function noteInput(el) {
  var n = IX.note[el.dataset.note]; if (!n) return;
  if (NS.dirty && NS.id && NS.id !== n.id) saveNote();
  if (el.id === 'note-title') n.title = el.value; else n.body = el.value;
  n.updated_at = new Date().toISOString();
  NS.id = n.id; NS.dirty = true; dirty = true; setNoteStatus('Opslaan…');
  clearTimeout(NS.timer); NS.timer = setTimeout(saveNote, 800);
  var list = $('#note-list'); if (list && !S.q) { var top = list.scrollTop; list.innerHTML = noteListHtml(notesSel()); list.scrollTop = top; }
}
async function saveNote() {
  clearTimeout(NS.timer); NS.timer = null;
  var id = NS.id, n = id ? IX.note[id] : null;
  if (!NS.dirty || !n) { NS.dirty = false; dirty = false; return; }
  NS.dirty = false;
  try {
    var u = await Store.update('notes', id, { title: n.title, body: n.body });
    if (!NS.dirty) { n.updated_at = u.updated_at; dirty = false; if ($('#note-title') && $('#note-title').dataset.note === id) setNoteStatus('Opgeslagen'); }
  } catch (e) { NS.dirty = true; dirty = true; fail(e); setNoteStatus('Niet opgeslagen'); }
}
function flushNote() { return NS.dirty ? saveNote() : Promise.resolve(); }

/* ---------- INSTELLINGEN ---------- */
function vInstellingen() {
  var labels = S.labels.map(function (l) {
    var n = S.tasks.filter(function (t) { return arr(t.label_ids).indexOf(l.id) >= 0; }).length;
    return '<div class="type-row"><span class="lbl lbl--dot lc-' + esc(l.color) + '" aria-hidden="true"></span><span class="text-field"><input class="text-field__input" type="text" value="' + esc(l.name) + '" data-label-name="' + esc(l.id) + '" aria-label="Naam label"></span>' +
      '<select class="select" style="width:110px" data-label-color="' + esc(l.id) + '" aria-label="Kleur">' + COLORS.map(function (c) { return '<option value="' + c + '"' + (c === l.color ? ' selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select>' +
      '<span class="type-row__count">' + plural(n, 'taak', 'taken') + '</span>' +
      '<button class="btn btn--icon-only compact" type="button" data-act="label-delete" data-id="' + esc(l.id) + '" aria-label="Verwijderen">' + icon('trash', 'icon--14') + '</button></div>';
  }).join('');
  return '<section class="container"><div class="main-column">' + actionbar('Instellingen') +
    '<div class="base-container base-container--padding">' +
    '<fieldset class="fieldset"><div class="fieldset__header">' + icon('check-circle') + 'Labels</div>' + labels +
    '<div class="type-row mt16"><span class="lbl lbl--dot" style="visibility:hidden"></span><span class="text-field"><input class="text-field__input" type="text" id="new-label" placeholder="Nieuw label, bijv. Bellen"></span><button class="btn compact" type="button" data-act="label-add">' + icon('plus', 'icon--14') + '<span class="btn__text">Toevoegen</span></button></div>' +
    '<p class="form-input__hint">Labels zet je op een taak via de drie puntjes op de kaart of in het taakvenster.</p></fieldset>' +
    '<fieldset class="fieldset"><div class="fieldset__header">' + icon('download') + 'Gegevens</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn" type="button" data-act="export">' + icon('download', 'icon--14') + '<span class="btn__text">Exporteren (JSON)</span></button></div>' +
    '<p class="form-input__hint">De export is een back-up van alle lijsten, taken, projecten en notities.</p></fieldset>' +
    '<fieldset class="fieldset" style="margin-bottom:0"><div class="fieldset__header">' + icon('user') + 'Account</div>' +
    fieldRow('Je naam', 'display-name', '<span class="text-field text-field--wide"><input class="text-field__input" type="text" id="display-name" maxlength="40" value="' + esc(displayName()) + '" placeholder="Bijv. Ralph" data-act-change="display-name" autocomplete="given-name"></span>') +
    '<div class="kv mt16" style="max-width:480px"><dt>Ingelogd als</dt><dd>' + esc(Store.user ? Store.user.email : '') + '</dd><dt>Database</dt><dd>' + (DEMO ? 'Demo (niets wordt opgeslagen)' : 'Supabase') + '</dd></div>' +
    '<div class="mt16"><button class="btn" type="button" data-act="logout">' + icon('logout', 'icon--14') + '<span class="btn__text">Uitloggen</span></button></div></fieldset>' +
    '</div></div></section>';
}
function displayName() { var m = Store.user && Store.user.user_metadata; return m && m.display_name ? String(m.display_name).trim() : ''; }
function showUserName() { $('#user-name').textContent = displayName() || (Store.user ? Store.user.email : ''); }

/* ============================================================
   DIALOGEN EN MELDINGEN
   ============================================================ */
var popupCancel = null;
/* geeft null bij annuleren, anders { button, value, data } */
function openPopup(opts) {
  var el = $('#popup');
  el.classList.toggle('popup--small', !!opts.small); el.classList.toggle('popup--side', !!opts.side);
  $('#popup-title').textContent = opts.title;
  $('#popup-body').innerHTML = opts.body;
  $('#popup-footer').innerHTML = (opts.buttons || []).map(function (b, i) { return '<button class="btn ' + (b.cls || '') + '" type="button" data-pbtn="' + i + '"><span class="btn__text">' + esc(b.label) + '</span></button>'; }).join('');
  $('#overlay').classList.add('overlay--open'); el.classList.add('popup--open');
  var f = $('[data-autofocus]', el) || $('input,select,textarea', el); if (f) setTimeout(function () { f.focus(); if (f.select && opts.select) f.select(); }, 30);
  return new Promise(function (res) {
    popupCancel = function () { res(null); };
    $all('[data-pbtn]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.pbtn, btn = opts.buttons[i];
        if (btn.cancel) { closePopup(); res(null); return; }
        if (btn.validate && !btn.validate()) return;
        var data = opts.collect ? opts.collect() : null;
        closePopup(); res({ button: i, value: btn.value, data: data });
      });
    });
  });
}
function closePopup() { $('#overlay').classList.remove('overlay--open'); $('#popup').classList.remove('popup--open'); popupCancel = null; }
function cancelPopup() { var r = popupCancel; closePopup(); if (r) r(); }
function popupOpen() { return $('#popup').classList.contains('popup--open'); }
function confirmPopup(title, text, okLabel) {
  return openPopup({ small: true, title: title, body: '<p class="muted" style="text-align:center">' + esc(text) + '</p>', buttons: [{ label: okLabel, cls: 'btn--danger' }, { label: 'Annuleren', cancel: true }] }).then(function (r) { return !!r; });
}
function promptText(title, value, okLabel, ph) {
  return openPopup({ small: true, select: true, title: title, body: '<span class="text-field text-field--full" style="width:100%"><input class="text-field__input" id="p-text" type="text" value="' + esc(value || '') + '" placeholder="' + esc(ph || '') + '" data-autofocus autocomplete="off"></span>',
    buttons: [{ label: okLabel || 'Opslaan', cls: 'btn--primary', validate: function () { var ok = !!$('#p-text').value.trim(); $('#p-text').parentNode.classList.toggle('text-field--error', !ok); if (!ok) $('#p-text').focus(); return ok; } }, { label: 'Annuleren', cancel: true }],
    collect: function () { return $('#p-text').value.trim(); } }).then(function (r) { return r ? r.data : null; });
}
var toastTimer;
function toast(msg, kind) {
  var t = $('#toast');
  t.className = 'alert toast alert--' + (kind || 'success');
  t.innerHTML = icon(kind === 'danger' ? 'alert' : 'check-circle', 'alert__icon') + '<span class="alert__body">' + esc(msg) + '</span>';
  requestAnimationFrame(function () { t.classList.add('toast--open'); });
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('toast--open'); }, kind === 'danger' ? 6000 : 2400);
}
function fail(e) { console.error(e); toast('Niet opgeslagen: ' + (e && e.message ? e.message : e), 'danger'); }

/* taakvenster: titel, lijst, labels, einddatum, notities en checklist */
function clRowHtml(c) {
  return '<div class="cl-row' + (c.indent ? ' cl-row--sub' : '') + '" data-clid="' + esc(c.id) + '"><input type="checkbox" class="cl-check"' + (c.done ? ' checked' : '') + ' aria-label="Afgerond"><input class="text-field__input cl-text" type="text" value="' + esc(c.text) + '" aria-label="Checklist-item" autocomplete="off">' +
    '<button class="btn btn--icon-only compact cl-x cl-in" type="button" data-cl-indent aria-label="Sub to do aan of uit" title="Sub to do aan of uit (Tab)">' + icon('chevron-right', 'icon--14') + '</button>' +
    '<button class="btn btn--icon-only compact cl-x" type="button" data-cl-remove aria-label="Item verwijderen" title="Verwijderen">' + icon('x', 'icon--14') + '</button></div>';
}
function clCount() { var rows = $all('#t-cl .cl-row'), el = $('#t-cl-count'); if (el) el.textContent = rows.length ? rows.filter(function (r) { return $('.cl-check', r).checked; }).length + ' / ' + rows.length : ''; }
/* sub to do: een item springt in onder het item erboven; het eerste item kan niet inspringen */
function clIndent(row, on) {
  if (!row || row.classList.contains('cl-row--new')) return;
  if (on === undefined) on = !row.classList.contains('cl-row--sub');
  if (on && !row.previousElementSibling) on = false;
  row.classList.toggle('cl-row--sub', on);
  var first = $('#t-cl .cl-row'); if (first) first.classList.remove('cl-row--sub');
}
function clInsertAfter(row) {
  var sub = row.classList.contains('cl-row--sub');
  row.insertAdjacentHTML('afterend', clRowHtml({ id: uid(), text: '', done: false, indent: sub ? 1 : 0 }));
  $('.cl-text', row.nextElementSibling).focus(); clCount();
}
function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight + 2, 140) + 'px'; }
function clAdd() {
  var inp = $('#cl-new'), v = inp.value.trim(); if (!v) return;
  var last = $all('#t-cl .cl-row').pop(), sub = !!S.clNewSub && !!last;
  $('#t-cl').insertAdjacentHTML('beforeend', clRowHtml({ id: uid(), text: v, done: false, indent: sub ? 1 : 0 })); inp.value = ''; inp.focus(); clCount();
  inp.scrollIntoView({ block: 'nearest' });
}
function taskDialog(t) {
  var isNew = !t.id;
  var body = fieldRow('Taak', 't-title', textInput('t-title', t.title, { cls: 'text-field--full', af: isNew, ph: 'Voer een taaknaam in' })) +
    fieldRow('Lijst', 't-list', '<select class="select" id="t-list">' + S.lists.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === t.list_id ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select>') +
    (S.labels.length ? fieldRow('Labels', 't-labels', '<div class="chips" id="t-labels">' + S.labels.map(function (l) { var on = arr(t.label_ids).indexOf(l.id) >= 0; return '<button type="button" class="lbl lbl--pick lc-' + esc(l.color) + (on ? ' lbl--on' : '') + '" data-lblpick="' + esc(l.id) + '" aria-pressed="' + on + '">' + icon('check', 'icon--12') + esc(l.name) + '</button>'; }).join('') + '</div>') : '') +
    fieldRow('Einddatum', 't-due', textInput('t-due', t.due_date || '', { type: 'date' })) +
    '<div class="tsec"><label class="tsec__title" for="cl-new">' + icon('checklist') + 'Checklist <span class="muted" id="t-cl-count" style="font-weight:400"></span></label><div class="cl"><div id="t-cl">' + arr(t.checklist).map(clRowHtml).join('') + '</div>' +
    '<div class="cl-row cl-row--new"><span class="cl-plus">' + icon('plus', 'icon--14') + '</span><input class="text-field__input cl-text" id="cl-new" type="text" placeholder="Item toevoegen" autocomplete="off" enterkeyhint="done"></div>' +
    '<p class="tsec__hint">Enter voegt een item toe. Tab maakt van een item een sub to do, Shift+Tab zet het terug.</p></div></div>' +
    '<div class="tsec"><label class="tsec__title" for="t-notes">' + icon('note') + 'Notities</label><textarea class="textarea tnotes" id="t-notes" placeholder="Typ een beschrijving of notities">' + esc(t.notes || '') + '</textarea></div>';
  var buttons = [{ label: isNew ? 'Toevoegen' : 'Opslaan', cls: 'btn--primary', validate: function () { var ok = !!$('#t-title').value.trim(); $('#t-title').parentNode.classList.toggle('text-field--error', !ok); if (!ok) $('#t-title').focus(); return ok; } }, { label: 'Annuleren', cancel: true }];
  if (!isNew) buttons.push({ label: 'Verwijderen', cls: 'btn--danger', value: 'delete' });
  S.clNewSub = false;
  var p = openPopup({ side: true, title: isNew ? 'Nieuwe taak' : 'Taak', body: body, buttons: buttons, collect: function () {
    clAdd();
    return { title: $('#t-title').value.trim(), list_id: $('#t-list').value, due_date: $('#t-due').value || null, notes: $('#t-notes').value.trim() || null,
      label_ids: $all('#t-labels .lbl--on').map(function (b) { return b.dataset.lblpick; }),
      checklist: $all('#t-cl .cl-row').map(function (r) { return { id: r.dataset.clid, text: $('.cl-text', r).value.trim(), done: $('.cl-check', r).checked, indent: r.classList.contains('cl-row--sub') ? 1 : 0 }; }).filter(function (c) { return c.text; }).map(function (c, i) { if (!i) c.indent = 0; return c; }) };
  } });
  clCount(); autoGrow($('#t-notes')); setTimeout(function () { autoGrow($('#t-notes')); }, 60);
  return p;
}

/* ============================================================
   ACTIES
   ============================================================ */
async function reload(silent) {
  try { setData(await Store.loadAll()); render(true); }
  catch (e) { if (!silent) fail(e); }
}
/* taken */
async function actQuickAdd(lid, title) {
  title = (title || '').trim(); if (!title || !IX.list[lid]) return;
  var inp = $('#new-task'); if (inp) inp.value = '';
  try { S.tasks.push(await Store.insert('tasks', { list_id: lid, title: title, sort: topSort(lid), label_ids: [], checklist: [] })); index(); render(); } catch (e) { if (inp) inp.value = title; fail(e); }
}
async function actToggleTask(id) {
  var t = IX.task[id]; if (!t) return;
  var before = { done: t.done, done_at: t.done_at, sort: t.sort };
  var patch = { done: !t.done, done_at: t.done ? null : new Date().toISOString() };
  if (t.done) patch.sort = topSort(t.list_id);
  Object.assign(t, patch); render();
  try { Object.assign(t, await Store.update('tasks', id, patch)); } catch (e) { Object.assign(t, before); render(); fail(e); }
}
async function patchTask(id, patch, msg) {
  var t = IX.task[id]; if (!t) return;
  try { Object.assign(t, await Store.update('tasks', id, patch)); t.checklist = arr(t.checklist); t.label_ids = arr(t.label_ids); index(); render(); if (msg) toast(msg); } catch (e) { fail(e); }
}
async function actNewTask(lid) {
  if (!S.lists.length) { var l = await actNewList(); if (!l) return; }
  lid = lid && IX.list[lid] ? lid : S.lists[0].id;
  var r = await taskDialog({ list_id: lid, title: '', label_ids: S.labelFilter ? [S.labelFilter] : [], checklist: [] });
  if (!r) return;
  try { S.tasks.push(await Store.insert('tasks', Object.assign({ sort: topSort(r.data.list_id) }, r.data))); index(); if (route.view !== 'taken') go('taken'); else render(); toast('Taak toegevoegd.'); } catch (e) { fail(e); }
}
async function actEditTask(id) {
  var t = IX.task[id]; if (!t) return;
  var r = await taskDialog(t);
  if (!r) return;
  if (r.value === 'delete') return actDeleteTask(id);
  var patch = r.data;
  if (patch.list_id !== t.list_id) patch.sort = topSort(patch.list_id);
  patchTask(id, patch);
}
async function actDeleteTask(id) {
  var t = IX.task[id]; if (!t) return;
  if (!(await confirmPopup('Taak verwijderen?', '"' + t.title + '" wordt definitief verwijderd.', 'Verwijderen'))) return;
  try { await Store.remove('tasks', id); S.tasks = S.tasks.filter(function (x) { return x.id !== id; }); index(); render(); toast('Taak verwijderd.'); } catch (e) { fail(e); }
}
function actTaskLabel(id, lab) {
  var t = IX.task[id]; if (!t) return;
  var ids = arr(t.label_ids).filter(function (x) { return IX.label[x]; }), i = ids.indexOf(lab);
  if (i >= 0) ids.splice(i, 1); else ids.push(lab);
  patchTask(id, { label_ids: ids });
}
/* sleep-doel: vóór taak beforeId in lijst lid, of onderaan als beforeId leeg is */
function actMoveTask(id, lid, beforeId) {
  var t = IX.task[id]; if (!t || !IX.list[lid]) return;
  var open = openTasks(lid, true).filter(function (x) { return x.id !== id; });
  var idx = beforeId ? open.findIndex(function (x) { return x.id === beforeId; }) : open.length; if (idx < 0) idx = open.length;
  var prev = open[idx - 1], next = open[idx];
  var sort = !prev && !next ? 0 : !prev ? next.sort - 1 : !next ? prev.sort + 1 : (prev.sort + next.sort) / 2;
  if (t.list_id === lid && t.sort === sort) return;
  var before = { list_id: t.list_id, sort: t.sort };
  Object.assign(t, { list_id: lid, sort: sort }); render();
  Store.update('tasks', id, { list_id: lid, sort: sort }).then(function (u) { Object.assign(t, u); }).catch(function (e) { Object.assign(t, before); render(); fail(e); });
}
/* deadlines */
function showMonthOf(iso) { if (iso) S.calMonth = String(iso).slice(0, 7); }
async function actNewDeadline(date) {
  var r = await deadlineDialog({ title: '', due_date: date || (S.calMonth && S.calMonth !== todayIso().slice(0, 7) ? '' : todayIso()), due_time: null, notes: '' });
  if (!r) return;
  try { S.deadlines.push(await Store.insert('deadlines', r.data)); index(); showMonthOf(r.data.due_date); if (route.view !== 'deadlines') go('deadlines'); else render(); toast('Deadline toegevoegd.'); } catch (e) { fail(e); }
}
async function patchDeadline(id, patch, msg) {
  var d = IX.deadline[id]; if (!d) return;
  try { Object.assign(d, await Store.update('deadlines', id, patch)); index(); render(); if (msg) toast(msg); } catch (e) { fail(e); }
}
async function actEditDeadline(id) {
  var d = IX.deadline[id]; if (!d) return;
  var r = await deadlineDialog(d);
  if (!r) return;
  if (r.value === 'delete') {
    if (!(await confirmPopup('Deadline verwijderen?', '"' + d.title + '" wordt definitief verwijderd.', 'Verwijderen'))) return;
    try { await Store.remove('deadlines', id); S.deadlines = S.deadlines.filter(function (x) { return x.id !== id; }); index(); render(); toast('Deadline verwijderd.'); } catch (e) { fail(e); }
    return;
  }
  showMonthOf(r.data.due_date); patchDeadline(id, r.data);
}
function actToggleDeadline(id) { var d = IX.deadline[id]; if (!d) return; patchDeadline(id, { done: !d.done, done_at: d.done ? null : new Date().toISOString() }, d.done ? 'Deadline teruggezet.' : 'Deadline afgerond.'); }
function actCalMove(dir) {
  var ym = S.calMonth || todayIso().slice(0, 7), d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + dir, 1);
  S.calMonth = isoDate(d).slice(0, 7); render();
}

/* lijsten */
async function actNewList() {
  var name = await promptText('Nieuwe lijst', '', 'Toevoegen', 'Naam van de lijst'); if (!name) return null;
  try { var l = await Store.insert('lists', { name: name, sort: S.lists.length ? S.lists[S.lists.length - 1].sort + 1 : 0 }); S.lists.push(l); index(); S.adding = l.id; if (route.view !== 'taken') go('taken'); else render(); var b = $('#board'); if (b) b.scrollLeft = b.scrollWidth; return l; } catch (e) { fail(e); return null; }
}
async function actListRename(id) {
  var l = IX.list[id]; if (!l) return;
  var name = await promptText('Naam van de lijst', l.name); if (!name || name === l.name) return;
  try { Object.assign(l, await Store.update('lists', id, { name: name })); render(); } catch (e) { fail(e); }
}
async function moveInOrder(table, items, id, dir) {
  var i = items.findIndex(function (x) { return x.id === id; }), j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  var a = items[i]; items[i] = items[j]; items[j] = a;
  try { await Promise.all(items.map(function (x, k) { if (x.sort === k) return null; x.sort = k; return Store.update(table, x.id, { sort: k }); })); index(); render(); } catch (e) { fail(e); }
}
async function actListDelete(id) {
  var l = IX.list[id]; if (!l) return;
  var n = S.tasks.filter(function (t) { return t.list_id === id; }).length;
  if (!(await confirmPopup('"' + l.name + '" verwijderen?', n ? 'De lijst en ' + plural(n, 'taak', 'taken') + ' (ook de voltooide) worden definitief verwijderd.' : 'De lijst wordt verwijderd.', 'Verwijderen'))) return;
  try { await Store.remove('lists', id); S.lists = S.lists.filter(function (x) { return x.id !== id; }); S.tasks = S.tasks.filter(function (t) { return t.list_id !== id; }); index(); render(); toast('Lijst verwijderd.'); } catch (e) { fail(e); }
}
/* labels */
async function actLabelAdd() {
  var el = $('#new-label'), name = el.value.trim(); if (!name) { el.focus(); return; }
  if (S.labels.some(function (l) { return norm(l.name) === norm(name); })) { toast('Dat label bestaat al.', 'danger'); return; }
  var used = S.labels.map(function (l) { return l.color; }), color = COLORS.find(function (c) { return used.indexOf(c) < 0; }) || 'grijs';
  try { S.labels.push(await Store.insert('labels', { name: name, color: color, sort: S.labels.length ? S.labels[S.labels.length - 1].sort + 1 : 0 })); index(); render(); toast('Label toegevoegd.'); } catch (e) { fail(e); }
}
async function actLabelPatch(id, patch) {
  var l = IX.label[id]; if (!l) return;
  if (patch.name !== undefined) { patch.name = patch.name.trim(); if (!patch.name || patch.name === l.name) { render(); return; } }
  try { Object.assign(l, await Store.update('labels', id, patch)); index(); render(); toast('Opgeslagen.'); } catch (e) { fail(e); }
}
async function actLabelDelete(id) {
  var l = IX.label[id]; if (!l) return;
  var n = S.tasks.filter(function (t) { return arr(t.label_ids).indexOf(id) >= 0; }).length;
  if (!(await confirmPopup('Label "' + l.name + '" verwijderen?', n ? 'Het label verdwijnt van ' + plural(n, 'taak', 'taken') + '. De taken zelf blijven staan.' : 'Het label wordt verwijderd.', 'Verwijderen'))) return;
  try { await Store.remove('labels', id); S.labels = S.labels.filter(function (x) { return x.id !== id; }); if (S.labelFilter === id) S.labelFilter = ''; index(); render(); toast('Label verwijderd.'); } catch (e) { fail(e); }
}
/* projecten en notities */
async function actNewProject() {
  var name = await promptText('Nieuw project', '', 'Toevoegen', 'Naam van het project'); if (!name) return null;
  try { var p = await Store.insert('projects', { name: name, sort: S.projects.length ? Math.max.apply(null, S.projects.map(function (x) { return x.sort; })) + 1 : 0 }); S.projects.push(p); index(); go('notities/' + p.id); return p; } catch (e) { fail(e); return null; }
}
async function actProjectRename(id) {
  var p = IX.project[id]; if (!p) return;
  var name = await promptText('Naam van het project', p.name); if (!name || name === p.name) return;
  try { Object.assign(p, await Store.update('projects', id, { name: name })); index(); render(); } catch (e) { fail(e); }
}
async function actProjectDelete(id) {
  var p = IX.project[id]; if (!p) return;
  var n = S.notes.filter(function (x) { return x.project_id === id; }).length;
  if (!(await confirmPopup('"' + p.name + '" verwijderen?', n ? 'Het project en ' + plural(n, 'notitie', 'notities') + ' worden definitief verwijderd.' : 'Het project wordt verwijderd.', 'Verwijderen'))) return;
  try { NS.dirty = false; dirty = false; await Store.remove('projects', id); S.projects = S.projects.filter(function (x) { return x.id !== id; }); S.notes = S.notes.filter(function (x) { return x.project_id !== id; }); index(); toast('Project verwijderd.'); go('notities'); } catch (e) { fail(e); }
}
async function actNewNote() {
  await flushNote();
  var pid = route.view === 'notities' ? notesSel().pid : null;
  if (!pid) { var last = lsGet('todo.project'); pid = last && IX.project[last] ? last : (S.projects[0] ? S.projects[0].id : null); }
  if (!pid) { var p = await actNewProject(); if (!p) return; pid = p.id; }
  try { var n = await Store.insert('notes', { project_id: pid, title: '', body: '' }); S.notes.push(n); index(); S.q = ''; $all('#zoek').forEach(function (z) { z.value = ''; }); go('notities/' + pid + '/' + n.id); } catch (e) { fail(e); }
}
async function actNotePatch(id, patch) {
  var n = IX.note[id]; if (!n) return;
  await flushNote();
  try { var u = await Store.update('notes', id, patch); Object.assign(n, patch, { updated_at: u.updated_at }); index(); if (patch.project_id) go('notities/' + patch.project_id + '/' + id); else render(true); } catch (e) { fail(e); }
}
async function actNoteDelete(id) {
  var n = IX.note[id]; if (!n) return;
  if (!(await confirmPopup('Notitie verwijderen?', '"' + noteTitle(n) + '" wordt definitief verwijderd.', 'Verwijderen'))) return;
  try { clearTimeout(NS.timer); NS.dirty = false; dirty = false; await Store.remove('notes', id); S.notes = S.notes.filter(function (x) { return x.id !== id; }); index(); toast('Notitie verwijderd.'); go('notities/' + n.project_id); } catch (e) { fail(e); }
}
function actExport() {
  var data = { exported_at: new Date().toISOString(), lists: S.lists, labels: S.labels, tasks: S.tasks, deadlines: S.deadlines, projects: S.projects, notes: S.notes };
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  var d = new Date(); a.download = String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + ' To do export.json';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/* eerste keer: twee labels en één lijst klaarzetten */
async function ensureDefaults() {
  if (S.lists.length || S.labels.length || S.tasks.length) return;
  try {
    S.labels = await Store.insertMany('labels', DEFAULT_LABELS.map(function (l, i) { return { name: l[0], color: l[1], sort: i }; }));
    S.lists = [await Store.insert('lists', { name: 'High-prio', sort: 0 })];
    index();
  } catch (e) { fail(e); }
}

/* ============================================================
   GEBEURTENISSEN
   ============================================================ */
var dirty = false;
function closeMenus(except) {
  $all('.drpdwn--open').forEach(function (d) { if (d !== except) { d.classList.remove('drpdwn--open'); var b = $('[data-drpdwn]', d); if (b) b.setAttribute('aria-expanded', 'false'); var m = $('.drpdwn__menu', d); if (m) m.removeAttribute('style'); } });
}
/* menu's in een scrollende kolom: vast op het scherm zetten, anders worden ze afgesneden */
function placeMenu(d, btn) {
  var m = $('.drpdwn__menu', d); if (!m) return;
  var r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  var left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
  var top = r.bottom + 4; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  m.style.cssText = 'position:fixed;margin:0;right:auto;left:' + left + 'px;top:' + top + 'px;max-height:' + (window.innerHeight - 16) + 'px;overflow-y:auto';
}
function bindEvents() {
  document.addEventListener('click', function (e) {
    var t = e.target;
    var dd = t.closest('[data-drpdwn]');
    if (dd) { e.preventDefault(); e.stopPropagation(); var d = dd.closest('.drpdwn'), open = !d.classList.contains('drpdwn--open'); closeMenus(d); d.classList.toggle('drpdwn--open', open); dd.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open && dd.hasAttribute('data-fixed')) placeMenu(d, dd); return; }
    if (!t.closest('.drpdwn__menu')) closeMenus();
    var a = t.closest('[data-act]');
    if (a && !a.disabled) {
      e.preventDefault(); e.stopPropagation(); closeMenus();
      var id = a.dataset.id;
      switch (a.dataset.act) {
        case 'add-task': S.adding = S.adding === id && $('#new-task') && !$('#new-task').value ? null : id; render(); var nb = $('#new-task'); if (nb) nb.closest('.col__body').scrollTop = 0; break;
        case 'add-cancel': S.adding = null; var x = $('#new-task'); if (x) x.value = ''; render(); break;
        case 'add-confirm': actQuickAdd(id, $('#new-task').value); break;
        case 'toggle-task': actToggleTask(id); break;
        case 'toggle-done': S.openDone[id] = !S.openDone[id]; lsSet('todo.openDone', JSON.stringify(S.openDone)); render(); break;
        case 'edit-task': actEditTask(id); break;
        case 'delete-task': actDeleteTask(id); break;
        case 'move-task': actMoveTask(id, a.dataset.list, openTasks(a.dataset.list, true)[0] ? openTasks(a.dataset.list, true)[0].id : null); break;
        case 'task-label': actTaskLabel(id, a.dataset.label); break;
        case 'label-filter': S.labelFilter = id || ''; render(); break;
        case 'new-task': actNewTask(); break;
        case 'new-list': actNewList(); break;
        case 'new-deadline': actNewDeadline(a.dataset.date); break;
        case 'edit-deadline': actEditDeadline(id); break;
        case 'toggle-deadline': actToggleDeadline(id); break;
        case 'cal-move': actCalMove(+a.dataset.dir); break;
        case 'cal-today': S.calMonth = ''; render(); break;
        case 'list-rename': actListRename(id); break;
        case 'list-move': moveInOrder('lists', S.lists, id, +a.dataset.dir); break;
        case 'list-delete': actListDelete(id); break;
        case 'label-add': actLabelAdd(); break;
        case 'label-delete': actLabelDelete(id); break;
        case 'new-project': actNewProject(); break;
        case 'project-rename': actProjectRename(id); break;
        case 'project-move': moveInOrder('projects', S.projects, id, +a.dataset.dir); break;
        case 'project-delete': actProjectDelete(id); break;
        case 'new-note': actNewNote(); break;
        case 'note-pin': actNotePatch(id, { pinned: !IX.note[id].pinned }); break;
        case 'note-move': actNotePatch(id, { project_id: a.dataset.project }); break;
        case 'note-delete': actNoteDelete(id); break;
        case 'export': actExport(); break;
        case 'logout': flushNote().then(function () { return Store.signOut(); }).then(function () { location.hash = ''; location.reload(); }); break;
      }
      return;
    }
    var lp = t.closest('[data-lblpick]');
    if (lp) { e.preventDefault(); var on = !lp.classList.contains('lbl--on'); lp.classList.toggle('lbl--on', on); lp.setAttribute('aria-pressed', on); return; }
    if (t.closest('[data-cl-indent]')) { e.preventDefault(); clIndent(t.closest('.cl-row')); return; }
    if (t.closest('[data-cl-remove]')) { e.preventDefault(); t.closest('.cl-row').remove(); clIndent($('#t-cl .cl-row'), false); clCount(); return; }
    var card = t.closest('.tcard[data-tid]');
    if (card && !t.closest('button,a,input,.drpdwn')) { actEditTask(card.dataset.tid); return; }
    var h = t.closest('[data-href]');
    if (h) { e.preventDefault(); closeMenus(); go(h.dataset.href.replace(/^#/, '')); }
  });
  document.addEventListener('change', async function (e) {
    var t = e.target;
    if (t.classList.contains('cl-check')) { clCount(); return; }
    if (t.dataset.labelName) { actLabelPatch(t.dataset.labelName, { name: t.value }); return; }
    if (t.dataset.labelColor) { actLabelPatch(t.dataset.labelColor, { color: t.value }); return; }
    if (t.dataset.actChange === 'display-name') { try { await Store.setName(t.value.trim().slice(0, 40)); showUserName(); toast('Opgeslagen.'); } catch (err) { fail(err); } }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 't-notes') autoGrow(e.target);
    var t = e.target;
    if (t.id === 'note-title' || t.id === 'note-body') { noteInput(t); return; }
    var tf = t.closest && t.closest('.text-field--error'); if (tf && t.value.trim()) tf.classList.remove('text-field--error');
    if (t.id === 'zoek' || t.hasAttribute('data-q')) {
      S.q = t.value;
      $all('#zoek,[data-q]').forEach(function (o) { if (o !== t) o.value = t.value; });
      if (route.view === 'instellingen') { go('taken'); return; }
      var pos = t.selectionStart, tid = t.id; render();
      var el = document.getElementById(tid); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} }
    }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Escape') {
      if ($('.drpdwn--open')) { closeMenus(); return; }
      if (DG && DG.active) { dragEnd(false); return; }
      if (popupOpen()) { cancelPopup(); return; }
      if (t.id === 'new-task') { S.adding = null; t.value = ''; render(); return; }
    }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.body.classList.contains('auth-mode') && !popupOpen()) { e.preventDefault(); $('#zoek').focus(); return; }
    if (e.key === 'Tab' && t.classList && t.classList.contains('cl-text')) {
      var row = t.closest('.cl-row');
      if (t.id === 'cl-new') { if (t.value.trim()) { e.preventDefault(); S.clNewSub = !e.shiftKey && !!$('#t-cl .cl-row'); row.classList.toggle('cl-row--sub', S.clNewSub); } return; }
      e.preventDefault(); clIndent(row, !e.shiftKey); return;
    }
    if (e.key === 'Backspace' && t.classList && t.classList.contains('cl-text') && t.id !== 'cl-new' && !t.value) {
      e.preventDefault(); var rw = t.closest('.cl-row'), prev = rw.previousElementSibling; rw.remove(); clIndent($('#t-cl .cl-row'), false); clCount();
      var fo = prev ? $('.cl-text', prev) : $('#cl-new'); fo.focus(); return;
    }
    if (e.key !== 'Enter') return;
    if (t.id === 'new-task') { e.preventDefault(); actQuickAdd(t.dataset.list, t.value); return; }
    if (t.classList && t.classList.contains('tcard') && t.dataset.tid) { actEditTask(t.dataset.tid); return; }
    if (t.id === 'cl-new' && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); clAdd(); return; }
    if (t.classList && t.classList.contains('cl-text') && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); if (t.value.trim()) clInsertAfter(t.closest('.cl-row')); else $('#cl-new').focus(); return; }
    if (t.id === 'new-label') { e.preventDefault(); actLabelAdd(); return; }
    if (t.id === 'note-title') { e.preventDefault(); $('#note-body').focus(); return; }
    if (popupOpen() && (t.id === 'p-text' || t.id === 't-title' || t.id === 't-due' || t.id === 'd-title' || t.id === 'd-date' || t.id === 'd-time' || e.ctrlKey || e.metaKey)) { e.preventDefault(); var b = $('#popup [data-pbtn="0"]'); if (b) b.click(); }
  });
  $('#overlay').addEventListener('click', cancelPopup);
  /* verticale scrollbalk van een lijst alleen tonen terwijl er gescrold wordt */
  document.addEventListener('scroll', function (e) {
    var el = e.target; if (!el.classList || !el.classList.contains('col__body')) return;
    el.classList.add('is-scrolling'); clearTimeout(el._st); el._st = setTimeout(function () { el.classList.remove('is-scrolling'); }, 700);
  }, true);
  document.addEventListener('scroll', function (e) { if ($('.drpdwn--open [data-fixed]') && e.target.classList && (e.target.classList.contains('col__body') || e.target.classList.contains('board') || e.target.classList.contains('npane__scroll'))) closeMenus(); }, true);

  /* kaarten slepen: alleen de kaart beweegt mee met de muis of vinger; op de plek waar hij zou landen
     schuiven de andere kaarten opzij. Muis: slepen na een paar pixels. Aanraken: kaart even vasthouden. */
  var dragId = null, DG = null, swallowClick = false;
  function dropTarget(col, y) {
    var cards = $all('.tcard[data-tid]:not(.tcard--done):not(.tcard--placeholder)', col);
    for (var i = 0; i < cards.length; i++) { var r = cards[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return cards[i]; }
    return null;
  }
  /* FLIP: kaarten glijden naar hun nieuwe plek in plaats van te verspringen */
  function flip(change) {
    var cards = $all('#board .tcard:not(.tcard--placeholder), #board .col__done'), tops = cards.map(function (c) { return c.getBoundingClientRect().top; });
    change();
    cards.forEach(function (c, i) {
      var dy = tops[i] - c.getBoundingClientRect().top; if (!dy) return;
      c.style.transition = 'none'; c.style.transform = 'translateY(' + dy + 'px)';
      void c.offsetHeight;
      c.style.transition = 'transform .16s ease'; c.style.transform = '';
    });
  }
  function dragPlace(x, y) {
    var el = document.elementFromPoint(x, y), col = el && el.closest ? el.closest('.col[data-list]') : null;
    $all('.col--over').forEach(function (c) { if (c !== col) c.classList.remove('col--over'); });
    if (!col) return;
    col.classList.add('col--over');
    var body = $('.col__body', col), ph = DG.card, ref;
    if (DG.done) ref = null;
    else { ref = dropTarget(col, y); if (!ref) ref = $('.col__done', body); }
    if (ph.parentNode === body && ph.nextElementSibling === ref) return;
    if (ref === ph) return;
    flip(function () { body.insertBefore(ph, ref || null); });
  }
  function dragMove(x, y) {
    DG.x = x; DG.y = y;
    DG.ghost.style.transform = 'translate(' + (x - DG.ox) + 'px,' + (y - DG.oy) + 'px) rotate(2deg)';
    dragPlace(x, y);
  }
  function dragScroll() {
    if (!DG || !DG.active) return;
    var board = $('#board'), moved = false;
    if (board) {
      var r = board.getBoundingClientRect();
      if (DG.x < r.left + 50) { board.scrollLeft -= 14; moved = true; } else if (DG.x > r.right - 50) { board.scrollLeft += 14; moved = true; }
      var el = document.elementFromPoint(DG.x, DG.y), col = el && el.closest ? el.closest('.col[data-list]') : null, body = col ? $('.col__body', col) : null;
      if (body) { var br = body.getBoundingClientRect(); if (DG.y < br.top + 44) { body.scrollTop -= 10; moved = true; } else if (DG.y > br.bottom - 44) { body.scrollTop += 10; moved = true; } }
    }
    if (moved) dragPlace(DG.x, DG.y);
    DG.raf = requestAnimationFrame(dragScroll);
  }
  function dragBegin() {
    var c = DG.card, r = c.getBoundingClientRect(), g = c.cloneNode(true);
    closeMenus(); DG.active = true; dragId = DG.id; DG.ox = DG.sx - r.left; DG.oy = DG.sy - r.top;
    g.classList.add('tcard--ghost'); g.removeAttribute('data-tid'); g.removeAttribute('tabindex');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    document.body.appendChild(g); DG.ghost = g;
    c.style.height = r.height + 'px'; c.classList.add('tcard--placeholder');
    document.body.classList.add('dragging');
    dragMove(DG.x, DG.y); DG.raf = requestAnimationFrame(dragScroll);
  }
  function dragEnd(commit) {
    var d = DG; DG = null; if (!d) return;
    clearTimeout(d.timer);
    if (!d.active) return;
    cancelAnimationFrame(d.raf); d.ghost.remove(); document.body.classList.remove('dragging');
    $all('.col--over').forEach(function (c) { c.classList.remove('col--over'); });
    swallowClick = true; setTimeout(function () { swallowClick = false; }, 60);
    var col = d.card.closest('.col[data-list]'), t = IX.task[d.id], next = d.card.nextElementSibling;
    while (next && !(next.matches && next.matches('.tcard[data-tid]:not(.tcard--done)'))) next = next.nextElementSibling;
    dragId = null;
    if (!commit || !col || !t) { render(); return; }
    if (t.done) { if (t.list_id !== col.dataset.list) patchTask(d.id, { list_id: col.dataset.list }); else render(); return; }
    var before = { list_id: t.list_id, sort: t.sort };
    actMoveTask(d.id, col.dataset.list, next ? next.dataset.tid : null);
    if (t.list_id === before.list_id && t.sort === before.sort) render();
  }
  document.addEventListener('pointerdown', function (e) {
    if (DG || e.button > 0 || !e.isPrimary) return;
    var c = e.target.closest && e.target.closest('#board .tcard[data-tid]');
    if (!c || e.target.closest('button,a,input,textarea,select,.drpdwn')) return;
    DG = { id: c.dataset.tid, card: c, done: c.classList.contains('tcard--done'), sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', active: false, pid: e.pointerId };
    if (DG.touch) DG.timer = setTimeout(function () { if (DG && !DG.active) { dragBegin(); if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {} } }, 320);
  });
  document.addEventListener('pointermove', function (e) {
    if (!DG || e.pointerId !== DG.pid) return;
    var dx = e.clientX - DG.sx, dy = e.clientY - DG.sy;
    if (!DG.active) {
      if (DG.touch) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(DG.timer); DG = null; } return; }
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      DG.x = e.clientX; DG.y = e.clientY; dragBegin(); return;
    }
    e.preventDefault(); dragMove(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', function (e) { if (DG && e.pointerId === DG.pid) dragEnd(true); });
  document.addEventListener('pointercancel', function (e) { if (DG && e.pointerId === DG.pid) dragEnd(false); });
  document.addEventListener('touchmove', function (e) { if (DG && DG.active) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { if (DG) e.preventDefault(); });
  document.addEventListener('click', function (e) { if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; } }, true);
  document.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.tcard')) e.preventDefault(); });
  window.addEventListener('blur', function () { if (DG) dragEnd(false); });

  window.addEventListener('hashchange', function () { flushNote(); S.adding = null; render(); window.scrollTo(0, 0); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { flushNote(); e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('resize', function () { closeMenus(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { flushNote(); return; }
    if (!dirty && Store.user && Date.now() - S.loadedAt > 60000 && !popupOpen() && !dragId) reload(true);
  });
  $('#inklappen').addEventListener('click', function (e) { e.preventDefault(); document.body.classList.toggle('sidenav-collapsed'); lsSet('todo.collapsed', document.body.classList.contains('sidenav-collapsed') ? '1' : ''); });
  if (lsGet('todo.collapsed')) document.body.classList.add('sidenav-collapsed');
}

/* ============================================================
   INLOGGEN EN OPSTARTEN
   ============================================================ */
function showAuth(mode, msg) {
  document.body.classList.add('auth-mode');
  var box = $('#auth-box');
  if (mode === 'config') {
    box.innerHTML = '<div class="auth__title">Database koppelen</div><p class="auth__lead">Vul de Project URL en de publishable key van je Supabase-project in. Ze worden alleen in deze browser bewaard.</p>' +
      '<form id="f-config"><div class="auth__field"><label for="cfg-url">Project URL</label><input class="text-field__input" id="cfg-url" type="url" placeholder="https://xxxx.supabase.co" required></div>' +
      '<div class="auth__field"><label for="cfg-key">Publishable key</label><input class="text-field__input" id="cfg-key" type="text" placeholder="sb_publishable_…" required></div>' +
      '<div class="auth__actions"><button class="btn btn--primary" type="submit"><span class="btn__text">Koppelen</span></button><a class="btn" href="?demo"><span class="btn__text">Eerst de demo bekijken</span></a></div></form>';
    $('#f-config').addEventListener('submit', function (e) { e.preventDefault(); lsSet('todo.config', JSON.stringify({ url: $('#cfg-url').value.trim().replace(/\/+$/, ''), key: $('#cfg-key').value.trim() })); location.reload(); });
    return;
  }
  var signup = mode === 'signup';
  box.innerHTML = '<div class="auth__title">' + (signup ? 'Account aanmaken' : 'Inloggen') + '</div><p class="auth__lead">' + (signup ? 'Eenmalig. Zet daarna in Supabase nieuwe aanmeldingen uit.' : 'Log in om je to do\'s en notities te openen.') + '</p>' +
    '<form id="f-auth"><div class="auth__field"><label for="a-email">E-mailadres</label><input class="text-field__input" id="a-email" type="email" autocomplete="username" required></div>' +
    '<div class="auth__field"><label for="a-pw">Wachtwoord</label><input class="text-field__input" id="a-pw" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" minlength="8" required></div>' +
    '<div class="auth__actions"><button class="btn btn--primary" type="submit" id="a-submit"><span class="btn__text">' + (signup ? 'Account aanmaken' : 'Inloggen') + '</span></button></div>' +
    '<div class="auth__error" id="a-err" role="alert">' + esc(msg || '') + '</div></form>' +
    '<div class="auth__switch">' + (signup ? '<a data-auth="login">Ik heb al een account</a>' : 'Eerste keer? <a data-auth="signup">Account aanmaken</a>') + '</div>';
  $('[data-auth]', box).addEventListener('click', function () { showAuth(this.dataset.auth); });
  $('#a-email').focus();
  $('#f-auth').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('#a-submit'); btn.disabled = true; $('#a-err').textContent = '';
    var email = $('#a-email').value.trim(), pw = $('#a-pw').value;
    try {
      if (signup) {
        var d = await Store.signUp(email, pw);
        if (d.session) { await start(d.session); return; }
        showAuth('login', ''); $('#a-email').value = email;
        $('#a-err').style.color = 'var(--g600)'; $('#a-err').textContent = 'Account aangemaakt. Bevestig je e-mailadres via de mail van Supabase en log daarna hier in.';
      } else { await start(await Store.signIn(email, pw)); }
    } catch (err) {
      var m = err.message || String(err);
      if (/invalid login/i.test(m)) m = 'E-mailadres of wachtwoord klopt niet.';
      else if (/email not confirmed/i.test(m)) m = 'Je e-mailadres is nog niet bevestigd. Klik eerst op de link in de mail van Supabase.';
      else if (/signups not allowed|signup is disabled/i.test(m)) m = 'Nieuwe accounts zijn uitgeschakeld.';
      else if (/failed to fetch|networkerror/i.test(m)) m = 'Kan de database niet bereiken. Klopt de Project URL?';
      $('#a-err').textContent = m; btn.disabled = false;
    }
  });
}
async function start(session) {
  Store.user = session.user;
  document.body.classList.remove('auth-mode');
  showUserName();
  $('#main').innerHTML = '<section class="container"><div class="actionbar"><h1 class="actionbar__title muted">Laden…</h1></div></section>';
  try { setData(await Store.loadAll()); }
  catch (e) {
    console.error(e);
    $('#main').innerHTML = '<section class="container">' + actionbar('Kan de database niet lezen') + '<div class="alert alert--danger">' + icon('alert', 'alert__icon') + '<div class="alert__body">' + esc(e.message || e) +
      '<div class="muted" style="font-weight:400;margin-top:4px">Is het schema (todo-schema.sql) in Supabase uitgevoerd? Staat het project misschien op pauze? Zet het dan in het Supabase-dashboard weer aan.</div></div></div></section>';
    return;
  }
  await ensureDefaults();
  render();
}
async function boot() {
  bindEvents();
  if (DEMO) { Demo.build(); $('#demo-flag').classList.remove('hidden'); return start(await Store.session()); }
  if (Store.init() === 'config') return showAuth('config');
  Store.sb.auth.onAuthStateChange(function (ev, session) { if (ev === 'SIGNED_OUT') { Store.user = null; showAuth('login'); } else if (session) Store.user = session.user; });
  var s = await Store.session();
  if (s) start(s); else showAuth('login');
}
boot();
