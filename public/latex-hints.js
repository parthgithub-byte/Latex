// LaTeX autocomplete: commands, environments, and project-aware completion of
// \ref / \cite / \includegraphics / \input arguments.
'use strict';

(function () {
  // [name, argument template]  — "|" marks where the cursor lands.
  const COMMANDS = [
    ['documentclass', '[|]{}'], ['usepackage', '{|}'], ['usepackage', '[|]{}'], ['begin', '{|}'], ['end', '{|}'],
    ['title', '{|}'], ['author', '{|}'], ['date', '{|}'], ['today', ''], ['maketitle', ''], ['tableofcontents', ''],
    ['listoffigures', ''], ['listoftables', ''], ['appendix', ''], ['part', '{|}'], ['chapter', '{|}'], ['chapter*', '{|}'],
    ['section', '{|}'], ['section*', '{|}'], ['subsection', '{|}'], ['subsection*', '{|}'], ['subsubsection', '{|}'],
    ['paragraph', '{|}'], ['subparagraph', '{|}'], ['textbf', '{|}'], ['textit', '{|}'], ['emph', '{|}'], ['underline', '{|}'],
    ['texttt', '{|}'], ['textsc', '{|}'], ['textsf', '{|}'], ['textrm', '{|}'], ['textsl', '{|}'], ['textup', '{|}'],
    ['textsuperscript', '{|}'], ['textsubscript', '{|}'], ['textcolor', '{|}{}'], ['color', '{|}'], ['colorbox', '{|}{}'],
    ['fcolorbox', '{|}{}{}'], ['highlight', '{|}'], ['hl', '{|}'], ['st', '{|}'], ['sout', '{|}'], ['uline', '{|}'],
    ['fbox', '{|}'], ['mbox', '{|}'], ['makebox', '[|]{}'], ['framebox', '[|]{}'], ['parbox', '{|}{}'], ['raisebox', '{|}{}'],
    ['footnote', '{|}'], ['footnotetext', '{|}'], ['marginpar', '{|}'], ['label', '{|}'], ['ref', '{|}'], ['eqref', '{|}'],
    ['pageref', '{|}'], ['autoref', '{|}'], ['nameref', '{|}'], ['cref', '{|}'], ['Cref', '{|}'], ['cite', '{|}'],
    ['citep', '{|}'], ['citet', '{|}'], ['parencite', '{|}'], ['textcite', '{|}'], ['autocite', '{|}'], ['footcite', '{|}'],
    ['nocite', '{|}'], ['bibliography', '{|}'], ['bibliographystyle', '{|}'], ['addbibresource', '{|}'], ['printbibliography', ''],
    ['includegraphics', '[width=\\linewidth]{|}'], ['includegraphics', '{|}'], ['includepdf', '[pages=-]{|}'], ['graphicspath', '{{|}}'],
    ['input', '{|}'], ['include', '{|}'], ['includeonly', '{|}'], ['subfile', '{|}'], ['import', '{|}{}'],
    ['caption', '{|}'], ['captionof', '{|}{}'], ['centering', ''], ['raggedright', ''], ['raggedleft', ''], ['item', ' '],
    ['item', '[|] '], ['url', '{|}'], ['href', '{|}{}'], ['hyperref', '[|]{}'], ['hypersetup', '{|}'],
    ['newcommand', '{\\|}{}'], ['renewcommand', '{\\|}{}'], ['newenvironment', '{|}{}{}'], ['DeclareMathOperator', '{\\|}{}'],
    ['newtheorem', '{|}{}'], ['setlength', '{\\|}{}'], ['setcounter', '{|}{}'], ['addtocounter', '{|}{}'],
    ['hspace', '{|}'], ['vspace', '{|}'], ['hspace*', '{|}'], ['vspace*', '{|}'], ['hfill', ''], ['vfill', ''], ['quad', ''],
    ['qquad', ''], ['noindent', ''], ['indent', ''], ['newline', ''], ['linebreak', ''], ['newpage', ''], ['clearpage', ''],
    ['cleardoublepage', ''], ['pagebreak', ''], ['bigskip', ''], ['medskip', ''], ['smallskip', ''], ['par', ''],
    ['tiny', ''], ['scriptsize', ''], ['footnotesize', ''], ['small', ''], ['normalsize', ''], ['large', ''], ['Large', ''],
    ['LARGE', ''], ['huge', ''], ['Huge', ''], ['bfseries', ''], ['itshape', ''], ['ttfamily', ''], ['sffamily', ''],
    ['rmfamily', ''], ['scshape', ''], ['normalfont', ''], ['linewidth', ''], ['textwidth', ''], ['columnwidth', ''],
    ['textheight', ''], ['paperwidth', ''], ['baselineskip', ''], ['hline', ''], ['cline', '{|}'], ['toprule', ''],
    ['midrule', ''], ['bottomrule', ''], ['cmidrule', '{|}'], ['multicolumn', '{|}{}{}'], ['multirow', '{|}{}{}'],
    ['rowcolor', '{|}'], ['cellcolor', '{|}'], ['arraystretch', ''], ['tabcolsep', ''], ['thispagestyle', '{|}'],
    ['pagestyle', '{|}'], ['pagenumbering', '{|}'], ['fancyhead', '[|]{}'], ['fancyfoot', '[|]{}'], ['lstinputlisting', '[|]{}'],
    ['inputminted', '{|}{}'], ['mintinline', '{|}{}'], ['verb', ''], ['LaTeX', ''], ['TeX', ''], ['ldots', ''], ['dots', ''],
    // Maths
    ['frac', '{|}{}'], ['dfrac', '{|}{}'], ['tfrac', '{|}{}'], ['sqrt', '{|}'], ['sqrt', '[|]{}'], ['binom', '{|}{}'],
    ['sum', '_{|}^{}'], ['prod', '_{|}^{}'], ['int', '_{|}^{}'], ['iint', ''], ['oint', ''], ['lim', '_{|}'], ['infty', ''],
    ['partial', ''], ['nabla', ''], ['cdot', ''], ['cdots', ''], ['vdots', ''], ['ddots', ''], ['times', ''], ['div', ''],
    ['pm', ''], ['mp', ''], ['leq', ''], ['geq', ''], ['neq', ''], ['approx', ''], ['equiv', ''], ['sim', ''], ['propto', ''],
    ['in', ''], ['notin', ''], ['subset', ''], ['subseteq', ''], ['cup', ''], ['cap', ''], ['emptyset', ''], ['forall', ''],
    ['exists', ''], ['neg', ''], ['land', ''], ['lor', ''], ['to', ''], ['rightarrow', ''], ['leftarrow', ''],
    ['Rightarrow', ''], ['Leftrightarrow', ''], ['mapsto', ''], ['left', '(|\\right)'], ['right', ''], ['big', ''],
    ['mathbb', '{|}'], ['mathcal', '{|}'], ['mathbf', '{|}'], ['mathrm', '{|}'], ['mathit', '{|}'], ['mathsf', '{|}'],
    ['mathfrak', '{|}'], ['boldsymbol', '{|}'], ['text', '{|}'], ['operatorname', '{|}'], ['hat', '{|}'], ['bar', '{|}'],
    ['vec', '{|}'], ['dot', '{|}'], ['ddot', '{|}'], ['tilde', '{|}'], ['widehat', '{|}'], ['overline', '{|}'],
    ['underbrace', '{|}_{}'], ['overbrace', '{|}^{}'], ['sin', ''], ['cos', ''], ['tan', ''], ['log', ''], ['ln', ''],
    ['exp', ''], ['max', ''], ['min', ''], ['arg', ''], ['det', ''], ['tag', '{|}'], ['notag', ''], ['nonumber', ''],
    ['alpha', ''], ['beta', ''], ['gamma', ''], ['Gamma', ''], ['delta', ''], ['Delta', ''], ['epsilon', ''],
    ['varepsilon', ''], ['zeta', ''], ['eta', ''], ['theta', ''], ['Theta', ''], ['vartheta', ''], ['iota', ''],
    ['kappa', ''], ['lambda', ''], ['Lambda', ''], ['mu', ''], ['nu', ''], ['xi', ''], ['Xi', ''], ['pi', ''], ['Pi', ''],
    ['rho', ''], ['sigma', ''], ['Sigma', ''], ['tau', ''], ['upsilon', ''], ['phi', ''], ['Phi', ''], ['varphi', ''],
    ['chi', ''], ['psi', ''], ['Psi', ''], ['omega', ''], ['Omega', ''],
  ];

  const ENVIRONMENTS = {
    itemize: '\n\\item |\n', enumerate: '\n\\item |\n', description: '\n\\item[|] \n',
    figure: '[htbp]\n\\centering\n\\includegraphics[width=0.8\\linewidth]{|}\n\\caption{}\n\\label{fig:}\n',
    'figure*': '[htbp]\n\\centering\n|\n\\caption{}\n',
    table: '[htbp]\n\\centering\n\\begin{tabular}{lll}\n\\toprule\n| &  &  \\\\\n\\midrule\n &  &  \\\\\n\\bottomrule\n\\end{tabular}\n\\caption{}\n\\label{tab:}\n',
    tabular: '{|}\n\n', 'tabular*': '{\\linewidth}{|}\n\n', tabularx: '{\\linewidth}{|}\n\n', longtable: '{|}\n\n', array: '{|}\n\n',
    equation: '\n|\n', 'equation*': '\n|\n', align: '\n|\n', 'align*': '\n|\n', gather: '\n|\n', 'gather*': '\n|\n',
    multline: '\n|\n', split: '\n|\n', cases: '\n|\n', matrix: '\n|\n', pmatrix: '\n|\n', bmatrix: '\n|\n', vmatrix: '\n|\n',
    center: '\n|\n', flushleft: '\n|\n', flushright: '\n|\n', abstract: '\n|\n', quote: '\n|\n', quotation: '\n|\n',
    verbatim: '\n|\n', lstlisting: '[language=Python]\n|\n', minted: '{python}\n|\n', minipage: '{0.48\\linewidth}\n|\n',
    subfigure: '{0.48\\linewidth}\n\\centering\n\\includegraphics[width=\\linewidth]{|}\n\\caption{}\n',
    theorem: '\n|\n', lemma: '\n|\n', proof: '\n|\n', definition: '\n|\n', example: '\n|\n', remark: '\n|\n',
    document: '\n|\n', thebibliography: '{9}\n\\bibitem{|} \n', frame: '{|}\n\n', columns: '\n\\column{0.5\\textwidth}\n|\n',
    tikzpicture: '\n|\n', axis: '\n|\n', titlepage: '\n|\n', multicols: '{2}\n|\n', wrapfigure: '{r}{0.4\\linewidth}\n\\centering\n\\includegraphics[width=\\linewidth]{|}\n\\caption{}\n',
  };

  const REF_CMDS = /\\(?:ref|eqref|pageref|autoref|nameref|cref|Cref|vref|labelcref)\{([^}]*)$/;
  const CITE_CMDS = /\\(?:cite|citep|citet|citealp|citealt|parencite|textcite|autocite|footcite|nocite|Cite|fullcite)\*?(?:\[[^\]]*\]){0,2}\{([^}]*)$/;
  const GRAPHIC_CMDS = /\\(?:includegraphics|includepdf|includesvg)\*?(?:\[[^\]]*\])?\{([^}]*)$/;
  const INPUT_CMDS = /\\(?:input|include|subfile|includeonly|lstinputlisting(?:\[[^\]]*\])?)\{([^}]*)$/;
  const BIB_CMDS = /\\(?:bibliography|addbibresource)\{([^}]*)$/;
  const BEGIN_CMD = /\\(begin|end)\{([^}]*)$/;
  const COMMAND = /\\([A-Za-z@]*\*?)$/;

  function pick(cm, data, completion) {
    // Insert text containing a "|" cursor marker, re-indenting continuation lines.
    const indent = cm.getLine(data.from.line).match(/^\s*/)[0];
    const text = completion.insert.replace(/\n/g, '\n' + indent);
    const at = text.indexOf('|');
    const clean = text.replace('|', '');
    cm.replaceRange(clean, data.from, data.to, 'complete');
    if (at >= 0) {
      const before = clean.slice(0, at).split('\n');
      const line = data.from.line + before.length - 1;
      const ch = before.length === 1 ? data.from.ch + before[0].length : before[before.length - 1].length;
      cm.setCursor({ line, ch });
    }
  }

  // Body format: "<options>\n<inner line>\n...\n" — inner lines get indented two spaces.
  function envInsert(name, body) {
    const [opts, ...rest] = body.split('\n');
    const inner = rest.slice(0, -1).map((l) => '  ' + l).join('\n');
    return name + '}' + opts + '\n' + inner + '\n\\end{' + name + '}';
  }

  function item(text, insert, kind) { return { text, displayText: text, insert, kind, hint: pick, render(el, _d, c) { el.innerHTML = ''; el.appendChild(document.createTextNode(c.displayText)); const k = document.createElement('span'); k.className = 'hint-kind'; k.textContent = c.kind || ''; el.appendChild(k); } }; }

  function rank(list, prefix) {
    const p = prefix.toLowerCase();
    // Prefix matches first, then keep the source order (lists are ordered most-common first).
    return list
      .map((c, i) => ({ c, i, pre: c.match.toLowerCase().startsWith(p) ? 0 : 1 }))
      .filter(({ c }) => c.match.toLowerCase().includes(p))
      .sort((a, b) => a.pre - b.pre || a.i - b.i)
      .map(({ c }) => c)
      .slice(0, 80);
  }

  // ctx: { labels(), citeKeys(), files(), relPath(path), userCommands() }
  window.makeLatexHint = function (ctx) {
    return function hint(cm) {
      const cur = cm.getCursor();
      const lineText = cm.getLine(cur.line);
      const before = lineText.slice(0, cur.ch);
      // Within a "{...}" argument, complete up to the last comma (for multi-cite / multi-ref).
      const argList = (s) => { const i = s.lastIndexOf(','); return i >= 0 ? s.slice(i + 1).trimStart() : s; };
      const argRange = (word) => ({ from: CodeMirror.Pos(cur.line, cur.ch - word.length), to: CodeMirror.Pos(cur.line, cur.ch + (lineText.slice(cur.ch).match(/^[^},\s]*/)[0].length)) });
      let m;

      if ((m = before.match(REF_CMDS))) {
        const w = argList(m[1]);
        const list = rank(ctx.labels().map((l) => ({ ...item(l.label, l.label, l.file), match: l.label })), w);
        return { list, ...argRange(w) };
      }
      if ((m = before.match(CITE_CMDS))) {
        const w = argList(m[1]);
        const list = rank(ctx.citeKeys().map((k) => ({ ...item(k.key, k.key, k.title || 'bib'), match: k.key + ' ' + (k.title || '') })), w);
        return { list, ...argRange(w) };
      }
      if ((m = before.match(GRAPHIC_CMDS))) {
        const w = m[1];
        const files = ctx.files().filter((f) => /\.(png|jpe?g|pdf|eps|svg|gif|bmp|webp)$/i.test(f));
        const list = rank(files.map((f) => { const r = ctx.graphicPath(f); return { ...item(r, r, 'image'), match: r }; }), w);
        return { list, ...argRange(w) };
      }
      if ((m = before.match(INPUT_CMDS))) {
        const w = m[1];
        const files = ctx.files().filter((f) => /\.(tex|sty|cls|py|txt|c|cpp|java|js|m|r)$/i.test(f));
        const list = rank(files.map((f) => { const r = ctx.relPath(f).replace(/\.tex$/i, ''); return { ...item(r, r, 'file'), match: r }; }), w);
        return { list, ...argRange(w) };
      }
      if ((m = before.match(BIB_CMDS))) {
        const w = argList(m[1]);
        const isBiblatex = /addbibresource/.test(before);
        const list = rank(ctx.files().filter((f) => /\.bib$/i.test(f)).map((f) => { const r = isBiblatex ? ctx.relPath(f) : ctx.relPath(f).replace(/\.bib$/i, ''); return { ...item(r, r, 'bib'), match: r }; }), w);
        return { list, ...argRange(w) };
      }
      if ((m = before.match(BEGIN_CMD))) {
        const w = m[2];
        const names = Object.keys(ENVIRONMENTS);
        const from = CodeMirror.Pos(cur.line, cur.ch - w.length);
        const rest = lineText.slice(cur.ch);
        const to = CodeMirror.Pos(cur.line, cur.ch + (rest.match(/^[^}]*\}?/)[0].length));
        const list = rank(names.map((n) => ({
          ...item(n, m[1] === 'begin' ? envInsert(n, ENVIRONMENTS[n]) : n + '}', 'environment'), match: n,
        })), w);
        return { list, from, to };
      }
      if ((m = before.match(COMMAND))) {
        const w = m[1];
        const from = CodeMirror.Pos(cur.line, cur.ch - w.length);
        const user = ctx.userCommands().map((c) => ({ ...item('\\' + c.name, c.name + (c.args ? '{|}' + '{}'.repeat(c.args - 1) : ''), 'yours'), match: c.name }));
        const builtin = COMMANDS.map(([name, args]) => ({ ...item('\\' + name + args.replace('|', ''), name + (args || ''), ''), match: name }));
        const list = rank(user.concat(builtin), w).filter((c, i, arr) => arr.findIndex((o) => o.displayText === c.displayText) === i);
        return { list, from, to: cur };
      }
      return null;
    };
  };

  window.LATEX_ENVIRONMENTS = ENVIRONMENTS;
})();
