// One-time setup: downloads the Tectonic LaTeX engine into ./bin and the
// browser libraries (CodeMirror editor, PDF.js viewer) into ./public/vendor.
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'bin');
const VENDOR_DIR = path.join(ROOT, 'public', 'vendor');
const TECTONIC_TAG = 'tectonic@0.17.0';

const CM = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
const VENDOR = {
  'codemirror/codemirror.css': `${CM}/codemirror.min.css`,
  'codemirror/codemirror.js': `${CM}/codemirror.min.js`,
  'codemirror/stex.js': `${CM}/mode/stex/stex.min.js`,
  'codemirror/matchbrackets.js': `${CM}/addon/edit/matchbrackets.min.js`,
  'codemirror/closebrackets.js': `${CM}/addon/edit/closebrackets.min.js`,
  'codemirror/active-line.js': `${CM}/addon/selection/active-line.min.js`,
  'codemirror/searchcursor.js': `${CM}/addon/search/searchcursor.min.js`,
  'codemirror/search.js': `${CM}/addon/search/search.min.js`,
  'codemirror/jump-to-line.js': `${CM}/addon/search/jump-to-line.min.js`,
  'codemirror/dialog.js': `${CM}/addon/dialog/dialog.min.js`,
  'codemirror/dialog.css': `${CM}/addon/dialog/dialog.min.css`,
  'codemirror/show-hint.js': `${CM}/addon/hint/show-hint.min.js`,
  'codemirror/show-hint.css': `${CM}/addon/hint/show-hint.min.css`,
  'codemirror/comment.js': `${CM}/addon/comment/comment.min.js`,
  'pdfjs/pdf.js': `${PDFJS}/pdf.min.js`,
  'pdfjs/pdf.worker.js': `${PDFJS}/pdf.worker.min.js`,
};

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'latex-studio-setup' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function tectonicTarget() {
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (process.platform === 'win32') return `${arch}-pc-windows-msvc`;
  if (process.platform === 'darwin') return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-musl`;
}

async function installTectonic() {
  const exe = path.join(BIN_DIR, process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
  if (fs.existsSync(exe)) { console.log('✓ Tectonic already installed'); return; }
  // Build the release URL directly instead of asking the GitHub API, whose anonymous rate limit
  // is easily hit from shared CI / hosting build machines.
  const version = TECTONIC_TAG.split('@')[1];
  const name = `tectonic-${version}-${tectonicTarget()}.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`;
  console.log(`↓ ${name}`);
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'tectonic-'));
  const archive = path.join(tmp, name);
  await download(`https://github.com/tectonic-typesetting/tectonic/releases/download/${encodeURIComponent(TECTONIC_TAG)}/${name}`, archive);
  await fsp.mkdir(BIN_DIR, { recursive: true });
  execFileSync('tar', ['-xf', archive, '-C', BIN_DIR]); // bsdtar ships with Windows 10+ and handles .zip
  await fsp.rm(tmp, { recursive: true, force: true });
  if (process.platform !== 'win32') await fsp.chmod(exe, 0o755);
  console.log('✓ Tectonic installed');
}

async function installVendor() {
  for (const [rel, url] of Object.entries(VENDOR)) {
    const dest = path.join(VENDOR_DIR, rel);
    if (fs.existsSync(dest)) continue;
    console.log(`↓ ${rel}`);
    await download(url, dest);
  }
  console.log('✓ Editor and PDF viewer libraries ready');
}

(async () => {
  try {
    await installVendor();
    // --vendor-only: static frontend hosts (e.g. Vercel) need the browser libraries but not the LaTeX engine.
    if (process.argv.includes('--vendor-only')) return;
    await installTectonic();
    console.log('\nDone. Start the app with:  npm start   (or double-click start.bat)');
  } catch (err) {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  }
})();
