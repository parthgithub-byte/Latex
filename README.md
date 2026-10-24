# LaTeX Studio

A local, Overleaf-style LaTeX editor: write LaTeX on the left, press **Recompile**, read the PDF on the right, download it.

It runs entirely on your own computer: a small Node.js server plus a browser UI. It compiles with a real LaTeX engine (Tectonic), so documents render exactly as LaTeX would render them, not as an approximation.

---

## Setup

### 1. Install Node.js (one time)

You need **Node.js 18 or newer**.

1. Download the **LTS** installer from <https://nodejs.org> and run it with the default options.
2. Open a **new** terminal (Command Prompt or PowerShell on Windows, Terminal on macOS/Linux) and check it worked:

   ```
   node --version
   ```

   It should print `v18.x` or higher. If it says the command isn't recognised, restart the terminal (or the computer) so the new PATH is picked up.

You do **not** need to install LaTeX (MiKTeX/TeX Live), Python or anything from npm. There is no `npm install` step.

### 2. Get the project folder

Copy or clone the `Latex` folder anywhere on your computer, then open a terminal in it:

```
cd "path/to/Latex"
```

It should contain `server.js`, `package.json`, `start.bat`, `scripts/` and `public/`.

### 3. Run the one-time setup

```
npm run setup
```

(`node scripts/setup.js` does the same thing.)

This needs an internet connection and downloads:

| What | Where it goes | Size |
|---|---|---|
| Tectonic LaTeX engine 0.17.0 (from GitHub) | `bin/` | ~50 MB |
| CodeMirror editor and PDF.js viewer (from cdnjs) | `public/vendor/` | ~1.5 MB |

When it finishes you'll see `Done. Start the app with: npm start`. It is safe to run again: anything already downloaded is skipped.

On Windows you can skip this step and just double-click **`start.bat`**: it runs the setup automatically the first time.

### 4. Start the app

```
npm start
```

Then open **<http://localhost:5173>** in Chrome, Edge or Firefox.

Windows shortcut: double-click **`start.bat`**. It starts the server and opens the browser for you. Keep that window open while you work, and close it to stop the app.

To stop the server from a terminal, press **Ctrl+C**.

### 5. First compile (one time, slow)

On first launch a sample project called **My Project** is created. Press **Recompile**.

The **first ever compile takes a few minutes** (about 8 minutes on a typical connection), because Tectonic downloads the LaTeX formats, fonts and packages it needs (~40 MB). This happens only once. They're cached on your computer, and later compiles take a few seconds.

When you use a new package (e.g. `\usepackage{tikz}`) for the first time, its files are downloaded during that compile, so that one compile is a bit slower.

The package cache lives at:

- Windows: `%LOCALAPPDATA%\TectonicProject\`
- macOS: `~/Library/Caches/Tectonic/`
- Linux: `~/.cache/Tectonic/`

After the first compile you can work **offline**, as long as you only use packages that have already been downloaded.

---

## Everyday use

1. Run `npm start` (or double-click `start.bat`) and open <http://localhost:5173>.
2. Pick a project from the dropdown at the top left, or click **+ New** to create one.
3. Edit, then press **Recompile** (or **Ctrl+Enter** / **Ctrl+S**).
4. Click **⤓ PDF** to download the PDF.

Your work is saved automatically as you type ("All changes saved" in the bottom bar).

### Starting your own document

- **New project:** **+ New** creates a project with a starter `main.tex`, `references.bib` and an `images/` folder.
- **Bring in an existing Overleaf project:** in Overleaf, use *Menu → Download → Source* to get a `.zip` and unzip it. In LaTeX Studio, create a new project, delete the starter files, and drag the unzipped folder's contents onto the file tree. Then choose the right file in the **Main** dropdown (the one with `\documentclass`).
- **Main document:** the **Main** dropdown chooses which `.tex` file gets compiled. You can also right-click a file → *Set as main document*.

### Images and other files

- **Upload:** use the upload buttons above the file tree (files or a whole folder), or drag files or folders onto the tree. Dropping onto a folder puts the files in that folder.
- **Drop onto the editor:** the image is saved to `images/` and a complete `figure` block is inserted where you dropped it.
- **Paste a screenshot:** press **Ctrl+V** in the editor. It's saved to `images/` and inserted as a figure.
- **Import from URL:** the link button above the tree downloads a file into the project.
- **Toolbar 🖼 Figure:** pick an existing image, upload one, or import one from a URL.
- **Supported formats:** PNG, JPG, PDF and EPS are used directly. SVG, GIF, WebP and BMP are converted to PNG automatically, because LaTeX can't include them as they are.
- **Paths:** inserted paths are relative to the main file and respect your `\graphicspath`. If `\usepackage{graphicx}` is missing, it is added for you.
- **Other file types:**
  - dropping a `.tex` file inserts `\input{…}`
  - dropping a `.bib` file inserts `\bibliography{…}` (or `\addbibresource{…}` if you use biblatex)
  - dropping a code file inserts `\lstinputlisting{…}`
- **Managing files:** right-click any file or folder to rename, move, delete, download or insert it. You can also drag a file onto a folder to move it.

### Editor features

- Syntax highlighting, bracket matching, auto-closing brackets and `$…$`.
- **Autocomplete** for commands and environments, plus `\ref{}` labels, `\cite{}` keys from your `.bib` files, image paths and `\input` files. It opens as you type; **Ctrl+Space** opens it manually.
- **Formatting toolbar:** bold, italic, underline, monospace, headings, lists, maths, equations, figures, tables, links, citations and references.
- **SyncTeX:** double-click anywhere in the PDF to jump to that line of source. **→ PDF** (or **Ctrl+Alt+→**) highlights the cursor's line in the PDF.
- **Logs** button: errors and warnings with file and line number. Click one to jump to it. Problem lines are also highlighted in the editor.
- **Auto: On:** recompiles automatically 2.5 s after you stop typing.

| Shortcut | Action |
|---|---|
| Ctrl+Enter / Ctrl+S | Recompile |
| Ctrl+B / Ctrl+I | Bold / italic |
| Ctrl+/ | Comment / uncomment lines |
| Ctrl+Space | Autocomplete |
| Ctrl+F / Shift+Ctrl+F | Find / replace |
| Alt+G | Go to line |
| Ctrl+Alt+→ | Show current line in PDF |
| Ctrl+mouse wheel (on PDF) | Zoom |

(On macOS use Cmd instead of Ctrl.)

---

## Optional: pdfLaTeX / LuaLaTeX

Tectonic uses the XeLaTeX engine, which compiles almost every document. If you specifically need **pdfLaTeX** or **LuaLaTeX**:

1. Install **MiKTeX** (<https://miktex.org>, Windows) or **TeX Live** (<https://tug.org/texlive>, macOS/Linux). On Windows, enable *"Install missing packages on-the-fly: Yes"* during installation.
2. Restart LaTeX Studio.

The **Engine** dropdown now also lists pdfLaTeX, XeLaTeX and LuaLaTeX from your system install. Choose one per project; the choice is remembered.

---

## Configuration

| Setting | How | Default |
|---|---|---|
| Port | set the `PORT` environment variable | `5173` |
| Listen address | set the `HOST` environment variable | `127.0.0.1` (this computer only) |
| Password | set `AUTH_PASSWORD` (and optionally `AUTH_USER`) to require a browser login | off; user `admin` |
| Projects folder | set the `PROJECTS_DIR` environment variable | `projects/` next to `server.js` |

Examples:

```
# macOS / Linux
PORT=8080 npm start

# Windows PowerShell
$env:PORT=8080; npm start

# Windows Command Prompt
set PORT=8080 && npm start
```

Leave `HOST` alone unless you understand the risk. Without `AUTH_PASSWORD` the app has no login, so anyone who can reach the port can read and edit your projects.

---

## Deploy to Render

The repo includes a `Dockerfile` and a `render.yaml` Blueprint. The image downloads the Linux Tectonic build and pre-caches the common LaTeX packages, so the first compile is fast.

1. Push this repo to GitHub.
2. In the [Render dashboard](https://dashboard.render.com): **New + → Blueprint**, pick the repo, and enter a value for **`AUTH_PASSWORD`** when asked. Log in with user `admin` and that password.
3. Wait for the build (several minutes the first time), then open the `onrender.com` URL.

Things to know:

- **Projects are not kept on the free plan.** Render's filesystem is wiped on every deploy and restart. **Download your PDF and sources** before redeploying, or switch to a paid plan and enable the disk block in `render.yaml` (with `PROJECTS_DIR=/data/projects`).
- Free instances sleep after ~15 minutes idle; the next visit takes about a minute to wake.
- Packages that aren't pre-cached are downloaded the first time a document uses them.

---

## Where things are stored

```
Latex/
├── projects/            ← your work: one folder per project
│   └── My Project/
│       ├── main.tex
│       ├── references.bib
│       ├── images/
│       ├── .studio.json   (main file + engine choice)
│       └── .build/        (compiled PDF, log, aux files; safe to delete)
├── bin/                 ← Tectonic engine (downloaded by setup)
├── public/              ← web UI (public/vendor is downloaded by setup)
├── scripts/setup.js
└── server.js
```

Projects are ordinary folders. To **back up** a project, copy its folder; to **delete** one, delete its folder (while the app is stopped). The included `.gitignore` excludes `bin/`, `public/vendor/` and the whole `projects/` folder, so your own documents are never committed; a fresh clone creates a generic sample project on first run.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` / `npm` not recognised | Install Node.js (step 1), then open a **new** terminal. |
| `npm` gives "running scripts is disabled" in PowerShell | Use `node scripts/setup.js` and `node server.js` instead, or run them from Command Prompt. |
| Setup fails with `HTTP 403` from api.github.com | GitHub's anonymous rate limit was hit. Wait an hour and run `npm run setup` again. |
| Setup fails with a network error | Check your internet / proxy / firewall. University networks sometimes block GitHub downloads; try another network. Re-running setup resumes where it stopped. |
| Setup fails at the `tar` step | Windows 10 (1803+) and 11, macOS and Linux include `tar`. On older Windows, download the Tectonic zip manually from <https://github.com/tectonic-typesetting/tectonic/releases> and put `tectonic.exe` in `bin/`. |
| `npm start` exits straight away / "Port 5173 is already in use" | Another copy is already running: just open <http://localhost:5173>, or close the other window first. To run a second copy, use another port: `PORT=8080 npm start`. |
| Page says "No LaTeX engine found" | Setup didn't finish. Run `npm run setup`, then restart. |
| First compile seems stuck | It's downloading packages (see step 5). The overlay shows elapsed time; give it several minutes on the first run. |
| `Fontconfig error: Cannot load default config file` in the raw log | Harmless on Windows; ignore it. |
| A package fails to download | Check your connection and recompile; downloads are retried on each compile. |
| `minted` or `\write18` doesn't work | Shell escape is disabled for safety. Use the `listings` package for code instead. |
| `.svg` included with `\includesvg` fails | Use the auto-generated `.png` next to it (or click *Make LaTeX-ready PNG* in the image preview) with `\includegraphics`. |
| PDF looks outdated | Errors may have stopped the build. Open **Logs**, fix the first error, recompile. |
| Something is broken after an update | Delete `bin/` and `public/vendor/`, run `npm run setup` again, and reload the browser with Ctrl+F5. |

---

## Uninstall

1. Stop the app.
2. Copy anything you want to keep out of `projects/`.
3. Delete the `Latex` folder.
4. Optionally delete the package cache (see step 5 for its location).
