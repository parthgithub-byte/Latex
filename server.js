// LaTeX Studio — a small local Overleaf-style LaTeX editor/compiler.
// Zero npm dependencies: run `node scripts/setup.js` once, then `node server.js`.
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PROJECTS_DIR = process.env.PROJECTS_DIR ? path.resolve(process.env.PROJECTS_DIR) : path.join(ROOT, 'projects');
const BIN_DIR = path.join(ROOT, 'bin');
const BUILD = '.build';
const SETTINGS = '.studio.json';
const HIDDEN = new Set([BUILD, SETTINGS]);
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
// Optional HTTP Basic Auth — set AUTH_PASSWORD whenever the app is reachable from other machines.
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const MAX_UPLOAD = 200 * 1024 * 1024;
const COMPILE_TIMEOUT = 10 * 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.bmp': 'image/bmp', '.pdf': 'application/pdf', '.eps': 'application/postscript', '.ico': 'image/x-icon',
  '.tex': 'text/plain; charset=utf-8', '.bib': 'text/plain; charset=utf-8', '.cls': 'text/plain; charset=utf-8',
  '.sty': 'text/plain; charset=utf-8', '.bst': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(data);
}

function readBody(req, limit = MAX_UPLOAD) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Upload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, 5 * 1024 * 1024);
  try { return buf.length ? JSON.parse(buf.toString('utf8')) : {}; } catch { throw new HttpError(400, 'Invalid JSON'); }
}

function authorized(req) {
  if (!AUTH_PASSWORD) return true;
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return false;
  const given = crypto.createHash('sha256').update(Buffer.from(m[1], 'base64')).digest();
  const expected = crypto.createHash('sha256').update(`${AUTH_USER}:${AUTH_PASSWORD}`).digest();
  return crypto.timingSafeEqual(given, expected);
}

function exists(p) { return fsp.access(p).then(() => true, () => false); }

function projectDir(name) {
  if (typeof name !== 'string' || !/^[\w\- .]{1,64}$/.test(name) || name.startsWith('.')) throw new HttpError(400, 'Invalid project name');
  return path.join(PROJECTS_DIR, name);
}

// Resolve a project-relative path, refusing anything that escapes the project.
function safeJoin(base, rel, { allowHidden = false } = {}) {
  if (typeof rel !== 'string' || !rel.trim()) throw new HttpError(400, 'Missing path');
  const clean = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.resolve(base, clean);
  if (full !== base && !full.startsWith(base + path.sep)) throw new HttpError(400, 'Path escapes project');
  const first = path.relative(base, full).split(path.sep)[0];
  if (!allowHidden && HIDDEN.has(first)) throw new HttpError(400, 'Reserved path');
  return full;
}

const toPosix = (p) => p.split(path.sep).join('/');

async function listTree(base) {
  const out = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = toPosix(path.relative(base, full));
      if (dir === base && HIDDEN.has(e.name)) continue;
      if (e.isDirectory()) { out.push({ path: rel, type: 'dir' }); await walk(full); }
      else if (e.isFile()) { const st = await fsp.stat(full); out.push({ path: rel, type: 'file', size: st.size, mtime: st.mtimeMs }); }
    }
  }
  await walk(base);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function getSettings(dir) {
  try { return JSON.parse(await fsp.readFile(path.join(dir, SETTINGS), 'utf8')); } catch { return {}; }
}
async function saveSettings(dir, patch) {
  const s = { ...(await getSettings(dir)), ...patch };
  await fsp.writeFile(path.join(dir, SETTINGS), JSON.stringify(s, null, 2));
  return s;
}

// ---------- engines ----------

function which(cmd) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext.toLowerCase());
      try { if (fs.statSync(p).isFile()) return p; } catch {}
    }
  }
  return null;
}

function findTectonic() {
  const local = path.join(BIN_DIR, process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
  return fs.existsSync(local) ? local : which('tectonic');
}

function detectEngines() {
  const engines = [];
  const tectonic = findTectonic();
  if (tectonic) engines.push({ id: 'tectonic', label: 'Tectonic (XeLaTeX)', bin: tectonic });
  for (const [id, label] of [['pdflatex', 'pdfLaTeX'], ['xelatex', 'XeLaTeX'], ['lualatex', 'LuaLaTeX']]) {
    const bin = which(id);
    if (bin) engines.push({ id, label: `${label} (system TeX)`, bin });
  }
  return engines;
}

function run(bin, args, opts) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(bin, args, { ...opts, windowsHide: true });
    const timer = setTimeout(() => { output += '\n[LaTeX Studio] Compile timed out and was stopped.\n'; child.kill(); }, COMPILE_TIMEOUT);
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: -1, output: output + `\n${err.message}\n` }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, output }); });
  });
}

const compiling = new Set();

async function compile(dir, main, engineId) {
  const engines = detectEngines();
  if (!engines.length) throw new HttpError(500, 'No LaTeX engine found. Run `node scripts/setup.js` to install Tectonic.');
  const engine = engines.find((e) => e.id === engineId) || engines[0];
  const mainFull = safeJoin(dir, main);
  if (!(await exists(mainFull))) throw new HttpError(400, `Main document "${main}" not found`);
  const outDir = path.join(dir, BUILD);
  const base = path.basename(main).replace(/\.tex$/i, '');
  const pdfPath = path.join(outDir, base + '.pdf');
  await fsp.mkdir(outDir, { recursive: true });
  // Remove stale outputs so a failed build never shows an old PDF as fresh.
  for (const ext of ['.pdf', '.log', '.synctex.gz']) await fsp.rm(path.join(outDir, base + ext), { force: true });

  const relMain = toPosix(path.relative(dir, mainFull));
  const mainDir = path.dirname(mainFull);
  const started = Date.now();
  let transcript = '';

  if (engine.id === 'tectonic') {
    // Run from the main file's folder so relative \includegraphics / \input paths resolve like Overleaf.
    // The project root is also on the search path so root-relative paths work from sub-folder mains.
    const args = ['-X', 'compile', path.basename(mainFull), '--outdir', outDir, '--keep-logs', '--keep-intermediates', '--synctex', '-Z', `search-path=${dir}`, '-Z', 'continue-on-errors'];
    const r = await run(engine.bin, args, { cwd: mainDir });
    transcript = r.output;
  } else {
    const sep = path.delimiter;
    const env = { ...process.env, TEXINPUTS: `${mainDir}${sep}${dir}${sep}`, BIBINPUTS: `${mainDir}${sep}${dir}${sep}`, BSTINPUTS: `${mainDir}${sep}${dir}${sep}` };
    const texArgs = ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', `-output-directory=${outDir}`, path.basename(mainFull)];
    const pass = async () => { const r = await run(engine.bin, texArgs, { cwd: mainDir, env }); transcript += r.output; return r; };
    await pass();
    const aux = await fsp.readFile(path.join(outDir, base + '.aux'), 'utf8').catch(() => '');
    if (await exists(path.join(outDir, base + '.bcf'))) {
      const biber = which('biber');
      if (biber) transcript += (await run(biber, [`--input-directory=${outDir}`, `--output-directory=${outDir}`, base], { cwd: mainDir, env })).output;
    } else if (/\\bibdata/.test(aux)) {
      const bibtex = which('bibtex');
      if (bibtex) transcript += (await run(bibtex, [base], { cwd: outDir, env })).output;
    }
    for (let i = 0; i < 3; i++) {
      await pass();
      const log = await fsp.readFile(path.join(outDir, base + '.log'), 'utf8').catch(() => '');
      if (!/Rerun to get|Please rerun|Label\(s\) may have changed/i.test(log)) break;
    }
  }

  const log = await fsp.readFile(path.join(outDir, base + '.log'), 'utf8').catch(() => '');
  const pdfOk = await exists(pdfPath);
  const problems = parseLog(log, transcript, dir, mainDir);
  return {
    ok: pdfOk && !problems.some((p) => p.level === 'error'),
    pdf: pdfOk ? base + '.pdf' : null,
    engine: engine.id,
    durationMs: Date.now() - started,
    problems,
    log: log || transcript,
    transcript,
    builtAt: Date.now(),
  };
}

// ---------- log parsing ----------

function normaliseSource(file, projectRoot, mainDir) {
  if (!file) return null;
  let f = file.trim().replace(/^"|"$/g, '');
  const abs = path.isAbsolute(f) ? f : path.resolve(mainDir, f);
  // Package files are often logged by bare name ("(article.cls"), so also require the file to exist.
  if (abs.startsWith(projectRoot + path.sep) && fs.existsSync(abs)) return toPosix(path.relative(projectRoot, abs));
  return null; // file inside the TeX distribution, not the user's project
}

function parseLog(log, transcript, projectRoot, mainDir) {
  const problems = [];
  const seen = new Set();
  const add = (p) => {
    const key = `${p.level}|${p.file}|${p.line}|${p.message}`;
    if (!seen.has(key)) { seen.add(key); problems.push(p); }
  };

  const lines = log.split(/\r?\n/);
  // Track the file stack from TeX's "(file" ... ")" markers so errors map to the right source file.
  // Every "(" is pushed (null when it is not a file) so stray parentheses in messages stay balanced.
  const stack = [];
  const currentFile = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) return stack[i]; return null; };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(/\(([^()\s]*)|\)/g)) {
      if (m[0] === ')') stack.pop();
      else stack.push(/\.(tex|ltx|bbl)$/i.test(m[1]) ? normaliseSource(m[1], projectRoot, mainDir) : null);
    }

    let m;
    if ((m = line.match(/^(?:\.\/|\.\\)?([^:\n]+\.(?:tex|sty|cls|bbl)):(\d+): (.*)$/))) {
      let message = m[3];
      if (i + 1 < lines.length && /^l\.\d+/.test(lines[i + 1]) === false && lines[i + 1].trim() && !lines[i + 1].startsWith('!')) message += ' ' + lines[i + 1].trim();
      add({ level: 'error', file: normaliseSource(m[1], projectRoot, mainDir), line: Number(m[2]), message: message.trim() });
    } else if (line.startsWith('! ')) {
      let lineNo = null; let context = '';
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        const l = lines[j].match(/^l\.(\d+)\s?(.*)$/);
        if (l) { lineNo = Number(l[1]); context = l[2]; break; }
      }
      add({ level: 'error', file: currentFile(), line: lineNo, message: line.slice(2).trim() + (context ? `  —  ${context.trim()}` : '') });
    } else if ((m = line.match(/^(?:LaTeX|Package|Class) (?:(\S+) )?Warning: (.*)$/))) {
      let message = m[2];
      // TeX hard-wraps the log at 79 columns, sometimes mid-word.
      for (let k = i; lines[k].length >= 79 && k + 1 < lines.length; k++) message += lines[k + 1];
      // Package warnings continue on lines prefixed "(pkgname)   ".
      for (let j = i + 1; j < lines.length && /^\(\S+\)\s/.test(lines[j]); j++) message += ' ' + lines[j].replace(/^\(\S+\)\s+/, '').trim();
      const ln = message.match(/on input line (\d+)/);
      add({ level: 'warning', file: currentFile(), line: ln ? Number(ln[1]) : null, message: (m[1] ? `${m[1]}: ` : '') + message.trim() });
    } else if ((m = line.match(/^(Overfull|Underfull) \\[hv]box (.*?)(?:in paragraph |detected |has occurred while \\output is active)?(?:at lines? (\d+)(?:--\d+)?)?$/))) {
      add({ level: 'typesetting', file: currentFile(), line: m[3] ? Number(m[3]) : null, message: line.trim() });
    }
  }

  // Tectonic's own summary ("error: main.tex:12: Undefined control sequence") repeats what the log says;
  // keep only what the log didn't already report (e.g. missing files, or no log at all).
  const norm = (s) => s.replace(/^!\s*/, '').replace(/\s+—.*$/, '').replace(/[.\s]+$/, '').toLowerCase();
  const known = new Set(problems.map((p) => norm(p.message)));
  const knownLines = new Set(problems.filter((p) => p.line).map((p) => `${p.level}|${p.line}`));
  for (const m of transcript.matchAll(/^(error|warning): (?:(.+?\.\w+):(\d+): )?(.+)$/gim)) {
    const level = m[1].toLowerCase();
    const message = m[4].trim();
    if (/^(halted|cannot continue|something bad happened|the \w+ engine had an (unrecoverable )?error)/i.test(message)) continue;
    if (known.has(norm(message)) || (m[3] && knownLines.has(`${level}|${m[3]}`))) continue;
    add({ level, file: normaliseSource(m[2], projectRoot, mainDir), line: m[3] ? Number(m[3]) : null, message: message.replace(/^!\s*/, '') });
  }
  if (!problems.some((p) => p.level === 'error') && /the \w+ engine had an unrecoverable error/i.test(transcript)) {
    add({ level: 'error', file: null, line: null, message: 'The LaTeX engine stopped with an unrecoverable error — see the raw log.' });
  }
  const order = { error: 0, warning: 1, typesetting: 2 };
  return problems.sort((a, b) => order[a.level] - order[b.level]);
}

// ---------- SyncTeX ----------

const SP_PER_BP = 65781.76; // TeX scaled points per PDF big point

async function loadSynctex(dir, pdfName) {
  const base = pdfName.replace(/\.pdf$/i, '');
  const outDir = path.join(dir, BUILD);
  let raw;
  const gz = path.join(outDir, base + '.synctex.gz');
  if (await exists(gz)) raw = zlib.gunzipSync(await fsp.readFile(gz)).toString('utf8');
  else if (await exists(path.join(outDir, base + '.synctex'))) raw = await fsp.readFile(path.join(outDir, base + '.synctex'), 'utf8');
  else throw new HttpError(404, 'No SyncTeX data — recompile first');

  const inputs = new Map();
  const records = [];
  let unit = 1; let xOff = 0; let yOff = 0; let mag = 1000; let page = 0;
  // The synctex input paths are recorded relative to the folder the engine ran in (the main file's folder).
  const settings = await getSettings(dir);
  const mainDir = path.dirname(path.resolve(dir, settings.main || 'main.tex'));
  for (const line of raw.split('\n')) {
    let m;
    if ((m = line.match(/^Input:(\d+):(.*)$/))) { inputs.set(m[1], normaliseSource(m[2], dir, mainDir) || m[2]); continue; }
    if ((m = line.match(/^Unit:(\d+)/))) { unit = Number(m[1]); continue; }
    if ((m = line.match(/^X Offset:(-?\d+)/))) { xOff = Number(m[1]); continue; }
    if ((m = line.match(/^Y Offset:(-?\d+)/))) { yOff = Number(m[1]); continue; }
    if ((m = line.match(/^Magnification:(\d+)/))) { mag = Number(m[1]); continue; }
    if ((m = line.match(/^\{(\d+)/))) { page = Number(m[1]); continue; }
    if ((m = line.match(/^([\[(hvkgx$])(\d+),(\d+):(-?\d+),(-?\d+)(?::(-?\d+)(?:,(-?\d+),(-?\d+))?)?/))) {
      const k = (unit * mag / 1000) / SP_PER_BP;
      records.push({
        type: m[1], input: m[2], line: Number(m[3]), page,
        x: (Number(m[4]) + xOff) * k, y: (Number(m[5]) + yOff) * k,
        w: m[6] != null ? Number(m[6]) * k : 0, h: m[7] != null ? Number(m[7]) * k : 0, d: m[8] != null ? Number(m[8]) * k : 0,
      });
    }
  }
  return { inputs, records };
}

// PDF position (points, top-left origin) -> source file and line.
async function synctexEdit(dir, pdfName, page, x, y) {
  const { inputs, records } = await loadSynctex(dir, pdfName);
  const onPage = records.filter((r) => r.page === page && r.line > 0);
  if (!onPage.length) throw new HttpError(404, 'Nothing found at that position');
  // Prefer the smallest horizontal box that contains the click; fall back to the nearest point record.
  let best = null; let bestArea = Infinity;
  for (const r of onPage) {
    if (r.type !== '(' || r.w <= 0) continue;
    if (x >= r.x && x <= r.x + r.w && y >= r.y - r.h - 1 && y <= r.y + r.d + 1) {
      const area = r.w * (r.h + r.d + 2);
      if (area < bestArea) { bestArea = area; best = r; }
    }
  }
  const points = onPage.filter((r) => 'xkg$'.includes(r.type));
  const pool = best ? points.filter((r) => r.y >= best.y - best.h - 1 && r.y <= best.y + best.d + 1) : points;
  let nearest = null; let nd = Infinity;
  for (const r of pool.length ? pool : onPage) {
    const d = Math.abs(r.y - y) * 3 + Math.abs(r.x - x);
    if (d < nd) { nd = d; nearest = r; }
  }
  const hit = nearest || best;
  return { file: inputs.get(hit.input) || null, line: hit.line };
}

// Source file and line -> PDF position.
async function synctexView(dir, pdfName, file, line) {
  const { inputs, records } = await loadSynctex(dir, pdfName);
  const ids = [...inputs].filter(([, f]) => f === file).map(([id]) => id);
  if (!ids.length) throw new HttpError(404, 'That file is not part of the last compiled PDF');
  const mine = records.filter((r) => ids.includes(r.input) && r.line > 0);
  if (!mine.length) throw new HttpError(404, 'No position found');
  let bestLine = Infinity;
  for (const r of mine) if (r.line >= line && r.line < bestLine) bestLine = r.line;
  if (bestLine === Infinity) bestLine = Math.max(...mine.map((r) => r.line));
  const hits = mine.filter((r) => r.line === bestLine);
  const first = hits.reduce((a, b) => (a.page < b.page || (a.page === b.page && a.y < b.y) ? a : b));
  const samePage = hits.filter((r) => r.page === first.page);
  const top = Math.min(...samePage.map((r) => r.y - (r.h || 10)));
  const bottom = Math.max(...samePage.map((r) => r.y + (r.d || 2)));
  return { page: first.page, top, bottom, line: bestLine };
}

// ---------- project template ----------

const TEMPLATE = String.raw`\documentclass[11pt,a4paper]{article}

\usepackage[margin=2.5cm]{geometry}
\usepackage{graphicx}
\usepackage{amsmath,amssymb}
\usepackage{booktabs}
\usepackage{xcolor}
\usepackage{hyperref}
\graphicspath{{images/}}

\title{Sample Document}
\author{Your Name}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
Write your abstract here. Press \textbf{Recompile} (or Ctrl+Enter) to rebuild the PDF.
\end{abstract}

\section{Introduction}
LaTeX handles \textbf{bold}, \textit{italic}, \underline{underlined},
\textcolor{teal}{coloured} and \texttt{monospaced} text, plus maths such as
\begin{equation}
  e^{i\pi} + 1 = 0 \label{eq:euler}
\end{equation}
which we can reference as Equation~\eqref{eq:euler}.

\section{Media}
Upload images with the upload button, drag them onto the editor, or paste
a screenshot with Ctrl+V. Figure~\ref{fig:sample} is an example.

\begin{figure}[h]
  \centering
  \includegraphics[width=0.45\linewidth]{sample.png}
  \caption{An image from the \texttt{images} folder.}
  \label{fig:sample}
\end{figure}

\begin{table}[h]
  \centering
  \begin{tabular}{lrr}
    \toprule
    Item & Value & Change \\
    \midrule
    Alpha & 12.4 & +3\% \\
    Beta  &  8.1 & $-$1\% \\
    \bottomrule
  \end{tabular}
  \caption{A booktabs table.}
\end{table}

\section{References}
Cite sources from \texttt{references.bib}, e.g.~\cite{knuth1984}.

\bibliographystyle{plain}
\bibliography{references}

\end{document}
`;

const TEMPLATE_BIB = `@book{knuth1984,
  author    = {Donald E. Knuth},
  title     = {The {\\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984}
}
`;

// A small generated PNG (gradient) so the sample figure compiles out of the box.
function samplePng(width = 240, height = 160) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const o = y * (width * 3 + 1) + 1 + x * 3;
      const t = x / width; const s = y / height;
      const ring = Math.hypot(x - width / 2, y - height / 2) % 28 < 3;
      raw[o] = ring ? 255 : Math.round(20 + 60 * t);
      raw[o + 1] = ring ? 255 : Math.round(120 + 100 * s);
      raw[o + 2] = ring ? 255 : Math.round(110 + 120 * (1 - t));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function createProject(name) {
  const dir = projectDir(name);
  if (await exists(dir)) throw new HttpError(409, 'A project with that name already exists');
  await fsp.mkdir(path.join(dir, 'images'), { recursive: true });
  await fsp.writeFile(path.join(dir, 'main.tex'), TEMPLATE);
  await fsp.writeFile(path.join(dir, 'references.bib'), TEMPLATE_BIB);
  await fsp.writeFile(path.join(dir, 'images', 'sample.png'), samplePng());
  await saveSettings(dir, { main: 'main.tex', engine: 'tectonic' });
  return dir;
}

// ---------- routes ----------

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api', ...]
  const q = url.searchParams;

  if (parts[1] === 'engines' && req.method === 'GET') return send(res, 200, detectEngines().map(({ id, label }) => ({ id, label })));

  if (parts[1] === 'projects' && parts.length === 2) {
    if (req.method === 'GET') {
      await fsp.mkdir(PROJECTS_DIR, { recursive: true });
      const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });
      const list = [];
      for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.')) list.push({ name: e.name, mtime: (await fsp.stat(path.join(PROJECTS_DIR, e.name))).mtimeMs });
      return send(res, 200, list.sort((a, b) => b.mtime - a.mtime));
    }
    if (req.method === 'POST') {
      const { name } = await readJson(req);
      await createProject(String(name || '').trim());
      return send(res, 201, { name });
    }
  }

  if (parts[1] !== 'projects' || parts.length < 4) throw new HttpError(404, 'Not found');
  const dir = projectDir(parts[2]);
  if (!(await exists(dir))) throw new HttpError(404, 'Project not found');
  const action = parts[3];

  switch (`${req.method} ${action}`) {
    case 'GET tree': return send(res, 200, { files: await listTree(dir), settings: await getSettings(dir) });

    case 'GET file': {
      const full = safeJoin(dir, q.get('path'));
      const st = await fsp.stat(full).catch(() => null);
      if (!st || !st.isFile()) throw new HttpError(404, 'File not found');
      return send(res, 200, await fsp.readFile(full), MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
    }

    case 'PUT file': {
      const full = safeJoin(dir, q.get('path'));
      const body = await readBody(req);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      if (q.get('overwrite') === '0' && (await exists(full))) throw new HttpError(409, 'File already exists');
      await fsp.writeFile(full, body);
      return send(res, 200, { ok: true, size: body.length });
    }

    case 'DELETE file': {
      const full = safeJoin(dir, q.get('path'));
      if (full === dir) throw new HttpError(400, 'Cannot delete the project root');
      await fsp.rm(full, { recursive: true, force: true });
      return send(res, 200, { ok: true });
    }

    case 'POST folder': {
      const { path: rel } = await readJson(req);
      await fsp.mkdir(safeJoin(dir, rel), { recursive: true });
      return send(res, 200, { ok: true });
    }

    case 'POST rename': {
      const { from, to } = await readJson(req);
      const a = safeJoin(dir, from); const b = safeJoin(dir, to);
      if (!(await exists(a))) throw new HttpError(404, 'Source not found');
      if (await exists(b)) throw new HttpError(409, 'Destination already exists');
      await fsp.mkdir(path.dirname(b), { recursive: true });
      await fsp.rename(a, b);
      return send(res, 200, { ok: true });
    }

    case 'POST import-url': {
      const { url: src, path: rel } = await readJson(req);
      let u;
      try { u = new URL(src); } catch { throw new HttpError(400, 'Invalid URL'); }
      if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, 'Only http(s) URLs are supported');
      const r = await fetch(u, { redirect: 'follow' }).catch((e) => { throw new HttpError(502, `Download failed: ${e.message}`); });
      if (!r.ok) throw new HttpError(502, `Download failed: HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_UPLOAD) throw new HttpError(413, 'File too large');
      let target = rel;
      if (!target) {
        const fromUrl = decodeURIComponent(path.posix.basename(u.pathname)) || 'download';
        const ext = path.extname(fromUrl) || { 'image/png': '.png', 'image/jpeg': '.jpg', 'application/pdf': '.pdf' }[(r.headers.get('content-type') || '').split(';')[0]] || '';
        target = 'images/' + (path.extname(fromUrl) ? fromUrl : fromUrl + ext);
      }
      const full = safeJoin(dir, target);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, buf);
      return send(res, 200, { ok: true, path: toPosix(path.relative(dir, full)), size: buf.length });
    }

    case 'POST settings': return send(res, 200, await saveSettings(dir, await readJson(req)));

    case 'POST compile': {
      const body = await readJson(req);
      const settings = await saveSettings(dir, { main: body.main, engine: body.engine });
      if (compiling.has(dir)) throw new HttpError(409, 'A compile is already running for this project');
      compiling.add(dir);
      try { return send(res, 200, await compile(dir, settings.main || 'main.tex', settings.engine)); }
      finally { compiling.delete(dir); }
    }

    case 'GET output': {
      const name = q.get('name') || '';
      const full = safeJoin(path.join(dir, BUILD), name);
      if (!(await exists(full))) throw new HttpError(404, 'Not built yet');
      const headers = q.get('download') ? { 'Content-Disposition': `attachment; filename="${path.basename(full).replace(/"/g, '')}"` } : {};
      return send(res, 200, await fsp.readFile(full), MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', headers);
    }

    case 'GET synctex-edit':
      return send(res, 200, await synctexEdit(dir, q.get('pdf'), Number(q.get('page')), Number(q.get('x')), Number(q.get('y'))));

    case 'GET synctex-view':
      return send(res, 200, await synctexView(dir, q.get('pdf'), q.get('file'), Number(q.get('line'))));

    default: throw new HttpError(404, 'Not found');
  }
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const full = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!full.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  const st = await fsp.stat(full).catch(() => null);
  if (!st || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');
    if (!authorized(req)) return send(res, 401, 'Authentication required', 'text/plain', { 'WWW-Authenticate': 'Basic realm="LaTeX Studio", charset="UTF-8"' });
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: err.message || 'Server error' });
    else res.end();
  }
});

(async () => {
  await fsp.mkdir(PROJECTS_DIR, { recursive: true });
  if (!(await fsp.readdir(PROJECTS_DIR)).some((n) => !n.startsWith('.'))) await createProject('Sample Project');
  const engines = detectEngines();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${PORT} is already in use — LaTeX Studio is probably already running.`);
      console.error(`  Open http://localhost:${PORT}, or close the other copy, or start on another port (e.g. set PORT=8080).\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log(`\n  LaTeX Studio running at http://localhost:${PORT}\n`);
    console.log(engines.length ? `  Engines: ${engines.map((e) => e.id).join(', ')}` : '  No LaTeX engine found — run `node scripts/setup.js` first.');
    if (!AUTH_PASSWORD && !['127.0.0.1', 'localhost', '::1'].includes(HOST)) console.warn('  WARNING: listening publicly with no AUTH_PASSWORD — anyone can read and edit your projects.');
  });
})();
