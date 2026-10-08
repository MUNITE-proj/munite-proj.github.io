import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import '@mathjax/src/js/util/asyncLoad/esm.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import { expressions } from './math-expressions.mjs';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({
  packages: ['base', 'ams'],
  formatError: (_, error) => {
    throw error;
  },
});
const output = new SVG({ fontCache: 'none' });
const document = mathjax.document('', { InputJax: tex, OutputJax: output });
const compiled = {};
for (const [key, [source, spoken]] of Object.entries(expressions)) {
  // Display math is one complete SVG. MathJax 4 can split inline math into
  // separate SVG fragments at relations for line breaking.
  const node = await document.convertPromise(source, {
    display: true,
    em: 16,
    ex: 8,
    containerWidth: 1280,
  });
  const fragments = adaptor.tags(node, 'svg');
  if (fragments.length !== 1)
    throw new Error(`Expected one complete SVG for ${key}, got ${fragments.length}.`);
  const svg = fragments[0];
  const viewBox = adaptor.getAttribute(svg, 'viewBox');
  const body = adaptor.innerHTML(svg);
  if (!viewBox || /(?:<merror|data-mjx-error|<use\b)/.test(body))
    throw new Error(`Invalid or font-dependent SVG: ${key}`);
  compiled[key] = { source, spoken, viewBox, body };
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const helpers = String.raw`
import { escapeHTML as escape } from '../../render.js';
/** Position a compiled TeX expression by its baseline, in its parent SVG. */
export function mathLabel(key, x, baseline, { size = 20, fill = '#1d2126', anchor = 'middle', className = '' } = {}) {
  const expression = expressions[key];
  if (!expression) throw new RangeError('Unknown math expression: ' + key);
  const [minX, minY, width, height] = expression.viewBox.split(/\s+/).map(Number);
  const ratio = size / 1000, scaledWidth = width * ratio;
  const left = x - (anchor === 'middle' ? scaledWidth / 2 : anchor === 'end' ? scaledWidth : 0);
  return '<svg class="math-label ' + escape(className) + '" x="' + left + '" y="' + (baseline + minY * ratio) + '" width="' + scaledWidth + '" height="' + (height * ratio) + '" viewBox="' + expression.viewBox + '" aria-hidden="true" focusable="false" style="overflow:visible;color:' + escape(fill) + '">' + expression.body + '</svg>';
}
/** HTML-sized outline math with an accessible spoken label. */
export function inlineMath(key, size = 20, { decorative = false } = {}) {
  const expression = expressions[key];
  if (!expression) throw new RangeError('Unknown math expression: ' + key);
  const [, minY, width, height] = expression.viewBox.split(/\s+/).map(Number), ratio = size / 1000;
  const accessibility = decorative ? ' aria-hidden="true"' : ' role="img" aria-label="' + escape(expression.spoken) + '"';
  return '<svg class="inline-math" xmlns="http://www.w3.org/2000/svg" width="' + (width * ratio) + '" height="' + (height * ratio) + '" viewBox="' + expression.viewBox + '"' + accessibility + ' style="vertical-align:' + (-(minY + height) * ratio) + 'px">' + expression.body + '</svg>';
}
`;
await mkdir(resolve(root, 'scripts/generated'), { recursive: true });
await writeFile(
  resolve(root, 'scripts/generated/math.mjs'),
  '// Generated outline math. Edit scripts/math-expressions.mjs, then npm run math.\nconst expressions = ' +
    JSON.stringify(compiled) +
    ';\n' +
    helpers,
  'utf8',
);
console.log(
  `Compiled ${Object.keys(compiled).length} TeX expressions into self-contained SVG paths.`,
);
