// Builds a copy of Setcards for Safari 12 (older iPads) into the folder given, default dist/legacy.
// Scripts are compiled to ES2017, the stylesheet is rewritten without newer CSS, and the polyfills are added.
// Run after scripts/get-lib.sh, so lib/alphaTab.min.js exists.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import postcss from 'postcss';
import gapProperties from 'postcss-gap-properties';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] || 'dist/legacy');
const at = (p) => join(root, p);

const SCRIPTS = ['app.js', 'js/analysis.js', 'js/chords.js', 'js/noteedit.js', 'js/storage.js', 'demo.js', 'config.js', 'version.js', 'sw.js', 'lib/alphaTab.min.js'];

// Colour tokens get an r, g, b companion so colours can be mixed with rgba(); used by the legacy colour rules.
function addColourCompanions(css) {
  return css.replace(/(--[\w-]+):\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3});/g, (m, name, hex) => {
    const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
    const rgb = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(', ');
    return `${m} ${name}-rgb: ${rgb};`;
  });
}

// color-mix(in srgb, var(--a) P%, transparent) becomes rgba(). Mixing with an opaque colour on a background
// is layered: a translucent colour over a solid one, which is what color-mix gives.
function rewriteColourMix(css) {
  const re = /color-mix\(in srgb, var\((--[\w-]+)\) (\d+(?:\.\d+)?)%, (transparent|var\((--[\w-]+)\))\)/g;
  return css.replace(re, (m, a, pct, b, bVar, offset, str) => {
    const alpha = Number((Number(pct) / 100).toFixed(3));
    const translucent = `rgba(var(${a}-rgb), ${alpha})`;
    if (b === 'transparent') return translucent;
    const lineStart = str.lastIndexOf('\n', offset) + 1;
    const before = str.slice(lineStart, offset);
    const prop = (before.match(/([\w-]+)\s*:[^;]*$/) || [])[1];
    if (prop === 'background') return `linear-gradient(${translucent}, ${translucent}), var(${bVar})`;
    return translucent;
  });
}

function rewriteOtherNewCss(css) {
  return css
    // inset (Safari 14.1) written out as the four sides
    .replace(/([{;\s])inset:\s*([^;}]+);/g, (m, pre, v) => `${pre}top: ${v}; right: ${v}; bottom: ${v}; left: ${v};`)
    // dynamic viewport units (Safari 15.4): the nearest older unit
    .replace(/(\d)dvh\b/g, '$1vh')
    // aspect-ratio (Safari 15): the video frame keeps 16:9 with padding instead
    .replace(/aspect-ratio:\s*16 \/ 9;/g, 'height: 0; padding-bottom: 56.25%;');
}

// Flexbox gap (Safari 14.1): the same spacing as margins on every item after the first.
function flexGapRules() {
  return {
    postcssPlugin: 'legacy-flex-gap',
    OnceExit(root) {
      const add = [];
      root.walkRules((rule) => {
        const decls = rule.nodes.filter((n) => n.type === 'decl');
        const display = decls.filter((d) => d.prop === 'display').map((d) => d.value.trim()).pop();
        const gap = decls.filter((d) => d.prop === 'gap').pop();
        if (!gap || !/^(inline-)?flex$/.test(display || '')) return;
        const dir = decls.filter((d) => d.prop === 'flex-direction').map((d) => d.value.trim()).pop() || 'row';
        // gap is "row column" or one value; between items in a row the column gap is used, in a column the row gap
        const [rowGap, columnGap = rowGap] = gap.value.trim().split(/\s+/);
        const column = dir.startsWith('column');
        const size = column ? rowGap : columnGap;
        const prop = column ? 'margin-top' : 'margin-left';
        add.push({ rule, selector: rule.selectors.map((s) => `${s} > * + *`).join(', '), prop, size });
      });
      add.forEach(({ rule, selector, prop, size }) => {
        rule.after(postcss.rule({ selector, nodes: [postcss.decl({ prop, value: size })] }));
      });
    }
  };
}
flexGapRules.postcss = true;

async function legacyCss(src) {
  let css = addColourCompanions(src);
  css = rewriteColourMix(css);
  css = rewriteOtherNewCss(css);
  const result = await postcss([gapProperties(), flexGapRules()]).process(css, { from: undefined });
  return result.css;
}

function legacyScript(file, code) {
  if (file === 'sw.js') code = code.replace("const CACHE = 'setcards-' + VERSION;", "const CACHE = 'setcards-legacy-' + VERSION;");
  return transformSync(code, { loader: 'js', target: 'es2017', legalComments: 'none' }).code;
}

async function main() {
  mkdirSync(out, { recursive: true });
  for (const f of SCRIPTS) {
    if (!existsSync(at(f))) throw new Error(`${f} is missing: run scripts/get-lib.sh first`);
    const dest = join(out, f);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, legacyScript(f, readFileSync(at(f), 'utf8')));
  }

  writeFileSync(join(out, 'styles.css'), await legacyCss(readFileSync(at('styles.css'), 'utf8')));

  // the polyfill for <dialog> (Safari 15.4) comes from the dialog-polyfill package
  copyFileSync(at('node_modules/dialog-polyfill/dist/dialog-polyfill.js'), join(out, 'dialog-polyfill.js'));
  copyFileSync(at('node_modules/dialog-polyfill/dist/dialog-polyfill.css'), join(out, 'dialog-polyfill.css'));
  copyFileSync(at('scripts/legacy-polyfills.js'), join(out, 'legacy-polyfills.js'));

  let html = readFileSync(at('index.html'), 'utf8');
  html = html.replace('</head>', '  <link rel="stylesheet" href="dialog-polyfill.css">\n</head>');
  const legacyTags = [
    '<script src="dialog-polyfill.js"></script>',
    '<script src="legacy-polyfills.js"></script>',
    '<script>document.querySelectorAll("dialog").forEach(function (d) { dialogPolyfill.registerDialog(d); });</script>'
  ].join('\n  ');
  html = html.replace('<script src="lib/alphaTab.min.js"></script>', `${legacyTags}\n  <script src="lib/alphaTab.min.js"></script>`);
  writeFileSync(join(out, 'index.html'), html);

  copyFileSync(at('manifest.webmanifest'), join(out, 'manifest.webmanifest'));
  copyFileSync(at('icon.svg'), join(out, 'icon.svg'));
  cpSync(at('lib/font'), join(out, 'lib/font'), { recursive: true });
  cpSync(at('lib/soundfont'), join(out, 'lib/soundfont'), { recursive: true });
  console.log(`Legacy build written to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
