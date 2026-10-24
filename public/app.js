// LaTeX Studio front end.
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(c));
  return e;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem('studio.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('studio.' + k, JSON.stringify(v)); } catch {} },
};

// ---------- file-type helpers ----------

const TEXT_EXT = /\.(tex|ltx|bib|cls|sty|bst|bbx|cbx|dtx|ins|def|cfg|clo|txt|md|csv|tsv|dat|lua|py|m|r|c|h|cpp|hpp|java|js|ts|json|xml|ya?ml|sh|bat|ini|toml|gitignore)$/i;
const GRAPHIC_EXT = /\.(png|jpe?g|pdf|eps)$/i;          // what the engine can include directly
const CONVERT_EXT = /\.(svg|gif|webp|bmp|avif)$/i;      // browser converts these to PNG on upload
const IMAGE_PREVIEW_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const CODE_EXT = /\.(py|m|r|c|h|cpp|hpp|java|js|ts|sh|lua)$/i;
const isText = (p) => TEXT_EXT.test(p);
const ext = (p) => (p.match(/\.([^./]+)$/) || [, ''])[1].toLowerCase();
const base = (p) => p.split('/').pop();
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const joinPath = (d, n) => (d ? d.replace(/\/$/, '') + '/' + n : n);
const fmtSize = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

function relative(fromDir, to) {
  const a = fromDir ? fromDir.split('/') : [];
  const b = to.split('/');
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

const ICONS = {
  folder: '<svg viewBox="0 0 24 24" fill="#d9a441"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
  folderOpen: '<svg viewBox="0 0 24 24" fill="#e2b04f"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5V10H7.2a1.5 1.5 0 0 0-1.4 1L3.4 18.2A1.5 1.5 0 0 1 3 17.5z"/><path d="M6.6 11.5h15l-2.3 6.4a1.5 1.5 0 0 1-1.4 1.1H4.2z"/></svg>',
  tex: '<svg viewBox="0 0 24 24"><path fill="#138a52" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" opacity=".9" d="M14 2v5h5"/><text x="11.5" y="18" font-size="7" font-weight="700" fill="#fff" text-anchor="middle" font-family="Georgia">TeX</text></svg>',
  bib: '<svg viewBox="0 0 24 24"><path fill="#7a52b3" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" opacity=".9" d="M14 2v5h5"/><text x="11.5" y="18" font-size="7" font-weight="700" fill="#fff" text-anchor="middle">bib</text></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="#3b82c4"/><circle cx="9" cy="9.5" r="2" fill="#fff"/><path d="M5 18l5-5 3 3 2.5-2.5L20 18z" fill="#cfe4f7"/></svg>',
  pdf: '<svg viewBox="0 0 24 24"><path fill="#d0453b" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" opacity=".9" d="M14 2v5h5"/><text x="11.5" y="18" font-size="6.5" font-weight="700" fill="#fff" text-anchor="middle">PDF</text></svg>',
  file: '<svg viewBox="0 0 24 24"><path fill="#8a958f" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" opacity=".9" d="M14 2v5h5"/></svg>',
  'new-file': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13 3v6h6M12 12v6M9 15h6"/></svg>',
  'new-folder': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  'upload-folder': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 16.5v-6M9.5 13 12 10.5l2.5 2.5"/></svg>',
  'import-url': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};
function iconFor(path, type, open) {
  if (type === 'dir') return open ? ICONS.folderOpen : ICONS.folder;
  const e = ext(path);
  if (['tex', 'ltx', 'sty', 'cls'].includes(e)) return ICONS.tex;
  if (e === 'bib') return ICONS.bib;
  if (e === 'pdf') return ICONS.pdf;
  if (IMAGE_PREVIEW_EXT.test(path) || e === 'eps') return ICONS.image;
  return ICONS.file;
}

// ---------- state ----------

const state = {
  project: null,
  files: [],                // [{path, type, size, mtime}]
  settings: {},
  docs: new Map(),          // path -> { doc, cleanGen, saving, timer, failed }
  tabs: [],
  active: null,
  openDirs: new Set(),
  selectedDir: '',
  engines: [],
  compiling: false,
  compileQueued: false,
  autoCompile: store.get('autoCompile', false),
  result: null,
  problemMarks: [],
};

// ---------- API ----------

async function api(action, { method = 'GET', query, body, raw } = {}) {
  const qs = query ? '?' + new URLSearchParams(query) : '';
  const opts = { method };
  if (raw !== undefined) opts.body = raw;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers = { 'Content-Type': 'application/json' }; }
  const res = await fetch(`/api/projects/${encodeURIComponent(state.project)}/${action}${qs}`, opts);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res;
}
const apiJson = async (...a) => (await api(...a)).json();
const fileUrl = (p, bust) => `/api/projects/${encodeURIComponent(state.project)}/file?path=${encodeURIComponent(p)}${bust ? '&t=' + bust : ''}`;
const outputUrl = (name, extra = '') => `/api/projects/${encodeURIComponent(state.project)}/output?name=${encodeURIComponent(name)}${extra}`;

// ---------- UI helpers ----------

function toast(msg, kind = '', { action, timeout = kind === 'error' ? 7000 : 3500 } = {}) {
  const t = h('div', { class: 'toast ' + kind }, h('span', {}, msg));
  if (action) t.append(h('button', { onclick: () => { action.fn(); t.remove(); } }, action.label));
  $('#toasts').append(t);
  if (timeout) setTimeout(() => t.remove(), timeout);
  return t;
}

// fields: [{name, label, type, value, placeholder, options:[[value,label]]}]
function modal({ title, text, fields = [], ok = 'OK', danger = false, extra }) {
  return new Promise((resolve) => {
    const form = $('#modalForm');
    form.innerHTML = '';
    form.append(h('h3', {}, title));
    if (text) form.append(h('p', {}, text));
    for (const f of fields) {
      let input;
      if (f.type === 'select') {
        input = h('select', { name: f.name }, (f.options || []).map(([v, l]) => h('option', { value: v, selected: v === f.value }, l)));
      } else if (f.type === 'file') {
        input = h('input', { type: 'file', name: f.name, accept: f.accept });
      } else {
        input = h('input', { type: f.type || 'text', name: f.name, value: f.value ?? '', placeholder: f.placeholder || '', min: f.min, max: f.max, spellcheck: 'false' });
      }
      form.append(f.label ? h('label', {}, f.label, input) : input);
    }
    if (extra) form.append(extra);
    const done = (v) => { $('#modal').hidden = true; form.onsubmit = null; document.removeEventListener('keydown', esc, true); resolve(v); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    form.append(h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => done(null) }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn ' + (danger ? 'danger' : 'primary') }, ok)));
    form.onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        const el = form.elements[f.name];
        out[f.name] = f.type === 'file' ? el.files[0] || null : el.value.trim();
      }
      done(out);
    };
    document.addEventListener('keydown', esc, true);
    $('#modal').hidden = false;
    const first = form.querySelector('input:not([type=file]), select');
    if (first) { first.focus(); if (first.select) first.select(); }
  });
}
const confirmBox = (title, text, ok = 'Delete') => modal({ title, text, ok, danger: true }).then(Boolean);

function showMenu(x, y, items) {
  const menu = $('#ctxMenu');
  menu.innerHTML = '';
  for (const it of items) {
    if (it === '-') { menu.append(h('hr')); continue; }
    menu.append(h('button', { class: it.danger ? 'danger' : '', onclick: () => { hideMenu(); it.fn(); } }, it.label));
  }
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}
function hideMenu() { $('#ctxMenu').hidden = true; }

// ---------- editor ----------

const cm = CodeMirror($('#editorHost'), {
  mode: 'stex',
  lineNumbers: true,
  lineWrapping: true,
  matchBrackets: true,
  autoCloseBrackets: { pairs: '()[]{}$$', explode: '[]{}' },
  styleActiveLine: true,
  indentUnit: 2,
  tabSize: 2,
  indentWithTabs: false,
  spellcheck: true,
  inputStyle: 'contenteditable',
  extraKeys: {
    'Ctrl-Enter': () => compile(), 'Cmd-Enter': () => compile(),
    'Ctrl-S': () => compile(), 'Cmd-S': () => compile(),
    'Ctrl-B': () => wrapCommand('textbf'), 'Cmd-B': () => wrapCommand('textbf'),
    'Ctrl-I': () => wrapCommand('textit'), 'Cmd-I': () => wrapCommand('textit'),
    'Ctrl-/': (c) => c.toggleComment(), 'Cmd-/': (c) => c.toggleComment(),
    'Ctrl-Space': (c) => c.showHint({ hint: latexHint, completeSingle: false }),
    'Ctrl-Alt-Right': () => syncToPdf(), 'Alt-G': 'jumpToLine',
    Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  ', 'end')),
    'Shift-Tab': (c) => c.indentSelection('subtract'),
  },
});

const hintCtx = {
  labels() {
    const out = [];
    for (const [p, d] of state.docs) {
      if (!/\.(tex|ltx)$/i.test(p)) continue;
      for (const m of d.doc.getValue().matchAll(/\\label\{([^}]+)\}/g)) out.push({ label: m[1], file: base(p) });
    }
    return out;
  },
  citeKeys() {
    const out = [];
    for (const [p, d] of state.docs) {
      const text = d.doc.getValue();
      if (/\.bib$/i.test(p)) {
        for (const m of text.matchAll(/@(\w+)\s*[{(]\s*([^,\s]+)\s*,([\s\S]*?)(?=\n\s*@|$)/g)) {
          if (/^(comment|string|preamble)$/i.test(m[1])) continue;
          const title = (m[3].match(/\btitle\s*=\s*[{"]((?:[^{}"]|\{[^{}]*\})*)/i) || [])[1];
          const clean = title && title.replace(/\\[A-Za-z]+\s*|[{}]/g, (s) => (s.startsWith('\\') ? s.slice(1).trim() : '')).trim();
          out.push({ key: m[2], title: clean ? clean.slice(0, 40) : m[1] });
        }
      } else if (/\.tex$/i.test(p)) {
        for (const m of text.matchAll(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g)) out.push({ key: m[1], title: 'bibitem' });
      }
    }
    return out;
  },
  files: () => state.files.filter((f) => f.type === 'file').map((f) => f.path),
  relPath: (p) => relative(dirOf(mainPath()), p),
  graphicPath: (p) => graphicPath(p),
  userCommands() {
    const out = [];
    for (const [p, d] of state.docs) {
      if (!/\.(tex|sty|cls)$/i.test(p)) continue;
      for (const m of d.doc.getValue().matchAll(/\\(?:re)?newcommand\*?\{?\\([A-Za-z@]+)\}?(?:\[(\d)\])?|\\DeclareMathOperator\*?\{\\([A-Za-z]+)\}|\\def\\([A-Za-z@]+)/g)) {
        out.push({ name: m[1] || m[3] || m[4], args: m[2] ? Number(m[2]) : 0 });
      }
    }
    return out;
  },
};
const latexHint = window.makeLatexHint(hintCtx);

// Open the completion popup while typing. With closebrackets, "{" arrives as a single "{}" change.
// The check is deferred: typing "{" right after "\ref" closes the command popup within the same operation.
cm.on('change', (c, change) => {
  const typed = change.text.join('\n');
  const isTyping = (change.origin === '+input' || change.origin == null) && /^(?:[\\{,A-Za-z]|\{\})$/.test(typed);
  if (!isTyping) return;
  setTimeout(() => {
    if (c.state.completionActive) return;
    const res = latexHint(c);
    if (res && res.list.length && !(res.list.length === 1 && res.list[0].text === c.getRange(res.from, res.to))) {
      c.showHint({ hint: latexHint, completeSingle: false });
    }
  }, 0);
});
cm.on('cursorActivity', () => {
  const p = cm.getCursor();
  $('#statusPos').textContent = `Ln ${p.line + 1}, Col ${p.ch + 1}`;
});

function mainPath() { return state.settings.main || 'main.tex'; }

// Path to use inside \includegraphics, relative to the main file and to \graphicspath.
function graphicPath(p) {
  const rel = relative(dirOf(mainPath()), p);
  const main = state.docs.get(mainPath());
  const gp = main && main.doc.getValue().match(/^[^%\n]*\\graphicspath\s*\{((?:\{[^}]*\}\s*)+)\}/m);
  if (gp) {
    for (const m of gp[1].matchAll(/\{([^}]*)\}/g)) {
      const prefix = m[1].replace(/^\.\//, '');
      if (prefix && rel.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) return rel.slice(prefix.length + (prefix.endsWith('/') ? 0 : 1));
    }
  }
  return rel;
}

// ---------- documents & saving ----------

function modeFor(p) { return /\.(tex|ltx|sty|cls|bib|bbx|cbx|dtx|ins|def|cfg|clo)$/i.test(p) ? 'stex' : null; }

function registerDoc(path, text) {
  const doc = CodeMirror.Doc(text, modeFor(path));
  const entry = { doc, cleanGen: doc.changeGeneration(), saving: null, timer: null, failed: false };
  doc.on('change', () => {
    renderDirty(path);
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => saveDoc(path), 700);
    if (state.autoCompile) scheduleAutoCompile();
  });
  state.docs.set(path, entry);
  return entry;
}

const isDirty = (entry) => !entry.doc.isClean(entry.cleanGen);

async function saveDoc(path) {
  const entry = state.docs.get(path);
  if (!entry) return;
  clearTimeout(entry.timer);
  if (entry.saving) await entry.saving;
  if (!isDirty(entry)) return;
  const gen = entry.doc.changeGeneration();
  const text = entry.doc.getValue();
  setSaveStatus('Saving…', 'saving');
  entry.saving = api('file', { method: 'PUT', query: { path }, raw: text })
    .then(() => { entry.cleanGen = gen; entry.failed = false; })
    .catch((e) => { entry.failed = true; setSaveStatus('Save failed: ' + e.message, 'error'); entry.timer = setTimeout(() => saveDoc(path), 3000); })
    .finally(() => { entry.saving = null; renderDirty(path); });
  await entry.saving;
}

async function flushAll() {
  await Promise.all([...state.docs.keys()].map(saveDoc));
}

function renderDirty(path) {
  const entry = state.docs.get(path);
  const dirty = entry && isDirty(entry);
  const tab = $$('.tab').find((t) => t.dataset.path === path);
  if (tab) tab.classList.toggle('dirty', !!dirty);
  const any = [...state.docs.values()].some(isDirty);
  const failed = [...state.docs.values()].some((e) => e.failed);
  if (!failed) setSaveStatus(any ? 'Unsaved changes' : 'All changes saved', any ? 'saving' : '');
}
function setSaveStatus(text, cls) { const s = $('#statusSave'); s.textContent = text; s.className = cls || ''; }

window.addEventListener('beforeunload', (e) => {
  if ([...state.docs.values()].some(isDirty)) { flushAll(); e.preventDefault(); e.returnValue = ''; }
});

// ---------- projects ----------

async function loadProjects(select) {
  const list = await (await fetch('/api/projects')).json();
  const sel = $('#projectSelect');
  sel.innerHTML = '';
  for (const p of list) sel.append(h('option', { value: p.name }, p.name));
  const name = select && list.some((p) => p.name === select) ? select : list[0] && list[0].name;
  if (name) { sel.value = name; await openProject(name); }
}

async function openProject(name) {
  if (state.project) { await flushAll(); persistTabs(); }
  state.project = name;
  store.set('project', name);
  state.docs.clear();
  state.tabs = [];
  state.active = null;
  state.result = null;
  state.problemMarks = [];
  state.openDirs = new Set(store.get('openDirs.' + name, ['images']));
  renderProblems(null);
  await refreshTree();
  await Promise.all(state.files.filter((f) => f.type === 'file' && isText(f.path) && f.size < 4e6)
    .map(async (f) => registerDoc(f.path, await (await api('file', { query: { path: f.path } })).text())));
  renderMainSelect();
  $('#engineSelect').value = state.settings.engine && state.engines.some((e) => e.id === state.settings.engine) ? state.settings.engine : (state.engines[0] || {}).id || '';

  const saved = store.get('tabs.' + name, null);
  const tabs = (saved && saved.tabs || []).filter((p) => state.files.some((f) => f.path === p));
  if (!tabs.length && state.files.some((f) => f.path === mainPath())) tabs.push(mainPath());
  state.tabs = tabs;
  const active = saved && tabs.includes(saved.active) ? saved.active : tabs[0];
  if (active) openFile(active); else showEmpty();
  renderTabs();

  // Show the last build, if there is one.
  viewer.clear();
  const pdfName = base(mainPath()).replace(/\.tex$/i, '') + '.pdf';
  const head = await fetch(outputUrl(pdfName), { method: 'GET' }).catch(() => null);
  if (head && head.ok) await viewer.load(pdfName, Date.now(), await head.arrayBuffer());
}

function persistTabs() {
  if (!state.project) return;
  store.set('tabs.' + state.project, { tabs: state.tabs, active: state.active });
  store.set('openDirs.' + state.project, [...state.openDirs]);
}

async function refreshTree() {
  const { files, settings } = await apiJson('tree');
  state.files = files;
  state.settings = settings || {};
  renderTree();
}

function renderMainSelect() {
  const sel = $('#mainSelect');
  const tex = state.files.filter((f) => f.type === 'file' && /\.tex$/i.test(f.path)).map((f) => f.path);
  const isRoot = (p) => /\\documentclass/.test((state.docs.get(p) || { doc: { getValue: () => '' } }).doc.getValue());
  tex.sort((a, b) => isRoot(b) - isRoot(a) || a.localeCompare(b));
  sel.innerHTML = '';
  for (const p of tex) sel.append(h('option', { value: p }, p));
  if (!tex.includes(mainPath()) && tex.length) state.settings.main = tex.find(isRoot) || tex[0];
  sel.value = mainPath();
}

// ---------- tree ----------

function renderTree() {
  const tree = $('#tree');
  const scroll = tree.scrollTop;
  tree.innerHTML = '';
  const children = new Map();
  for (const f of state.files) {
    const d = dirOf(f.path);
    if (!children.has(d)) children.set(d, []);
    children.get(d).push(f);
  }
  const walk = (dir, depth) => {
    const items = (children.get(dir) || []).sort((a, b) => (a.type === b.type ? base(a.path).localeCompare(base(b.path), undefined, { numeric: true }) : a.type === 'dir' ? -1 : 1));
    for (const f of items) {
      const open = f.type === 'dir' && state.openDirs.has(f.path);
      const node = h('div', {
        class: 'node' + (open ? ' open' : '') + (f.path === state.active ? ' active' : ''),
        'data-path': f.path, 'data-type': f.type, draggable: 'true', title: f.path + (f.size != null ? ` · ${fmtSize(f.size)}` : ''),
        style: `padding-left:${8 + depth * 14}px`,
      },
      h('span', { class: 'chev' }, f.type === 'dir' ? '▶' : ''),
      h('span', { class: 'ficon', html: iconFor(f.path, f.type, open) }),
      h('span', { class: 'name' }, base(f.path)),
      f.path === mainPath() ? h('span', { class: 'main-tag', title: 'Main document' }, 'MAIN') : null);
      tree.append(node);
      if (open) walk(f.path, depth + 1);
    }
  };
  walk('', 0);
  if (!state.files.length) tree.append(h('div', { class: 'logs-empty' }, 'Empty project — upload or create a file.'));
  tree.scrollTop = scroll;
}

$('#tree').addEventListener('click', (e) => {
  const node = e.target.closest('.node');
  if (!node) { state.selectedDir = ''; return; }
  const { path, type } = node.dataset;
  if (type === 'dir') {
    state.selectedDir = path;
    if (state.openDirs.has(path)) state.openDirs.delete(path); else state.openDirs.add(path);
    renderTree();
    persistTabs();
  } else {
    state.selectedDir = dirOf(path);
    openFile(path);
  }
});

$('#tree').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const node = e.target.closest('.node');
  if (!node) {
    return showMenu(e.clientX, e.clientY, [
      { label: 'New file', fn: () => newFile('') }, { label: 'New folder', fn: () => newFolder('') },
      { label: 'Upload files…', fn: () => pickUpload('') }, { label: 'Import from URL…', fn: () => importUrl('') },
    ]);
  }
  const { path, type } = node.dataset;
  if (type === 'dir') {
    showMenu(e.clientX, e.clientY, [
      { label: 'New file here', fn: () => newFile(path) }, { label: 'New folder here', fn: () => newFolder(path) },
      { label: 'Upload files here…', fn: () => pickUpload(path) }, { label: 'Import from URL here…', fn: () => importUrl(path) },
      '-', { label: 'Rename / move…', fn: () => renamePath(path) }, { label: 'Delete folder', danger: true, fn: () => deletePath(path, true) },
    ]);
  } else {
    const items = [{ label: 'Open', fn: () => openFile(path) }];
    if (referenceFor(path)) items.push({ label: 'Insert into document', fn: () => insertReference(path) });
    if (GRAPHIC_EXT.test(path)) items.push({ label: 'Insert \\includegraphics only', fn: () => insertReference(path, { figure: false }) });
    if (/\.tex$/i.test(path) && path !== mainPath()) items.push({ label: 'Set as main document', fn: () => setMain(path) });
    items.push('-', { label: 'Download', fn: () => downloadFile(path) }, { label: 'Rename / move…', fn: () => renamePath(path) },
      { label: 'Delete', danger: true, fn: () => deletePath(path, false) });
    showMenu(e.clientX, e.clientY, items);
  }
});

document.addEventListener('mousedown', (e) => { if (!e.target.closest('#ctxMenu')) hideMenu(); });
document.addEventListener('scroll', hideMenu, true);

// Toolbar buttons in the file pane.
for (const b of $$('.sidebar .icon-btn')) b.innerHTML = ICONS[b.dataset.act] || '';
$('.sidebar .icon-row').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const dir = state.selectedDir;
  ({ 'new-file': () => newFile(dir), 'new-folder': () => newFolder(dir), upload: () => pickUpload(dir),
    'upload-folder': () => pickUpload(dir, true), 'import-url': () => importUrl(dir) })[b.dataset.act]();
});

async function newFile(dir) {
  const r = await modal({ title: 'New file', text: dir ? `In folder “${dir}”` : 'Use .tex for chapters, .bib for references.', fields: [{ name: 'name', value: 'chapter1.tex' }], ok: 'Create' });
  if (!r || !r.name) return;
  const path = joinPath(dir, r.name.replace(/^\/+/, ''));
  try {
    const content = /\.tex$/i.test(path) ? `\\section{${base(path).replace(/\.tex$/i, '').replace(/[-_]/g, ' ')}}\n\n` : '';
    await api('file', { method: 'PUT', query: { path, overwrite: '0' }, raw: content });
    if (isText(path)) registerDoc(path, content);
    expandTo(path);
    await refreshTree();
    renderMainSelect();
    openFile(path);
    if (/\.tex$/i.test(path) && path !== mainPath()) {
      toast(`Created ${base(path)}`, 'ok', { action: { label: 'Insert \\input', fn: () => insertReference(path, { into: mainPath() }) } });
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function newFolder(dir) {
  const r = await modal({ title: 'New folder', fields: [{ name: 'name', value: dir ? '' : 'images', placeholder: 'folder name' }], ok: 'Create' });
  if (!r || !r.name) return;
  const path = joinPath(dir, r.name);
  try {
    await api('folder', { method: 'POST', body: { path } });
    state.openDirs.add(path); expandTo(path);
    await refreshTree();
  } catch (e) { toast(e.message, 'error'); }
}

function expandTo(path) { let d = dirOf(path); while (d) { state.openDirs.add(d); d = dirOf(d); } }

async function renamePath(path) {
  const r = await modal({ title: 'Rename or move', text: 'Use a path to move it, e.g. figures/plot.png', fields: [{ name: 'to', value: path }], ok: 'Rename' });
  if (!r || !r.to || r.to === path) return;
  try {
    await flushAll();
    await api('rename', { method: 'POST', body: { from: path, to: r.to } });
    const remap = (p) => (p === path ? r.to : p.startsWith(path + '/') ? r.to + p.slice(path.length) : p);
    state.docs = new Map([...state.docs].map(([p, d]) => [remap(p), d]));
    state.tabs = state.tabs.map(remap);
    if (state.active) state.active = remap(state.active);
    if (remap(mainPath()) !== mainPath()) await setMain(remap(mainPath()), true);
    expandTo(r.to);
    await refreshTree();
    renderTabs(); renderMainSelect();
    if (state.active) openFile(state.active);
    toast('Renamed. Remember to update any \\includegraphics / \\input that pointed at the old path.', 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

async function deletePath(path, isDir) {
  if (!(await confirmBox(`Delete ${isDir ? 'folder' : 'file'}?`, `“${path}” will be permanently deleted${isDir ? ' with everything inside it' : ''}.`))) return;
  try {
    await api('file', { method: 'DELETE', query: { path } });
    const gone = (p) => p === path || p.startsWith(path + '/');
    for (const p of [...state.docs.keys()]) if (gone(p)) { clearTimeout(state.docs.get(p).timer); state.docs.delete(p); }
    state.tabs = state.tabs.filter((p) => !gone(p));
    if (state.active && gone(state.active)) { state.active = null; state.tabs[0] ? openFile(state.tabs[0]) : showEmpty(); }
    await refreshTree();
    renderTabs(); renderMainSelect();
  } catch (e) { toast(e.message, 'error'); }
}

function downloadFile(path) {
  const a = h('a', { href: fileUrl(path), download: base(path) });
  document.body.append(a); a.click(); a.remove();
}

async function setMain(path, quiet) {
  state.settings = await apiJson('settings', { method: 'POST', body: { main: path } });
  renderMainSelect(); renderTree();
  if (!quiet) toast(`${path} is now the main document`, 'ok');
}

// ---------- tabs & opening files ----------

function openFile(path) {
  const f = state.files.find((x) => x.path === path);
  if (!f) return;
  if (!state.tabs.includes(path)) state.tabs.push(path);
  state.active = path;
  expandTo(path);
  const entry = state.docs.get(path);
  if (entry) {
    $('#mediaView').hidden = true; $('#emptyEditor').hidden = true; $('#editorHost').hidden = false;
    $('#editorPane').classList.remove('media');
    if (cm.getDoc() !== entry.doc) cm.swapDoc(entry.doc);
    cm.refresh();
    cm.focus();
  } else {
    showMedia(f);
  }
  $('#statusFile').textContent = path;
  renderTabs(); renderTree(); persistTabs();
}

function showEmpty() {
  $('#editorHost').hidden = true; $('#mediaView').hidden = true; $('#emptyEditor').hidden = false;
  $('#statusFile').textContent = '';
}

function showMedia(f) {
  const view = $('#mediaView');
  $('#editorHost').hidden = true; $('#emptyEditor').hidden = true; view.hidden = false;
  $('#editorPane').classList.add('media');
  view.innerHTML = '';
  const url = fileUrl(f.path, f.mtime);
  const info = h('div', { class: 'media-info' }, h('code', {}, f.path), h('span', {}, fmtSize(f.size || 0)));
  if (IMAGE_PREVIEW_EXT.test(f.path)) {
    const img = h('img', { src: url, alt: f.path });
    img.onload = () => info.insertBefore(h('span', {}, `${img.naturalWidth} × ${img.naturalHeight}px`), info.children[2] || null);
    view.append(img);
  } else if (ext(f.path) === 'pdf') {
    view.append(h('iframe', { src: url, title: f.path }));
  } else {
    view.append(h('div', { class: 'logs-empty' }, ext(f.path) === 'eps' ? 'EPS files cannot be previewed in the browser, but compile fine.' : 'No preview for this file type.'));
  }
  if (referenceFor(f.path)) {
    info.append(h('button', { class: 'btn primary', onclick: () => insertReference(f.path) }, GRAPHIC_EXT.test(f.path) ? 'Insert as figure' : 'Insert into document'));
  }
  if (CONVERT_EXT.test(f.path)) {
    info.append(h('button', { class: 'btn', onclick: () => convertExisting(f.path) }, 'Make LaTeX-ready PNG'));
  }
  info.append(h('button', { class: 'btn', onclick: () => downloadFile(f.path) }, 'Download'));
  view.append(info);
}

function renderTabs() {
  const tabs = $('#tabs');
  tabs.innerHTML = '';
  for (const p of state.tabs) {
    const entry = state.docs.get(p);
    const t = h('div', { class: 'tab' + (p === state.active ? ' active' : '') + (entry && isDirty(entry) ? ' dirty' : ''), 'data-path': p, title: p },
      h('span', { class: 'ficon', html: iconFor(p, 'file'), style: 'width:14px;height:14px;display:inline-grid' }),
      h('span', { class: 'tname' }, base(p)),
      h('button', { class: 'tclose', title: 'Close' }, h('span', {}, '×')));
    tabs.append(t);
  }
  for (const s of $$('.tab .ficon svg', tabs)) { s.style.width = '14px'; s.style.height = '14px'; }
}

$('#tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const p = tab.dataset.path;
  if (e.target.closest('.tclose')) closeTab(p); else openFile(p);
});
$('#tabs').addEventListener('auxclick', (e) => { const tab = e.target.closest('.tab'); if (tab && e.button === 1) closeTab(tab.dataset.path); });

function closeTab(p) {
  saveDoc(p);
  const i = state.tabs.indexOf(p);
  state.tabs.splice(i, 1);
  if (state.active === p) {
    const next = state.tabs[Math.min(i, state.tabs.length - 1)];
    state.active = null;
    if (next) openFile(next); else { showEmpty(); renderTree(); }
  }
  renderTabs(); persistTabs();
}

// ---------- uploads & media linking ----------

function pickUpload(dir, folder = false) {
  const input = folder ? $('#folderInput') : $('#fileInput');
  input.value = '';
  input.onchange = async () => {
    const list = [...input.files].map((f) => ({ file: f, rel: folder && f.webkitRelativePath ? f.webkitRelativePath : f.name }));
    if (list.length) await uploadFiles(list, dir);
  };
  input.click();
}

// Rasterise SVG/GIF/WebP/BMP to PNG so the LaTeX engine can include it.
async function toPng(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not decode image')); i.src = url; });
    let w = img.naturalWidth || 1200; let hgt = img.naturalHeight || 900;
    const isSvg = blob.type === 'image/svg+xml';
    const scale = isSvg ? Math.min(4, Math.max(1, 2400 / w)) : 1; // vectors get rendered crisp at print resolution
    w = Math.round(w * scale); hgt = Math.round(hgt * scale);
    const c = h('canvas', { width: w, height: hgt });
    c.getContext('2d').drawImage(img, 0, 0, w, hgt);
    return await new Promise((res) => c.toBlob(res, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

async function convertExisting(path) {
  try {
    const blob = await (await api('file', { query: { path } })).blob();
    const png = await toPng(blob);
    const target = path.replace(/\.[^.]+$/, '.png');
    await api('file', { method: 'PUT', query: { path: target }, raw: png });
    await refreshTree();
    toast(`Created ${target}`, 'ok', { action: { label: 'Insert', fn: () => insertReference(target) } });
  } catch (e) { toast(e.message, 'error'); }
}

// list: [{file: File|Blob, rel: 'sub/dir/name.ext'}]; returns the project paths that were written.
async function uploadFiles(list, dir) {
  const targets = list.map((it) => ({ ...it, path: joinPath(dir, it.rel.replace(/\\/g, '/')) }));
  const clashes = targets.filter((t) => state.files.some((f) => f.path === t.path));
  if (clashes.length && !(await modal({ title: 'Overwrite files?', text: `${clashes.length} file(s) already exist: ${clashes.slice(0, 4).map((c) => c.path).join(', ')}${clashes.length > 4 ? '…' : ''}`, ok: 'Overwrite', danger: true }))) return [];
  const done = [];
  const progress = toast(`Uploading 0 / ${targets.length}…`, '', { timeout: 0 });
  try {
    for (const t of targets) {
      await api('file', { method: 'PUT', query: { path: t.path }, raw: t.file });
      done.push(t.path);
      if (CONVERT_EXT.test(t.path)) {
        try {
          const png = await toPng(t.file);
          const pngPath = t.path.replace(/\.[^.]+$/, '.png');
          await api('file', { method: 'PUT', query: { path: pngPath }, raw: png });
          done.push(pngPath);
        } catch (e) { toast(`${base(t.path)}: ${e.message}`, 'error'); }
      }
      if (isText(t.path)) {
        const text = await t.file.text();
        const existing = state.docs.get(t.path);
        if (existing) { existing.doc.setValue(text); existing.cleanGen = existing.doc.changeGeneration(); } else registerDoc(t.path, text);
      }
      progress.firstChild.textContent = `Uploading ${done.length} / ${targets.length}…`;
    }
  } catch (e) {
    toast('Upload failed: ' + e.message, 'error');
  } finally {
    progress.remove();
  }
  for (const p of done) expandTo(p);
  await refreshTree();
  renderMainSelect();
  if (done.length) toast(`Uploaded ${done.length} file${done.length > 1 ? 's' : ''}`, 'ok');
  return done;
}

async function importUrl(dir) {
  const r = await modal({
    title: 'Import from URL', text: 'Downloads a file (image, PDF, .bib, …) straight into the project.',
    fields: [{ name: 'url', type: 'url', placeholder: 'https://…/figure.png', label: 'URL' },
      { name: 'path', placeholder: dir ? dir + '/name.png' : 'images/name.png (optional)', label: 'Save as' }],
    ok: 'Import',
  });
  if (!r || !r.url) return null;
  try {
    let target = r.path;
    if (!target && dir) target = joinPath(dir, decodeURIComponent(new URL(r.url).pathname.split('/').pop() || 'download'));
    const res = await apiJson('import-url', { method: 'POST', body: { url: r.url, path: target || undefined } });
    let path = res.path;
    if (CONVERT_EXT.test(path)) {
      const png = await toPng(await (await api('file', { query: { path } })).blob());
      path = path.replace(/\.[^.]+$/, '.png');
      await api('file', { method: 'PUT', query: { path }, raw: png });
    }
    if (isText(path)) registerDoc(path, await (await api('file', { query: { path } })).text());
    expandTo(path);
    await refreshTree();
    toast(`Imported ${path}`, 'ok', { action: referenceFor(path) ? { label: 'Insert', fn: () => insertReference(path) } : null });
    return path;
  } catch (e) { toast(e.message, 'error'); return null; }
}

function slug(p) { return base(p).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'figure'; }

function referenceFor(path, { figure = true } = {}) {
  const e = ext(path);
  if (GRAPHIC_EXT.test(path)) {
    const g = graphicPath(path);
    const opts = e === 'pdf' ? 'page=1,width=0.8\\linewidth' : 'width=0.8\\linewidth';
    if (!figure) return { text: `\\includegraphics[${opts}]{${g}}`, needs: 'graphicx' };
    return { text: `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[${opts}]{${g}}\n  \\caption{${base(path).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')}}\n  \\label{fig:${slug(path)}}\n\\end{figure}\n`, block: true, needs: 'graphicx' };
  }
  const rel = relative(dirOf(mainPath()), path);
  if (e === 'tex') return { text: `\\input{${rel.replace(/\.tex$/i, '')}}`, block: true };
  if (e === 'bib') return { text: `\\bibliographystyle{plain}\n\\bibliography{${rel.replace(/\.bib$/i, '')}}\n`, block: true, bib: rel };
  if (CODE_EXT.test(path)) return { text: `\\lstinputlisting[language=${{ py: 'Python', m: 'Matlab', r: 'R', c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', java: 'Java', sh: 'bash', lua: '[5.3]Lua' }[e] || 'Python'}]{${rel}}`, block: true, needs: 'listings' };
  if (e === 'csv') return { text: `\\csvautotabular{${rel}}`, block: true, needs: 'csvsimple' };
  return null;
}

// Add \usepackage{pkg} to the main preamble if it's not loaded yet.
function ensurePackage(pkg) {
  const entry = state.docs.get(mainPath());
  if (!entry) return;
  const text = entry.doc.getValue();
  const loaded = new RegExp(`^[^%\\n]*\\\\(?:usepackage|RequirePackage)(?:\\[[^\\]]*\\])?\\{[^}]*\\b${pkg}\\b[^}]*\\}`, 'm').test(text);
  if (loaded || (pkg === 'graphicx' && /\\documentclass(\[[^\]]*\])?\{beamer\}/.test(text))) return;
  const lines = text.split('\n');
  let at = lines.findIndex((l) => /^\s*\\documentclass/.test(l));
  if (at < 0) return;
  // Place it after the last \usepackage in the preamble, else right after \documentclass.
  const begin = lines.findIndex((l) => /\\begin\{document\}/.test(l));
  for (let i = at + 1; i < (begin < 0 ? lines.length : begin); i++) if (/^\s*\\usepackage/.test(lines[i])) at = i;
  entry.doc.replaceRange(`\\usepackage{${pkg}}\n`, { line: at + 1, ch: 0 });
  toast(`Added \\usepackage{${pkg}} to ${mainPath()}`, 'ok');
}

function insertReference(path, { figure = true, into, at } = {}) {
  const ref = referenceFor(path, { figure });
  if (!ref) return toast('Nothing to insert for this file type', 'error');
  // biblatex projects add the .bib in the preamble instead of \bibliography.
  if (ref.bib) {
    const main = state.docs.get(mainPath());
    if (main && /\\usepackage(\[[^\]]*\])?\{biblatex\}/.test(main.doc.getValue())) {
      const lines = main.doc.getValue().split('\n');
      const begin = lines.findIndex((l) => /\\begin\{document\}/.test(l));
      main.doc.replaceRange(`\\addbibresource{${ref.bib}}\n`, { line: Math.max(0, begin), ch: 0 });
      return toast(`Added \\addbibresource{${ref.bib}} to the preamble`, 'ok');
    }
  }
  const targetPath = into || (state.docs.has(state.active) ? state.active : mainPath());
  if (targetPath !== state.active) openFile(targetPath);
  const doc = cm.getDoc();
  if (at) doc.setCursor(at);
  const cur = doc.getCursor();
  let text = ref.text;
  if (ref.block) {
    const line = doc.getLine(cur.line);
    const indent = line.match(/^\s*/)[0];
    text = text.replace(/\n(?=.)/g, '\n' + indent);
    if (line.trim()) { doc.replaceRange('\n' + indent + text.replace(/\n$/, ''), { line: cur.line, ch: line.length }); }
    else doc.replaceRange(text.replace(/^\s*/, ''), { line: cur.line, ch: indent.length }, { line: cur.line, ch: line.length });
  } else {
    doc.replaceSelection(text);
  }
  if (ref.needs) ensurePackage(ref.needs);
  cm.focus();
}

// Paste screenshots / images straight into the editor.
cm.getWrapperElement().addEventListener('paste', async (e) => {
  const files = [...(e.clipboardData && e.clipboardData.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  if (!files.length) return;
  e.preventDefault(); e.stopPropagation();
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const list = files.map((f, i) => ({ file: f, rel: f.type.startsWith('image/') && (!f.name || f.name === 'image.png') ? `pasted-${stamp}${i ? '-' + i : ''}.png` : f.name }));
  const dir = list.some((l) => /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(l.rel)) ? 'images' : '';
  const pos = cm.getCursor();
  const done = await uploadFiles(list, dir);
  for (const p of done.filter((p) => referenceFor(p) && !(CONVERT_EXT.test(p)))) insertReference(p, { at: pos });
}, true);

// ---------- drag & drop ----------

async function collectDropped(dt) {
  // webkitGetAsEntry must be called synchronously, before any await.
  const entries = [...dt.items].filter((i) => i.kind === 'file').map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) return [...dt.files].map((f) => ({ file: f, rel: f.name }));
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const f = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file: f, rel: prefix + f.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      } while (batch.length);
    }
  };
  await Promise.all(entries.map((e) => walk(e, '')));
  return out;
}

const INTERNAL = 'application/x-studio-path';
const hasFiles = (e) => [...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files');
const hasInternal = (e) => [...(e.dataTransfer && e.dataTransfer.types || [])].includes(INTERNAL);

$('#tree').addEventListener('dragstart', (e) => {
  const node = e.target.closest('.node');
  if (!node) return;
  e.dataTransfer.setData(INTERNAL, node.dataset.path);
  e.dataTransfer.effectAllowed = 'copyMove';
});

function dropDirFor(target) {
  const node = target.closest && target.closest('.node');
  if (!node) return '';
  return node.dataset.type === 'dir' ? node.dataset.path : dirOf(node.dataset.path);
}

let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  $('#dropOverlay').hidden = false;
});
document.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; }
});
document.addEventListener('dragover', (e) => {
  if (!hasFiles(e) && !hasInternal(e)) return;
  e.preventDefault();
  $$('.node.drop-into').forEach((n) => n.classList.remove('drop-into'));
  const inTree = e.target.closest && e.target.closest('#tree');
  $('#tree').classList.toggle('drag-target', !!inTree && !e.target.closest('.node'));
  const node = inTree && e.target.closest('.node');
  if (node) {
    const dirNode = node.dataset.type === 'dir' ? node : $$('.node').find((n) => n.dataset.path === dirOf(node.dataset.path));
    if (dirNode) dirNode.classList.add('drop-into');
  }
});
document.addEventListener('drop', async (e) => {
  dragDepth = 0;
  $('#dropOverlay').hidden = true;
  $('#tree').classList.remove('drag-target');
  $$('.node.drop-into').forEach((n) => n.classList.remove('drop-into'));
  if (e.defaultPrevented || e.studioHandled) return;
  if (!hasFiles(e) && !hasInternal(e)) return;
  e.preventDefault();
  const dir = dropDirFor(e.target);
  if (hasInternal(e)) {
    // Moving a file/folder inside the tree.
    const from = e.dataTransfer.getData(INTERNAL);
    if (!e.target.closest('#tree') || dirOf(from) === dir || dir === from || dir.startsWith(from + '/')) return;
    try {
      await flushAll();
      const to = joinPath(dir, base(from));
      await api('rename', { method: 'POST', body: { from, to } });
      const remap = (p) => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : p);
      state.docs = new Map([...state.docs].map(([p, d]) => [remap(p), d]));
      state.tabs = state.tabs.map(remap);
      if (state.active) state.active = remap(state.active);
      if (remap(mainPath()) !== mainPath()) await setMain(remap(mainPath()), true);
      expandTo(to);
      await refreshTree(); renderTabs(); renderMainSelect();
      toast(`Moved to ${to}`, 'ok');
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const list = await collectDropped(e.dataTransfer);
  if (list.length) await uploadFiles(list, dir);
});

// Dropping onto the editor: upload (images go to images/) and insert a reference at the drop point.
cm.on('drop', async (c, e) => {
  if (!hasFiles(e) && !hasInternal(e)) return;
  e.preventDefault();
  e.studioHandled = true;
  dragDepth = 0;
  $('#dropOverlay').hidden = true;
  const pos = c.coordsChar({ left: e.clientX, top: e.clientY });
  if (hasInternal(e)) {
    const p = e.dataTransfer.getData(INTERNAL);
    if (state.files.some((f) => f.path === p && f.type === 'file')) insertReference(p, { at: pos });
    return;
  }
  const list = await collectDropped(e.dataTransfer);
  const allImages = list.every((l) => /\.(png|jpe?g|pdf|eps|gif|svg|webp|bmp|avif)$/i.test(l.rel));
  const done = await uploadFiles(list, allImages && !list.some((l) => l.rel.includes('/')) ? 'images' : '');
  let at = pos;
  for (const p of done) {
    if (CONVERT_EXT.test(p) || !referenceFor(p)) continue;
    insertReference(p, { at });
    at = cm.getCursor();
  }
});

// ---------- formatting toolbar ----------

function wrapCommand(cmd) {
  const doc = cm.getDoc();
  if (!state.docs.has(state.active)) return;
  const sel = doc.getSelection();
  if (sel) {
    const from = doc.getCursor('from'); const to = doc.getCursor('to');
    const pre = `\\${cmd}{`;
    const beforeText = doc.getRange({ line: from.line, ch: Math.max(0, from.ch - pre.length) }, from);
    const afterText = doc.getRange(to, { line: to.line, ch: to.ch + 1 });
    if (beforeText === pre && afterText === '}') { // toggle off
      doc.replaceRange('', to, { line: to.line, ch: to.ch + 1 });
      doc.replaceRange('', { line: from.line, ch: from.ch - pre.length }, from);
      return cm.focus();
    }
    const m = sel.match(new RegExp(`^\\\\${cmd}\\{([\\s\\S]*)\\}$`));
    doc.replaceSelection(m ? m[1] : `${pre}${sel}}`, 'around');
  } else {
    const cur = doc.getCursor();
    doc.replaceRange(`\\${cmd}{}`, cur);
    doc.setCursor({ line: cur.line, ch: cur.ch + cmd.length + 2 });
  }
  cm.focus();
}

function wrapEnv(env, { itemize = false } = {}) {
  const doc = cm.getDoc();
  const from = doc.getCursor('from'); const to = doc.getCursor('to');
  const sel = doc.getSelection();
  const indent = doc.getLine(from.line).match(/^\s*/)[0];
  let inner;
  if (itemize) inner = (sel ? sel.split('\n').filter((l) => l.trim()) : ['']).map((l) => `${indent}  \\item ${l.trim()}`).join('\n');
  else inner = sel ? sel.split('\n').map((l) => indent + '  ' + l.trim()).join('\n') : indent + '  ';
  const text = `\\begin{${env}}\n${inner}\n${indent}\\end{${env}}`;
  if (sel) doc.replaceRange(text, { line: from.line, ch: from.ch }, to);
  else {
    const line = doc.getLine(from.line);
    if (line.trim()) doc.replaceRange('\n' + indent + text, { line: from.line, ch: line.length });
    else doc.replaceRange(text, { line: from.line, ch: indent.length }, { line: from.line, ch: line.length });
  }
  if (!sel) { const line = cm.getCursor().line - 1; cm.setCursor({ line, ch: doc.getLine(line).length }); }
  cm.focus();
}

async function insertFigureDialog() {
  const images = state.files.filter((f) => f.type === 'file' && GRAPHIC_EXT.test(f.path)).map((f) => [f.path, f.path]);
  const r = await modal({
    title: 'Insert figure',
    fields: [
      { name: 'existing', type: 'select', label: 'Image from project', options: [['', images.length ? '— choose —' : '(no images yet)'], ...images] },
      { name: 'upload', type: 'file', label: 'or upload from computer', accept: 'image/*,.pdf,.eps' },
      { name: 'url', type: 'url', label: 'or import from URL', placeholder: 'https://…' },
      { name: 'width', label: 'Width (fraction of line width)', value: '0.8' },
    ],
    ok: 'Insert',
  });
  if (!r) return;
  const pos = cm.getCursor();
  let path = r.existing;
  if (r.upload) {
    const done = await uploadFiles([{ file: r.upload, rel: r.upload.name }], 'images');
    path = done.find((p) => GRAPHIC_EXT.test(p));
  } else if (r.url) {
    const res = await apiJson('import-url', { method: 'POST', body: { url: r.url } }).catch((e) => { toast(e.message, 'error'); return null; });
    if (res) {
      path = res.path;
      if (CONVERT_EXT.test(path)) {
        const png = await toPng(await (await api('file', { query: { path } })).blob());
        path = path.replace(/\.[^.]+$/, '.png');
        await api('file', { method: 'PUT', query: { path }, raw: png });
      }
      await refreshTree();
    }
  }
  if (!path) return;
  insertReference(path, { at: pos });
  const w = parseFloat(r.width);
  if (w && w !== 0.8) {
    const doc = cm.getDoc();
    const c = cm.getCursor();
    for (let l = c.line; l >= Math.max(0, c.line - 6); l--) {
      const t = doc.getLine(l);
      if (t.includes('width=0.8\\linewidth')) { doc.replaceRange(t.replace('width=0.8\\linewidth', `width=${w}\\linewidth`), { line: l, ch: 0 }, { line: l, ch: t.length }); break; }
    }
  }
}

async function insertTableDialog() {
  const r = await modal({ title: 'Insert table', fields: [{ name: 'rows', type: 'number', label: 'Rows', value: '3', min: 1, max: 50 }, { name: 'cols', type: 'number', label: 'Columns', value: '3', min: 1, max: 20 }], ok: 'Insert' });
  if (!r) return;
  const rows = Math.max(1, Math.min(50, parseInt(r.rows, 10) || 3));
  const cols = Math.max(1, Math.min(20, parseInt(r.cols, 10) || 3));
  const head = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`).join(' & ');
  const body = Array.from({ length: rows - 1 }, () => '    ' + Array(cols).fill('').join(' & ') + ' \\\\').join('\n');
  const text = `\\begin{table}[htbp]\n  \\centering\n  \\begin{tabular}{${'l'.repeat(cols)}}\n    \\toprule\n    ${head} \\\\\n    \\midrule\n${body}\n    \\bottomrule\n  \\end{tabular}\n  \\caption{Caption}\n  \\label{tab:label}\n\\end{table}\n`;
  const doc = cm.getDoc(); const cur = doc.getCursor(); const line = doc.getLine(cur.line);
  if (line.trim()) doc.replaceRange('\n' + text, { line: cur.line, ch: line.length }); else doc.replaceRange(text, { line: cur.line, ch: 0 }, { line: cur.line, ch: line.length });
  ensurePackage('booktabs');
  cm.focus();
}

$('#fmtToolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fmt]');
  if (!b) return;
  if (!state.docs.has(state.active) && b.dataset.fmt !== 'sync-to-pdf') return toast('Open a .tex file first');
  const doc = cm.getDoc();
  const actions = {
    bold: () => wrapCommand('textbf'), italic: () => wrapCommand('textit'), underline: () => wrapCommand('underline'), mono: () => wrapCommand('texttt'),
    itemize: () => wrapEnv('itemize', { itemize: true }), enumerate: () => wrapEnv('enumerate', { itemize: true }),
    math: () => { const s = doc.getSelection(); if (s) doc.replaceSelection(`$${s}$`); else { const c = doc.getCursor(); doc.replaceRange('$$', c); doc.setCursor({ line: c.line, ch: c.ch + 1 }); } cm.focus(); },
    equation: () => wrapEnv('equation'),
    figure: insertFigureDialog, table: insertTableDialog,
    link: () => { const s = doc.getSelection() || 'link text'; const c = doc.getCursor('from'); doc.replaceSelection(`\\href{}{${s}}`); doc.setCursor({ line: c.line, ch: c.ch + 6 }); ensurePackage('hyperref'); cm.focus(); },
    cite: () => { doc.replaceSelection('\\cite{}'); const c = doc.getCursor(); doc.setCursor({ line: c.line, ch: c.ch - 1 }); cm.focus(); cm.showHint({ hint: latexHint, completeSingle: false }); },
    ref: () => { doc.replaceSelection('\\ref{}'); const c = doc.getCursor(); doc.setCursor({ line: c.line, ch: c.ch - 1 }); cm.focus(); cm.showHint({ hint: latexHint, completeSingle: false }); },
    comment: () => { cm.toggleComment(); cm.focus(); },
    search: () => cm.execCommand('find'),
    'sync-to-pdf': () => syncToPdf(),
  };
  actions[b.dataset.fmt]();
});

$('#fmtToolbar select[data-fmt="heading"]').addEventListener('change', (e) => {
  const cmd = e.target.value;
  e.target.value = '';
  if (!cmd || !state.docs.has(state.active)) return;
  const doc = cm.getDoc();
  const line = doc.getCursor().line;
  const text = doc.getLine(line);
  const m = text.match(/^(\s*)\\(?:part|chapter|section|subsection|subsubsection|paragraph)\*?\{(.*)\}\s*$/);
  const indent = text.match(/^\s*/)[0];
  const content = m ? m[2] : text.trim() || 'Title';
  doc.replaceRange(`${indent}\\${cmd}{${content}}`, { line, ch: 0 }, { line, ch: text.length });
  cm.focus();
});

// ---------- PDF viewer ----------

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.js';

const viewer = {
  doc: null, name: null, zoom: store.get('zoom', 'fit-width'), scale: 1, pages: [], observer: null, stamp: 0,
  scroll: $('#pdfScroll'), host: $('#pdfPages'),

  clear() {
    if (this.doc) this.doc.destroy();
    this.doc = null; this.name = null; this.pages = []; this.host.innerHTML = '';
    $('#pdfEmpty').hidden = false; $('#pageCount').textContent = '0'; $('#pageInput').value = '0'; $('#pdfMeta').textContent = '';
    setDownload(null);
  },

  async load(name, stamp, data) {
    if (!data) {
      const res = await fetch(outputUrl(name, '&t=' + stamp));
      if (!res.ok) throw new Error('Could not load PDF');
      data = await res.arrayBuffer();
    }
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    const sc = this.scroll;
    const keep = this.doc ? { top: sc.scrollTop / Math.max(1, sc.scrollHeight), left: sc.scrollLeft } : null;
    if (this.doc) this.doc.destroy();
    this.doc = doc; this.name = name; this.stamp = stamp;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      // Reuse the previous build's page element so its old image stays visible until the new one is drawn.
      const old = this.pages[i - 1];
      pages.push({ page, num: i, base: page.getViewport({ scale: 1 }), div: old && old.div });
    }
    this.pages = pages;
    $('#pdfEmpty').hidden = true;
    $('#pageCount').textContent = String(doc.numPages);
    this.layout();
    if (keep) { sc.scrollTop = keep.top * sc.scrollHeight; sc.scrollLeft = keep.left; }
    this.updatePageIndicator();
    setDownload(name);
    $('#pdfMeta').textContent = `${name} · ${doc.numPages} page${doc.numPages > 1 ? 's' : ''} · ${new Date(stamp).toLocaleTimeString()}`;
    $('#pdfScroll').classList.remove('stale');
  },

  computeScale() {
    if (!this.pages.length) return 1;
    const avail = this.scroll.clientWidth - 32;
    const maxW = Math.max(...this.pages.map((p) => p.base.width));
    if (this.zoom === 'fit-width') return Math.max(0.2, avail / maxW);
    if (this.zoom === 'fit-page') return Math.max(0.2, Math.min(avail / maxW, (this.scroll.clientHeight - 30) / this.pages[0].base.height));
    return Number(this.zoom) || 1;
  },

  layout() {
    const scale = this.computeScale();
    this.scale = scale;
    if (this.observer) this.observer.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) this.render(this.pages[Number(en.target.dataset.index)]);
    }, { root: this.scroll, rootMargin: '800px 0px' });
    const frag = document.createDocumentFragment();
    this.pages.forEach((pv, i) => {
      const vp = pv.page.getViewport({ scale });
      pv.vp = vp; pv.renderedScale = 0;
      if (pv.task) { pv.task.cancel(); pv.task = null; }
      // Keep the old canvas visible (stretched) until the new one is ready, to avoid flicker.
      const div = pv.div || h('div', { class: 'pdf-page', 'data-index': i });
      div.dataset.index = i;
      div.style.width = vp.width + 'px';
      div.style.height = vp.height + 'px';
      if (!pv.div) div.append(h('span', { class: 'page-num' }, String(i + 1)));
      pv.div = div;
      frag.append(div);
      this.observer.observe(div);
    });
    this.host.innerHTML = '';
    this.host.append(frag);
    $('#zoomSelect').value = [...$('#zoomSelect').options].some((o) => o.value === String(this.zoom)) ? String(this.zoom) : '';
    if (!$('#zoomSelect').value) {
      const opt = $('#zoomSelect').querySelector('option[data-custom]') || h('option', { 'data-custom': '1' });
      opt.value = String(this.zoom); opt.textContent = Math.round(scale * 100) + '%';
      $('#zoomSelect').append(opt); $('#zoomSelect').value = opt.value;
    }
  },

  async render(pv) {
    if (!pv || pv.renderedScale === this.scale) return;
    const scale = this.scale;
    pv.renderedScale = scale;
    const vp = pv.vp;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const canvas = h('canvas', { width: Math.floor(vp.width * dpr), height: Math.floor(vp.height * dpr) });
    const ctx = canvas.getContext('2d');
    if (pv.task) pv.task.cancel();
    pv.task = pv.page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    try { await pv.task.promise; } catch { return; } // cancelled
    pv.task = null;
    if (scale !== this.scale) return;
    const tl = h('div', { class: 'textLayer' });
    tl.style.setProperty('--scale-factor', scale);
    pv.div.querySelectorAll('canvas, .textLayer').forEach((n) => n.remove());
    pv.div.prepend(canvas);
    pv.div.append(tl);
    try {
      const textContent = await pv.page.getTextContent();
      pdfjsLib.renderTextLayer({ textContentSource: textContent, container: tl, viewport: vp, textDivs: [] });
    } catch {}
  },

  setZoom(z) {
    const sc = this.scroll;
    const rel = sc.scrollTop / Math.max(1, sc.scrollHeight);
    this.zoom = z; store.set('zoom', z);
    this.layout();
    sc.scrollTop = rel * sc.scrollHeight;
  },

  step(dir) {
    const levels = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
    const cur = this.scale;
    const next = dir > 0 ? levels.find((l) => l > cur + 0.01) || 4 : [...levels].reverse().find((l) => l < cur - 0.01) || 0.25;
    this.setZoom(next);
  },

  currentPage() {
    const sc = this.scroll;
    const probe = sc.scrollTop + sc.clientHeight / 3;
    let cur = 1;
    for (const pv of this.pages) if (pv.div && pv.div.offsetTop <= probe) cur = pv.num;
    return cur;
  },
  updatePageIndicator() { if (document.activeElement !== $('#pageInput')) $('#pageInput').value = this.pages.length ? this.currentPage() : 0; },
  goTo(n) {
    const pv = this.pages[Math.max(1, Math.min(this.pages.length, n)) - 1];
    if (pv) this.scroll.scrollTop = pv.div.offsetTop - 10;
  },

  mark(pageNum, top, bottom) {
    const pv = this.pages[pageNum - 1];
    if (!pv) return;
    const y = Math.max(0, top - 4) * this.scale;
    const hgt = Math.max(14, (bottom - top + 8) * this.scale);
    this.scroll.scrollTop = pv.div.offsetTop + y - this.scroll.clientHeight / 3;
    const m = h('div', { class: 'sync-mark', style: `top:${y}px;height:${hgt}px` });
    pv.div.append(m);
    setTimeout(() => m.remove(), 2300);
  },
};

function setDownload(name) {
  const dl = $('#downloadBtn'); const open = $('#openPdfTab');
  if (name) {
    dl.href = outputUrl(name, '&download=1'); dl.removeAttribute('aria-disabled');
    open.href = outputUrl(name, '&t=' + viewer.stamp); open.removeAttribute('aria-disabled');
  } else {
    dl.removeAttribute('href'); dl.setAttribute('aria-disabled', 'true');
    open.removeAttribute('href'); open.setAttribute('aria-disabled', 'true');
  }
}

$('#pdfScroll').addEventListener('scroll', () => viewer.updatePageIndicator(), { passive: true });
$('#prevPage').onclick = () => viewer.goTo(viewer.currentPage() - 1);
$('#nextPage').onclick = () => viewer.goTo(viewer.currentPage() + 1);
$('#pageInput').addEventListener('change', (e) => viewer.goTo(parseInt(e.target.value, 10) || 1));
$('#pageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { viewer.goTo(parseInt(e.target.value, 10) || 1); e.target.blur(); } });
$('#zoomIn').onclick = () => viewer.step(1);
$('#zoomOut').onclick = () => viewer.step(-1);
$('#zoomSelect').onchange = (e) => viewer.setZoom(/^fit/.test(e.target.value) ? e.target.value : Number(e.target.value));
$('#zoomSelect').value = String(viewer.zoom);
$('#pdfScroll').addEventListener('wheel', (e) => {
  if (!e.ctrlKey || !viewer.pages.length) return;
  e.preventDefault();
  viewer.step(e.deltaY < 0 ? 1 : -1);
}, { passive: false });
let resizeTimer;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (viewer.pages.length && /^fit/.test(String(viewer.zoom))) viewer.setZoom(viewer.zoom); }, 120);
}).observe($('#pdfScroll'));

// SyncTeX: double-click the PDF to jump to the source line.
$('#pdfPages').addEventListener('dblclick', async (e) => {
  const div = e.target.closest('.pdf-page');
  if (!div || !viewer.name) return;
  const r = div.getBoundingClientRect();
  const x = (e.clientX - r.left) / viewer.scale;
  const y = (e.clientY - r.top) / viewer.scale;
  try {
    const res = await apiJson('synctex-edit', { query: { pdf: viewer.name, page: Number(div.dataset.index) + 1, x, y } });
    window.getSelection().removeAllRanges();
    goToSource(res.file, res.line);
  } catch (err) { toast(err.message, 'error'); }
});

async function syncToPdf() {
  if (!viewer.name) return toast('Compile first');
  if (!state.docs.has(state.active)) return;
  try {
    const res = await apiJson('synctex-view', { query: { pdf: viewer.name, file: state.active, line: cm.getCursor().line + 1 } });
    viewer.mark(res.page, res.top, res.bottom);
  } catch (err) { toast(err.message, 'error'); }
}

function goToSource(file, line) {
  if (!file || !state.files.some((f) => f.path === file)) return toast(file ? `${file} is not in this project` : 'No source location for this item');
  openFile(file);
  if (!line) return;
  const l = Math.max(0, Math.min(cm.lineCount() - 1, line - 1));
  cm.setCursor({ line: l, ch: 0 });
  cm.scrollIntoView({ line: l, ch: 0 }, cm.getScrollInfo().clientHeight / 3);
  const handle = cm.addLineClass(l, 'background', 'line-flash');
  setTimeout(() => cm.removeLineClass(handle, 'background', 'line-flash'), 1500);
  cm.focus();
}

// ---------- compile ----------

let autoTimer;
function scheduleAutoCompile() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => compile({ auto: true }), 2500);
}

async function compile({ auto = false } = {}) {
  if (!state.project) return;
  if (state.compiling) { state.compileQueued = true; return; }
  state.compiling = true;
  const btn = $('#compileBtn');
  btn.classList.add('compiling');
  btn.querySelector('.label').textContent = 'Compiling…';
  $('#pdfScroll').classList.add('stale');
  const firstEver = !store.get('compiledOnce', false);
  const overlay = $('#compileOverlay');
  const started = Date.now();
  const msg = () => {
    const s = Math.round((Date.now() - started) / 1000);
    $('#compileMsg').textContent = s > 6 && (firstEver || s > 20)
      ? `Compiling… ${s}s — the first build downloads LaTeX packages and fonts, later builds take seconds.`
      : `Compiling… ${s}s`;
  };
  msg();
  const showTimer = setTimeout(() => { overlay.hidden = false; }, auto ? 4000 : 400);
  const tick = setInterval(msg, 1000);
  try {
    await flushAll();
    const r = await apiJson('compile', { method: 'POST', body: { main: $('#mainSelect').value || mainPath(), engine: $('#engineSelect').value } });
    state.result = r;
    renderProblems(r);
    markProblems(r);
    if (r.pdf) {
      await viewer.load(r.pdf, r.builtAt);
      store.set('compiledOnce', true);
      const errs = r.problems.filter((p) => p.level === 'error').length;
      if (errs && !auto) toast(`Compiled with ${errs} error${errs > 1 ? 's' : ''} — see Logs`, 'error', { action: { label: 'Show', fn: () => toggleLogs(true) } });
    } else {
      $('#pdfScroll').classList.remove('stale');
      if (!auto) toggleLogs(true);
      toast('Compilation failed — no PDF was produced', 'error');
    }
  } catch (e) {
    $('#pdfScroll').classList.remove('stale');
    toast(e.message, 'error');
  } finally {
    clearTimeout(showTimer); clearInterval(tick);
    overlay.hidden = true;
    btn.classList.remove('compiling');
    btn.querySelector('.label').textContent = 'Recompile';
    state.compiling = false;
    if (state.compileQueued) { state.compileQueued = false; compile({ auto: true }); }
  }
}

function markProblems(r) {
  for (const m of state.problemMarks) m.doc.removeLineClass(m.handle, 'background', m.cls);
  state.problemMarks = [];
  for (const p of (r && r.problems) || []) {
    if (!p.file || !p.line || p.level === 'typesetting') continue;
    const entry = state.docs.get(p.file);
    if (!entry || p.line > entry.doc.lineCount()) continue;
    const cls = p.level === 'error' ? 'line-error' : 'line-warning';
    const handle = entry.doc.addLineClass(p.line - 1, 'background', cls);
    state.problemMarks.push({ doc: entry.doc, handle, cls });
  }
}

function renderProblems(r) {
  const box = $('#logsProblems');
  const badge = $('#logsBadge');
  box.innerHTML = '';
  $('#logsRaw').textContent = r ? (r.log || '') + (r.transcript && r.log !== r.transcript ? '\n\n──── engine output ────\n' + r.transcript : '') : '';
  if (!r) { badge.hidden = true; box.append(h('div', { class: 'logs-empty' }, 'Compile to see errors and warnings here.')); return; }
  const count = (lvl) => r.problems.filter((p) => p.level === lvl).length;
  const errors = count('error'); const warnings = count('warning'); const boxes = count('typesetting');
  badge.hidden = !(errors || warnings);
  badge.textContent = errors || warnings;
  badge.className = 'badge' + (errors ? '' : ' warn');
  box.append(h('div', { class: 'logs-summary' },
    h('strong', {}, r.pdf ? (errors ? 'Compiled with errors' : 'Compiled successfully') : 'Compilation failed'),
    h('span', {}, `· ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${boxes} typesetting`),
    h('span', {}, `· ${(r.durationMs / 1000).toFixed(1)}s with ${r.engine}`)));
  if (!r.problems.length) box.append(h('div', { class: 'logs-empty' }, 'No errors or warnings. 🎉'));
  for (const p of r.problems) {
    box.append(h('div', { class: 'problem ' + p.level, onclick: () => goToSource(p.file, p.line) },
      h('div', { class: 'p-head' }, h('span', { class: 'p-level' }, p.level === 'typesetting' ? 'Box' : p.level),
        h('span', { class: 'p-loc' }, p.file ? `${p.file}${p.line ? ':' + p.line : ''}` : '')),
      h('div', { class: 'p-msg' }, p.message)));
  }
}

function toggleLogs(force) {
  const logs = $('#logs');
  logs.hidden = force === undefined ? !logs.hidden : !force;
}
$('#logsBtn').onclick = () => toggleLogs();
$('#closeLogs').onclick = () => toggleLogs(false);
$$('.logs-tab').forEach((t) => t.addEventListener('click', () => {
  $$('.logs-tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#logsProblems').hidden = t.dataset.tab !== 'problems';
  $('#logsRaw').hidden = t.dataset.tab !== 'raw';
}));

$('#compileBtn').onclick = () => compile();
function renderAuto() {
  const b = $('#autoCompileBtn');
  b.textContent = 'Auto: ' + (state.autoCompile ? 'On' : 'Off');
  b.setAttribute('aria-pressed', String(state.autoCompile));
}
$('#autoCompileBtn').onclick = () => { state.autoCompile = !state.autoCompile; store.set('autoCompile', state.autoCompile); renderAuto(); };
renderAuto();

$('#mainSelect').onchange = (e) => setMain(e.target.value);
$('#engineSelect').onchange = async (e) => { state.settings = await apiJson('settings', { method: 'POST', body: { engine: e.target.value } }); };
$('#projectSelect').onchange = (e) => openProject(e.target.value).catch((err) => toast(err.message, 'error'));
$('#newProjectBtn').onclick = async () => {
  const r = await modal({ title: 'New project', text: 'Starts with a sample main.tex, references.bib and an images folder.', fields: [{ name: 'name', placeholder: 'Thesis' }], ok: 'Create' });
  if (!r || !r.name) return;
  const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: r.name }) });
  if (!res.ok) return toast((await res.json()).error || 'Could not create project', 'error');
  await loadProjects(r.name);
};

// Global shortcuts (outside the editor too).
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 'Enter' || e.key.toLowerCase() === 's')) { e.preventDefault(); if (!cm.hasFocus()) compile(); }
  if (e.key === 'Escape') { hideMenu(); if (!$('#logs').hidden) toggleLogs(false); }
});

// ---------- resizable panes ----------

(function panes() {
  const ws = $('#workspace');
  const sw = store.get('sidebarW', null); const pw = store.get('pdfW', null);
  if (sw) ws.style.setProperty('--sidebar-w', sw + 'px');
  if (pw) ws.style.setProperty('--pdf-w', pw + 'px');
  for (const r of $$('.resizer')) {
    r.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      r.setPointerCapture(e.pointerId);
      r.classList.add('active'); document.body.classList.add('resizing');
      const move = (ev) => {
        if (r.dataset.resize === 'sidebar') {
          const w = Math.max(150, Math.min(520, ev.clientX));
          ws.style.setProperty('--sidebar-w', w + 'px'); store.set('sidebarW', w);
        } else {
          const w = Math.max(260, Math.min(innerWidth - 420, innerWidth - ev.clientX));
          ws.style.setProperty('--pdf-w', w + 'px'); store.set('pdfW', w);
        }
        cm.refresh();
      };
      const up = () => { r.classList.remove('active'); document.body.classList.remove('resizing'); r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); };
      r.addEventListener('pointermove', move);
      r.addEventListener('pointerup', up);
    });
  }
})();

// ---------- boot ----------

(async function boot() {
  try {
    state.engines = await (await fetch('/api/engines')).json();
    const sel = $('#engineSelect');
    for (const e of state.engines) sel.append(h('option', { value: e.id }, e.label));
    if (!state.engines.length) {
      sel.append(h('option', { value: '' }, 'No engine — run setup'));
      toast('No LaTeX engine found. Run "npm run setup" in the Latex folder, then restart.', 'error', { timeout: 0 });
    }
    await loadProjects(store.get('project', null));
  } catch (e) {
    toast('Could not start: ' + e.message, 'error', { timeout: 0 });
  }
})();
