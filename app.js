(function () {
'use strict';

/* ================= أدوات ================= */
const $ = (s) => document.querySelector(s);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in (props || {})) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  (function add(list) {
    list.forEach((c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) add(c);
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
  })(kids);
  return el;
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.replaceChildren(h('span', {}, msg));
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ================= الحالة والحفظ ================= */
const KEY = 'mq_flash_v1';
const DAY = 864e5, INT = [0, 1, 3, 7, 14, 30, 60];
const defaults = () => ({ decks: {}, progress: {}, settings: { theme: 'dark', reveal: false, typed: false, newPerDay: 20 }, seeded: false });
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); S.settings = Object.assign(defaults().settings, S.settings); }
catch (e) { S = defaults(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('مساحة التخزين المحلي ممتلئة'); } }
function applyTheme() { document.documentElement.setAttribute('data-theme', S.settings.theme); }

const cache = {};
function getParsed(id) {
  const d = S.decks[id]; if (!d) return null;
  if (!cache[id] || cache[id].u !== d.updated) cache[id] = { u: d.updated, p: MQ.parse(d.text, d.name) };
  return cache[id].p;
}

function seed() {
  if (S.seeded || Object.keys(S.decks).length) return;
  if (window.SAMPLE_TEXT) addDeck(window.SAMPLE_NAME || 'ملف نموذجي', window.SAMPLE_TEXT, true);
  S.seeded = true; save();
}

function addDeck(name, text, silent) {
  const id = uid(), now = Date.now();
  S.decks[id] = { id, name, text, created: now, updated: now };
  save(); pushDeck(id);
  if (!silent) { V = { view: 'deck', deckId: id }; render(); toast('تم إنشاء الكروت: ' + getParsed(id).cards.length + ' كارت'); }
  return id;
}

/* ================= قراءة الملفات ================= */
async function readFile(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (['txt', 'md', 'text', 'csv', 'tsv'].includes(ext)) return f.text();
  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('مكتبة Word لم تُحمّل (تحتاج إنترنت)');
    const res = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
    return htmlToLines(res.value);
  }
  if (ext === 'pdf') {
    if (!window.pdfjsLib) throw new Error('مكتبة PDF لم تُحمّل (تحتاج إنترنت)');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
    const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      const rows = {};
      tc.items.forEach((it) => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push(it); });
      Object.keys(rows).map(Number).sort((a, b) => b - a).forEach((y) => {
        const items = rows[y], ar = /[؀-ۿ]/.test(items.map((i) => i.str).join(''));
        items.sort((a, b) => ar ? b.transform[4] - a.transform[4] : a.transform[4] - b.transform[4]);
        out.push(items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim());
      });
    }
    return out.join('\n');
  }
  throw new Error('نوع الملف غير مدعوم (استخدم txt أو md أو docx أو pdf)');
}
function htmlToLines(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), out = [];
  const txt = (n) => n.textContent.replace(/\s+/g, ' ').trim();
  (function walk(parent) {
    parent.childNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (/^h[1-6]$/.test(t)) out.push('# ' + txt(n));
      else if (t === 'ul' || t === 'ol') n.querySelectorAll('li').forEach((li) => { const s = txt(li); if (s) out.push('- ' + s); });
      else if (t === 'table') n.querySelectorAll('tr').forEach((tr) => out.push([...tr.children].map(txt).join('\t')));
      else if (t === 'p') { const s = txt(n); if (s) out.push(s); }
      else walk(n);
    });
  })(doc.body);
  return out.join('\n');
}
async function handleFiles(files) {
  for (const f of files) {
    try {
      if (f.name.toLowerCase().endsWith('.json')) { importBackup(JSON.parse(await f.text())); continue; }
      const text = await readFile(f);
      if (!text.trim()) throw new Error('الملف فاضي أو النص مش مقروء');
      addDeck(f.name.replace(/\.[^.]+$/, ''), text);
    } catch (e) { toast('تعذر قراءة ' + f.name + ': ' + e.message); }
  }
}
function exportBackup() {
  const blob = new Blob([JSON.stringify({ decks: S.decks, progress: S.progress }, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'flashcards-backup.json' });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function importBackup(o) {
  if (!o || !o.decks) throw new Error('ملف نسخة احتياطية غير صالح');
  Object.values(o.decks).forEach((d) => { if (!S.decks[d.id] || S.decks[d.id].updated < d.updated) S.decks[d.id] = d; });
  mergeProgress(o.progress || {});
  save(); Object.keys(S.decks).forEach((id) => { pushDeck(id); pushProgress(id); });
  render(); toast('تم استرجاع النسخة الاحتياطية');
}
function mergeProgress(remote) {
  Object.keys(remote).forEach((did) => {
    const L = (S.progress[did] = S.progress[did] || {}), R = remote[did];
    Object.keys(R).forEach((cid) => { if (!L[cid] || (R[cid].last || 0) > (L[cid].last || 0)) L[cid] = R[cid]; });
  });
}

/* ================= المزامنة (Firebase) ================= */
let fb = null, user = null, syncing = false;
function initFirebase() {
  const c = window.FIREBASE_CONFIG;
  if (!c || !c.apiKey || !window.firebase) return;
  try {
    firebase.initializeApp(c);
    fb = { auth: firebase.auth(), db: firebase.firestore() };
    fb.auth.onAuthStateChanged(async (u) => { user = u; render(); if (u) await pullMerge(); });
  } catch (e) { console.error(e); fb = null; }
}
const col = (name) => fb.db.collection('users').doc(user.uid).collection(name);
async function pullMerge() {
  if (!fb || !user) return;
  syncing = true; render();
  try {
    const rd = await col('decks').get(), seen = new Set();
    rd.forEach((doc) => {
      const d = doc.data(); seen.add(doc.id);
      if (!S.decks[doc.id] || S.decks[doc.id].updated < d.updated) S.decks[doc.id] = { id: doc.id, name: d.name, text: d.text, created: d.created, updated: d.updated };
    });
    const rp = await col('progress').get(), remote = {};
    rp.forEach((doc) => { try { remote[doc.id] = JSON.parse(doc.data().data); } catch (e) {} });
    mergeProgress(remote);
    S.seeded = true; save();
    Object.keys(S.decks).forEach((id) => { if (!seen.has(id)) pushDeck(id); pushProgress(id); });
    toast('تمت المزامنة مع حساب جوجل ☁');
  } catch (e) { toast('تعذرت المزامنة: ' + e.message); }
  syncing = false; render();
}
const timers = {};
function debounce(key, fn, ms) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); }
function pushDeck(id) {
  if (!fb || !user || !S.decks[id]) return;
  const d = S.decks[id];
  col('decks').doc(id).set({ name: d.name, text: d.text, created: d.created, updated: d.updated }).catch((e) => toast('تعذر الحفظ السحابي: ' + e.message));
}
function pushProgress(id) {
  if (!fb || !user) return;
  debounce('p' + id, () => col('progress').doc(id).set({ data: JSON.stringify(S.progress[id] || {}), updated: Date.now() }).catch(() => {}), 1200);
}
function deleteRemote(id) {
  if (!fb || !user) return;
  col('decks').doc(id).delete().catch(() => {}); col('progress').doc(id).delete().catch(() => {});
}

/* ================= واجهة العرض ================= */
let V = { view: 'home' };
function render() {
  applyTheme();
  const app = $('#app');
  let body;
  if (V.view === 'deck') body = deckView();
  else if (V.view === 'study') body = studyView();
  else if (V.view === 'browse') body = browseView();
  else body = homeView();
  app.replaceChildren(h('div', { class: 'wrap' }, header(), body));
}
function header() {
  const syncBtn = fb
    ? (user
      ? h('button', { class: 'btn sm', title: user.email, onclick: () => fb.auth.signOut() }, syncing ? '⏳ جاري المزامنة…' : '☁ متزامن · خروج')
      : h('button', { class: 'btn primary sm', onclick: () => fb.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch((e) => toast(e.message)) }, 'دخول بجوجل للحفظ السحابي'))
    : h('span', { class: 'chip', title: 'راجع README لتفعيل الحفظ السحابي' }, '💾 حفظ محلي');
  return h('div', { class: 'top' },
    h('div', { class: 'brand', onclick: () => { V = { view: 'home' }; render(); } }, h('div', { class: 'logo' }, '▤'), 'كروت المذاكرة'),
    syncBtn,
    h('button', { class: 'btn sm ghost', title: 'تغيير المظهر', onclick: () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); render(); } }, S.settings.theme === 'dark' ? '☀' : '🌙'));
}

/* ---------- الرئيسية ---------- */
function homeView() {
  const drop = h('label', { class: 'drop' },
    h('div', { class: 'big' }, '📄'),
    h('div', { style: 'font-weight:800;font-size:19px' }, 'ارفع ملف المذاكرة (txt · md · docx · pdf)'),
    h('div', { class: 'sub' }, 'هيتحول لكروت بنفس نص الملف بالظبط، من غير تغيير ولا إضافات'),
    h('input', { type: 'file', multiple: true, accept: '.txt,.md,.docx,.pdf,.csv,.json', style: 'display:none', onchange: (e) => handleFiles(e.target.files) }));
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  const ta = h('textarea', { rows: 5, placeholder: 'أو الصق النص هنا…' });
  const nm = h('input', { type: 'text', placeholder: 'اسم المجموعة' });
  const paste = h('details', { style: 'margin-top:12px' }, h('summary', { style: 'cursor:pointer;color:var(--muted)' }, 'لصق نص مباشرة'),
    h('div', { style: 'display:grid;gap:8px;margin-top:8px' }, nm, ta,
      h('button', { class: 'btn primary', onclick: () => { if (!ta.value.trim()) return toast('اكتب أو الصق نص الأول'); addDeck(nm.value.trim() || 'نص ملصوق', ta.value); } }, 'حوّل لكروت')));

  const decks = Object.values(S.decks).sort((a, b) => b.created - a.created);
  const list = h('div', { class: 'grid' }, decks.map((d) => {
    const st = deckStats(d.id);
    return h('div', { class: 'deck', onclick: () => { V = { view: 'deck', deckId: d.id }; render(); } },
      h('h3', { dir: 'auto' }, d.name),
      h('div', { class: 'sub' }, st.total + ' كارت · ' + st.sections + ' قسم'),
      h('div', { class: 'chipbar', style: 'margin-top:10px' },
        h('span', { class: 'chip p3' }, 'مستحق ' + st.due), h('span', { class: 'chip' }, 'جديد ' + st.fresh), h('span', { class: 'chip p4' }, 'متقن ' + st.mastered)));
  }));
  return h('div', {}, h('h1', { class: 'page' }, 'مجموعاتك'),
    h('div', { class: 'sub', style: 'margin-bottom:14px' }, 'ذاكر بالاسترجاع النشط (Active Recall) والتكرار المتباعد'),
    drop, paste, decks.length ? list : null,
    h('div', { class: 'row', style: 'margin-top:26px' },
      h('button', { class: 'btn sm', onclick: exportBackup }, '⬇ نسخة احتياطية'),
      h('label', { class: 'btn sm' }, '⬆ استرجاع نسخة', h('input', { type: 'file', accept: '.json', style: 'display:none', onchange: (e) => handleFiles(e.target.files) })),
      fb ? null : h('span', { class: 'sub' }, 'للدخول من جهاز تاني فعّل الحفظ السحابي (README) أو استخدم النسخة الاحتياطية.')));
}

function deckStats(id) {
  const p = getParsed(id), prog = S.progress[id] || {}, now = Date.now();
  let due = 0, fresh = 0, mastered = 0;
  p.cards.forEach((c) => { const s = prog[c.id]; if (!s) fresh++; else { if (s.due <= now) due++; if (s.box >= 4) mastered++; } });
  return { total: p.cards.length, sections: p.sections.length, due, fresh, mastered };
}

/* ---------- صفحة المجموعة ---------- */
function deckView() {
  const d = S.decks[V.deckId]; if (!d) { V = { view: 'home' }; return homeView(); }
  const p = getParsed(d.id), st = deckStats(d.id);
  if (!V.cats) V.cats = new Set(p.sections.map((s) => s.idx));
  const counts = {}; p.cards.forEach((c) => (counts[c.sec] = (counts[c.sec] || 0) + 1));
  const allOn = V.cats.size === p.sections.length;

  const chips = p.sections.map((s) => h('span', {
    class: 'chip btnchip' + (V.cats.has(s.idx) ? ' sel' : ''), dir: 'auto',
    onclick: () => { V.cats.has(s.idx) ? V.cats.delete(s.idx) : V.cats.add(s.idx); render(); }
  }, s.num ? s.num + '. ' : '', s.title, ' · ', counts[s.idx] || 0));

  const sw = (label, key) => h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked: !!S.settings[key], onchange: (e) => { S.settings[key] = e.target.checked; save(); } }), label);

  return h('div', {},
    h('button', { class: 'btn sm ghost', onclick: () => { V = { view: 'home' }; render(); } }, '→ كل المجموعات'),
    h('h1', { class: 'page', dir: 'auto', style: 'margin-top:12px' }, d.name),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, st.total), h('span', {}, 'كل الكروت')),
      h('div', { class: 'stat' }, h('b', { style: 'color:var(--accent)' }, st.due), h('span', {}, 'مستحق للمراجعة')),
      h('div', { class: 'stat' }, h('b', {}, st.fresh), h('span', {}, 'جديد')),
      h('div', { class: 'stat' }, h('b', { style: 'color:var(--ok)' }, st.mastered), h('span', {}, 'متقن'))),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary big', onclick: () => startStudy('due') }, '▶ ابدأ مراجعة اليوم'),
      h('button', { class: 'btn big', onclick: () => startStudy('all') }, '🔀 كل الكروت (مراجعة سريعة)'),
      h('button', { class: 'btn big ghost', onclick: () => { V.view = 'browse'; render(); } }, '📚 تصفح')),
    h('div', { class: 'sec-title' }, 'أنواع الأسئلة / الأقسام ', h('button', { class: 'btn sm ghost', onclick: () => { V.cats = allOn ? new Set() : new Set(p.sections.map((s) => s.idx)); render(); } }, allOn ? 'إلغاء الكل' : 'تحديد الكل')),
    h('div', { class: 'chipbar' }, chips),
    h('div', { class: 'sec-title' }, 'طريقة المذاكرة'),
    h('div', { class: 'panel' },
      sw('اكتب إجابتك من ذاكرتك قبل ما تقلب الكارت (أقوى استرجاع)', 'typed'),
      sw('إخفاء عناصر القوائم وكشفها واحد واحد', 'reveal'),
      h('label', { class: 'switch' }, 'أقصى عدد كروت جديدة في الجلسة: ',
        h('input', { type: 'number', min: 1, max: 200, value: S.settings.newPerDay, style: 'width:90px', onchange: (e) => { S.settings.newPerDay = Math.max(1, +e.target.value || 20); save(); } }))),
    h('div', { class: 'row', style: 'margin-top:26px' },
      h('button', { class: 'btn sm', onclick: () => { const n = prompt('الاسم الجديد', d.name); if (n && n.trim()) { d.name = n.trim(); d.updated = Date.now(); save(); pushDeck(d.id); render(); } } }, '✏ إعادة تسمية'),
      h('button', { class: 'btn sm', onclick: () => { if (confirm('تصفير تقدّمك في المجموعة دي؟')) { delete S.progress[d.id]; save(); pushProgress(d.id); render(); } } }, '↺ تصفير التقدم'),
      h('button', { class: 'btn sm danger', onclick: () => { if (confirm('حذف المجموعة نهائيًا؟')) { delete S.decks[d.id]; delete S.progress[d.id]; deleteRemote(d.id); save(); V = { view: 'home' }; render(); } } }, '🗑 حذف')));
}

/* ---------- تصفح ---------- */
function browseView() {
  const p = getParsed(V.deckId);
  const cards = p.cards.filter((c) => !V.cats || V.cats.has(c.sec));
  return h('div', {},
    h('button', { class: 'btn sm ghost', onclick: () => { V.view = 'deck'; render(); } }, '→ رجوع'),
    h('h1', { class: 'page' }, 'تصفح الكروت (' + cards.length + ')'),
    cards.map((c) => h('details', { class: 'bc' },
      h('summary', {}, c.num ? h('span', { class: 'chip num' }, c.num) : null, h('span', { class: 'hl', dir: 'auto' }, c.kind === 'group' ? c.label : c.title), c.badge ? h('span', { class: 'chip ' + prioClass(c.badge) }, c.badge) : null),
      renderBlocks(c.blocks, false))));
}

/* ---------- عرض المحتوى ---------- */
function prioClass(t) { return /جدًا|جدا/.test(t) ? 'p1' : /عالية/.test(t) ? 'p2' : /متوسطة/.test(t) ? 'p3' : 'p4'; }

function itemEl(text, masked) {
  let num = null, body = text;
  const m = text.match(/^(\d{1,3})[.)]\s+(.*)$/);
  if (m) { num = m[1]; body = m[2]; }
  const el = h('div', { class: 'item' + (masked ? ' masked' : ''), dir: 'auto' });
  if (num) el.append(h('span', { class: 'n' }, num));
  const k = body.match(/^(.{2,60}?)(\s[–—-]\s|:\s)(.+)$/);
  const wrap = h('span', {});
  if (k) {
    const colon = k[2].trim() === ':';
    wrap.append(h('b', { class: 'key' }, colon ? k[1] + ':' : k[1]), (colon ? ' ' : k[2]) + k[3]);
  } else wrap.append(body);
  el.append(wrap);
  if (masked) el.addEventListener('click', () => el.classList.remove('masked'));
  return el;
}
function renderBlocks(blocks, reveal) {
  const box = h('div', {});
  blocks.forEach((b) => {
    if (b.type === 'p') box.append(h('div', { class: 'para', dir: 'auto' }, b.text));
    else if (b.type === 'group') {
      if (b.label) box.append(h('div', { class: 'glabel', dir: 'auto' }, h('span', { class: 'hl2' }, b.label)));
      box.append(h('div', { class: 'items' }, b.items.map((t) => itemEl(t, reveal))));
    } else if (b.type === 'table') {
      const [head, ...rows] = b.rows;
      box.append(h('table', { class: 't' }, h('thead', {}, h('tr', {}, head.map((c) => h('th', { dir: 'auto' }, c)))),
        h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { dir: 'auto' }, c)))))));
    }
  });
  if (reveal && box.querySelector('.masked')) {
    box.append(h('div', { class: 'actions', style: 'margin-top:10px' }, h('button', { class: 'btn sm', onclick: () => box.querySelectorAll('.masked').forEach((x) => x.classList.remove('masked')) }, '👁 اكشف الكل')));
  }
  return box;
}
function frontMain(c) { return c.kind === 'group' ? c.label : c.title; }

/* ---------- المذاكرة ---------- */
function startStudy(mode) {
  const p = getParsed(V.deckId), prog = S.progress[V.deckId] || {}, now = Date.now();
  const cards = p.cards.filter((c) => !V.cats || V.cats.has(c.sec));
  let q;
  if (mode === 'all') q = shuffle(cards);
  else {
    const due = cards.filter((c) => prog[c.id] && prog[c.id].due <= now);
    const fresh = cards.filter((c) => !prog[c.id]).slice(0, S.settings.newPerDay);
    q = shuffle(due).concat(fresh);
  }
  if (!q.length) { toast('مفيش كروت مستحقة دلوقتي 🎉 جرّب "كل الكروت"'); return; }
  V = Object.assign({}, V, { view: 'study', q, i: 0, flipped: false, typed: '', done: false, total: q.length, mode });
  render();
}
function daysLabel(d) { if (d <= 0) return 'الآن'; if (d === 1) return 'يوم'; if (d === 2) return 'يومين'; if (d <= 10) return d + ' أيام'; return d + ' يوم'; }
function nextDays(g, box) {
  if (g === 0) return 0;
  if (g === 1) return Math.max(1, Math.round(INT[Math.max(1, box)] / 2));
  return INT[Math.min(6, box + (g === 2 ? 1 : 2))];
}
function grade(g) {
  const c = V.q[V.i], prog = (S.progress[V.deckId] = S.progress[V.deckId] || {});
  const st = prog[c.id] || { box: 0, reps: 0, lapses: 0 }, now = Date.now();
  const days = nextDays(g, st.box);
  if (g === 0) { st.box = 0; st.lapses++; }
  else if (g === 1) st.box = Math.max(1, st.box);
  else st.box = Math.min(6, st.box + (g === 2 ? 1 : 2));
  st.reps++; st.last = now; st.due = g === 0 ? now : now + days * DAY;
  prog[c.id] = st; save(); pushProgress(V.deckId);
  if (g === 0) { const at = V.i + 4; at < V.q.length ? V.q.splice(at, 0, c) : V.q.push(c); }
  V.i++; V.flipped = false; V.typed = '';
  if (V.i >= V.q.length) V.done = true;
  render();
}
function flip() {
  if (V.view !== 'study' || V.done) return;
  V.flipped = !V.flipped;
  const inner = $('.card-inner');
  if (!inner) return;
  if (V.flipped) {
    const back = inner.querySelector('.back'), old = back.querySelector('.yours');
    if (old) old.remove();
    if (V.typed.trim()) back.querySelector('.head').after(h('div', { class: 'yours' }, h('small', {}, 'إجابتك:'), V.typed));
  }
  inner.classList.toggle('flipped', V.flipped);
  updateControls();
}
function updateControls() { const ctl = $('#controls'); if (ctl) ctl.replaceChildren(controls()); }

function controls() {
  if (!V.flipped) return h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: flip }, 'اعرض الإجابة  (Space)'));
  const st = (S.progress[V.deckId] || {})[V.q[V.i].id] || { box: 0 };
  const g = (n, label) => h('button', { class: 'grade g' + n, onclick: () => grade(n) }, label, h('small', {}, daysLabel(nextDays(n, st.box)) + ' · ' + (n + 1)));
  return h('div', { class: 'actions' }, g(0, 'نسيت'), g(1, 'صعب'), g(2, 'تمام'), g(3, 'سهل'));
}

function studyView() {
  if (V.done) {
    return h('div', { class: 'done' }, h('div', { class: 'big' }, '🎉'), h('h1', { class: 'page' }, 'خلصت الجلسة!'),
      h('p', { class: 'sub' }, 'الكروت اللي ما كنتش فاكرها هترجعلك في الوقت المناسب تلقائيًا.'),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:16px' },
        h('button', { class: 'btn primary', onclick: () => { V.view = 'deck'; render(); } }, 'رجوع للمجموعة'),
        h('button', { class: 'btn', onclick: () => startStudy(V.mode) }, 'جلسة جديدة')));
  }
  const c = V.q[V.i], pct = Math.round((Math.min(V.i, V.total) / V.total) * 100);

  const front = h('div', { class: 'face front' },
    h('div', { class: 'meta' }, c.num ? h('span', { class: 'chip num' }, c.num) : null, c.badge ? h('span', { class: 'chip ' + prioClass(c.badge) }, c.badge) : null),
    c.kind === 'group' ? h('div', { class: 'q-sub', dir: 'auto' }, c.title) : null,
    h('h2', { class: 'q-title', dir: 'auto' }, h('span', { class: c.kind === 'group' ? 'hl2' : 'hl' }, frontMain(c))),
    S.settings.typed ? h('textarea', { class: 'typed', placeholder: 'اكتب اللي فاكره قبل ما تقلب الكارت…', dir: 'auto', value: V.typed, oninput: (e) => (V.typed = e.target.value) }) : null,
    h('div', { class: 'hint' }, S.settings.typed ? 'افتكر واكتب، وبعدين اعرض الإجابة' : 'حاول تفتكر الإجابة كاملة قبل ما تقلب الكارت'));

  const back = h('div', { class: 'face back' },
    h('div', { class: 'head' }, h('div', { class: 't', dir: 'auto' }, h('span', { class: 'hl' }, c.title), c.kind === 'group' ? [' ← ', h('span', { class: 'hl2' }, c.label)] : null),
      h('div', { class: 'meta', style: 'margin:0' }, c.num ? h('span', { class: 'chip num' }, c.num) : null, c.badge ? h('span', { class: 'chip ' + prioClass(c.badge) }, c.badge) : null)),
    V.typed.trim() ? h('div', { class: 'yours' }, h('small', {}, 'إجابتك:'), V.typed) : null,
    renderBlocks(c.blocks, S.settings.reveal));

  return h('div', {},
    h('div', { class: 'row', style: 'margin-bottom:6px' },
      h('button', { class: 'btn sm ghost', onclick: () => { V.view = 'deck'; render(); } }, '✕ إنهاء'),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' })),
      h('span', { class: 'sub' }, Math.min(V.i + 1, V.q.length) + ' / ' + V.q.length)),
    h('div', { class: 'card3d' }, h('div', { class: 'card-inner' + (V.flipped ? ' flipped' : '') }, front, back)),
    h('div', { id: 'controls' }, controls()),
    h('div', { class: 'hint', style: 'text-align:center;margin-top:14px' }, 'اختصارات: Space = قلب · 1 نسيت · 2 صعب · 3 تمام · 4 سهل'));
}

document.addEventListener('keydown', (e) => {
  if (V.view !== 'study' || V.done) return;
  if (/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); flip(); } return; }
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!V.flipped) flip(); }
  else if (V.flipped && '1234'.includes(e.key) && e.key) grade(+e.key - 1);
});

/* ================= تشغيل ================= */
seed();
initFirebase();
render();
})();
