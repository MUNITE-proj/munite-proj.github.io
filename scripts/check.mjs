import { escapeHTML } from '../render.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  attributeValue,
  elementByID,
  hasAncestor,
  hasClass,
  isJSControl,
  parseHTML,
  renderIndex,
} from './prerender.mjs';
import { compileWaveforms } from './compile-waveforms.mjs';
import { publicFiles, isPublic } from './public-files.mjs';
import { renderDefaultBlocks } from './render-defaults.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const built = process.argv.includes('--dist');
const buildInput = process.argv.includes('--build-input');
assert(!(built && buildInput), 'Check either source build input or an existing dist package.');
const root = built ? resolve(sourceRoot, 'dist') : sourceRoot;
const run = promisify(execFile);
if (!built)
  await run(process.execPath, [
    '--test',
    resolve(sourceRoot, 'scripts/stories.test.mjs'),
    resolve(sourceRoot, 'scripts/audio.test.mjs'),
  ]);
const checkedFiles = new Map();
const directoryEntries = new Map();
async function localFile(url, base = root) {
  assert(
    !isAbsolute(url) && !url.includes('\\'),
    `Use a relative URL with forward slashes: ${url}`,
  );
  const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
  const filename = resolve(base, pathname);
  const local = relative(root, filename);
  assert(
    !isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`),
    `Path leaves the site: ${url}`,
  );
  const name = local.split(sep).join('/');
  assert(isPublic(name), `Resource is not published by the build: ${name}`);
  if (!checkedFiles.has(filename)) {
    let parent = root;
    for (const part of local.split(sep)) {
      if (!directoryEntries.has(parent))
        directoryEntries.set(parent, await readdir(parent, { withFileTypes: true }));
      const entry = directoryEntries.get(parent).find((item) => item.name === part);
      assert(entry, `Missing file or incorrect filename case: ${name}`);
      assert(!entry.isSymbolicLink(), `Published resources must not be symbolic links: ${name}`);
      parent = resolve(parent, part);
    }
    const info = await lstat(filename);
    assert(info.isFile() && info.size > 0, `Resource must be a nonempty regular file: ${name}`);
    checkedFiles.set(filename, info);
  }
  return filename;
}
for (const name of publicFiles) await localFile(name);

const browserModules = publicFiles.filter((name) => name.endsWith('.js'));
const syntaxFiles = browserModules.map((name) => resolve(root, name));
async function collectScripts(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectScripts(filename);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) syntaxFiles.push(filename);
  }
}
if (!built) await collectScripts(resolve(sourceRoot, 'scripts'));
await Promise.all(syntaxFiles.map((filename) => run(process.execPath, ['--check', filename])));
let importCount = 0;
for (const moduleName of browserModules) {
  const filename = resolve(root, moduleName);
  const text = await readFile(filename, 'utf8');
  const staticImports = [
    ...text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\w$*{}\s,]+\s+from\s*)?['"]([^'"]+)['"]/g),
  ];
  const dynamicImports = [...text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)];
  for (const match of [...staticImports, ...dynamicImports]) {
    assert(
      match[1].startsWith('./') || match[1].startsWith('../'),
      `Browser imports must be local relative modules: ${moduleName} → ${match[1]}`,
    );
    const imported = await localFile(match[1], dirname(filename));
    assert(
      browserModules.includes(relative(root, imported).split(sep).join('/')),
      `Imported module must be in the public allowlist: ${match[1]}`,
    );
    importCount++;
  }
  for (const match of text.matchAll(/\b(?:src|href)=["']([^"'<>]+)["']/g)) {
    const url = match[1];
    if (url.includes('${') || url.startsWith('#') || /^(?:https?:|data:)/.test(url)) continue;
    assert(url.startsWith('./'), `Use a relative asset URL in ${moduleName}: ${url}`);
    await localFile(url);
  }
}

const [storedHTML, css, provenanceText] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'styles.css'), 'utf8'),
  readFile(await localFile('assets/provenance.json'), 'utf8'),
]);

const { benchmarks, gallery, coherenceExamples } = await import(
  pathToFileURL(resolve(root, 'data.js')).href
);
const { faceSampleLabels, faceMatrixMarkup } = await import(
  pathToFileURL(resolve(root, 'render.js')).href
);
const defaults = renderDefaultBlocks();
const renderedHTML = renderIndex(storedHTML, defaults);
if (!buildInput)
  assert.equal(
    storedHTML,
    renderedHTML,
    'Static defaults are stale. Run npm run render, then npm run check.',
  );
const html = buildInput ? renderedHTML : storedHTML;
const document = parseHTML(html);
const inner = (element) => html.slice(element.openEnd, element.closeStart);
const descendants = (id, predicate) => {
  const container = elementByID(document, id);
  return document.elements.filter(
    (element) => hasAncestor(element, (parent) => parent === container) && predicate(element),
  );
};
const controls = document.elements.filter(isJSControl);
assert(controls.length > 0, 'The page includes disabled JS-only controls.');
for (const element of controls)
  assert(
    element.attributes.has('disabled') && element.attributes.has('data-js-control'),
    `JS-only ${element.tag} must be disabled until the app mounts.`,
  );
for (const [id, value] of Object.entries(defaults.text)) {
  const element = elementByID(document, id);
  const markerStart = `MUNITE:text:${id}:start`,
    markerEnd = `MUNITE:text:${id}:end`;
  const start = document.comments.find((comment) => comment.text === markerStart),
    end = document.comments.find((comment) => comment.text === markerEnd);
  assert(
    start?.parent === element && end?.parent === element,
    `Missing static text markers: ${id}`,
  );
  assert.equal(
    html.slice(start.end, end.start),
    escapeHTML(value),
    `Static text does not match the shared renderer: ${id}`,
  );
}
for (const [id, attributes] of Object.entries(defaults.attributes))
  for (const [name, value] of Object.entries(attributes))
    assert.equal(
      attributeValue(elementByID(document, id), name),
      String(value),
      `Static ${id} attribute ${name} must match the renderer.`,
    );
for (const id of ['inference-drawing', 'training-drawing'])
  assert(
    descendants(id, (element) => element.tag === 'svg').length >= 2,
    `${id} requires complete responsive SVG content.`,
  );
assert.equal(
  descendants(
    'proposition-drawing',
    (element) => element.tag === 'svg' && attributeValue(element, 'role') === 'img',
  ).length,
  4,
  'Proposition 1 contains accessible conditional-mean, residual and gradient equations.',
);
const polyPanels = descendants('poly-comparison', (element) =>
  element.attributes.has('data-poly-scene'),
);
assert.deepEqual(
  polyPanels.map((element) => attributeValue(element, 'data-poly-scene')),
  ['quadrant', 'digit'],
  'Both separate PolyMNIST experiments must be visible in source.',
);
for (const panel of polyPanels) {
  const route = attributeValue(panel, 'data-poly-scene'),
    example = coherenceExamples[route];
  const within = (predicate) =>
    document.elements.filter(
      (element) => hasAncestor(element, (parent) => parent === panel) && predicate(element),
    );
  assert.equal(
    within((element) => hasClass(element, 'image-zoom')).length,
    6,
    'Each PolyMNIST condition shows two methods and three views.',
  );
  assert.equal(
    within(
      (element) =>
        hasClass(element, 'chance-reference') &&
        attributeValue(element, 'style') === `left:${example.chance * 100}%`,
    ).length,
    1,
    'Each PolyMNIST panel keeps its own independent-uniform reference.',
  );
  assert(
    within((element) => hasClass(element, 'score-value')).every(
      (element, index) =>
        inner(element) === [example.muni, example.independent, example.munite][index],
    ),
    'PolyMNIST precision and ablation values match the reported data.',
  );
}
assert(
  descendants('results-table', (element) => element.tag === 'table').length === 1,
  'The complete default benchmark table must be real HTML.',
);
for (const id of ['poly-comparison', 'face-comparison', 'gallery-example']) {
  const links = descendants(
    id,
    (element) => element.tag === 'a' && hasClass(element, 'image-zoom'),
  );
  assert(
    links.length > 0 &&
      links.every((element) => attributeValue(element, 'href')?.startsWith('./assets/')),
    `${id} images require usable native links.`,
  );
}
const nativeAudio = descendants('gallery-example', (element) => element.tag === 'audio');
assert.equal(
  nativeAudio.length,
  20,
  'All twenty gallery samples have a native audio player without JavaScript.',
);
assert(
  nativeAudio.every(
    (element) =>
      element.attributes.has('controls') && attributeValue(element, 'preload') === 'none',
  ),
  'Each static player stays playable and waits for playback.',
);
const bands = descendants('gallery-example', (element) =>
  element.attributes.has('data-gallery-route'),
);
assert.deepEqual(
  bands.map((element) => attributeValue(element, 'data-gallery-route')),
  ['unconditional', 'text', 'image', 'audio'],
  'Gallery routes appear in the intended order.',
);
for (const band of bands) {
  const route = attributeValue(band, 'data-gallery-route'),
    index = defaults.defaults.gallerySamples[route],
    sample = gallery[route].samples[index];
  const inside = document.elements.filter((element) =>
    hasAncestor(element, (parent) => parent === band),
  );
  assert.equal(
    inside.filter((element) => element.attributes.has('data-gallery-sample')).length,
    5,
    'All five samples in each route are present in static HTML.',
  );
  assert.equal(
    attributeValue(
      inside.find((element) => element.tag === 'audio'),
      'src',
    ),
    `./assets/audio/A${sample.id}.wav`,
    'Each static route uses its authentic featured WAV.',
  );
  assert.deepEqual(
    inside
      .filter(
        (element) =>
          element.attributes.has('data-sample') &&
          attributeValue(element, 'aria-pressed') === 'true',
      )
      .map((element) => attributeValue(element, 'data-sample')),
    [String(index)],
    'Each route filmstrip selects its own featured sample.',
  );
}
assert(
  document.elements
    .filter((element) => hasClass(element, 'equation-viewport'))
    .every((element) => attributeValue(element, 'tabindex') === '0'),
  'The static equation needs keyboard horizontal scrolling.',
);
const faceButtons = descendants('face-sample', (element) => element.tag === 'button');
assert.deepEqual(
  faceButtons.map((element) => attributeValue(element, 'data-face')),
  Object.keys(faceSampleLabels),
  'All eight FFHQ paper rows are visible choices.',
);
assert.deepEqual(
  faceButtons
    .filter((element) => attributeValue(element, 'aria-pressed') === 'true')
    .map((element) => attributeValue(element, 'data-face')),
  [defaults.defaults.faceSample],
  'The FFHQ default matches its images and caption.',
);
for (const row of Object.keys(faceSampleLabels))
  for (const model of ['muni', 'munite'])
    for (const modality of ['rgb', 'segmentation', 'normals'])
      await localFile(`./assets/ffhq/sample-${row}-${model}-${modality}.webp`);
for (const row of Object.keys(faceSampleLabels)) {
  const matrix = parseHTML(faceMatrixMarkup(row, { nativeLinks: true }));
  const originals = matrix.elements.filter((element) => hasClass(element, 'image-zoom'));
  const overlays = matrix.elements.filter((element) => hasClass(element, 'face-overlay'));
  assert.equal(originals.length, 6, 'The original six FFHQ maps retain native image links.');
  assert.deepEqual(
    overlays.map((element) => attributeValue(element, 'data-model')),
    ['muni', 'munite'],
    'Both FFHQ models have one registered comparison.',
  );
  for (const overlay of overlays) {
    const images = matrix.elements.filter(
      (element) => element.tag === 'img' && hasAncestor(element, (parent) => parent === overlay),
    );
    assert.deepEqual(
      images.map((element) => attributeValue(element, 'data-wipe-modality')),
      ['rgb', 'segmentation', 'normals'],
      'Each comparison includes the three original modalities.',
    );
    for (const image of images) {
      const original = originals.find(
        (element) =>
          attributeValue(element, 'data-model') === attributeValue(overlay, 'data-model') &&
          attributeValue(element, 'data-modality') === attributeValue(image, 'data-wipe-modality'),
      );
      assert.equal(
        attributeValue(image, 'src'),
        attributeValue(original, 'href'),
        'Comparison layers must use the exact same sample and model maps as their original columns.',
      );
    }
  }
}
for (const button of document.elements.filter((element) =>
  element.attributes.has('data-face-pair'),
)) {
  assert(
    attributeValue(button, 'aria-label')?.startsWith(inner(button)),
    'Comparison buttons retain their visible label in their accessible name.',
  );
}
const sampleOrder = ['poly-showcase', 'ffhq-showcase', 'ita-showcase'].map(
  (id) => elementByID(document, id).start,
);
assert(
  sampleOrder.every((position, index) => index === 0 || position > sampleOrder[index - 1]),
  'Qualitative evidence is ordered PolyMNIST, FFHQ64, image–text–audio.',
);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique.');
assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'The page has one main paper title.');
assert.match(html, /name="viewport"/);
assert.match(css, /prefers-reduced-motion/);
assert(!/href="#"/.test(html), 'Coming-soon resources must not be dead links.');
// Sharing images are referenced in meta content, outside the src/href checks.
const metadata = new Map(
  [...html.matchAll(/<meta\b([^>]+)>/g)].map((match) => {
    const attributes = new Map(
      [...match[1].matchAll(/([a-z:]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1],
        attribute[2],
      ]),
    );
    return [attributes.get('property') || attributes.get('name'), attributes.get('content')];
  }),
);
const siteURL = new URL(metadata.get('og:url'));
const shareURL = new URL(metadata.get('og:image'));
assert.equal(siteURL.protocol, 'https:', 'The canonical sharing URL must use HTTPS.');
assert.equal(shareURL.origin, siteURL.origin, 'The sharing image must belong to this site.');
assert(
  shareURL.pathname.startsWith(`${siteURL.pathname}assets/`),
  'The sharing image must include the Pages project path.',
);
assert.equal(
  metadata.get('twitter:image'),
  shareURL.href,
  'Sharing cards must use the same actual image.',
);
const shareImage = await readFile(
  await localFile(shareURL.pathname.slice(siteURL.pathname.length)),
);
assert.equal(
  shareImage.subarray(0, 8).toString('hex'),
  '89504e470d0a1a0a',
  'The sharing image must be a valid PNG.',
);
assert.equal(metadata.get('og:image:type'), 'image/png');
assert.equal(Number(metadata.get('og:image:width')), shareImage.readUInt32BE(16));
assert.equal(Number(metadata.get('og:image:height')), shareImage.readUInt32BE(20));
assert(
  metadata.get('og:image:alt')?.trim() && metadata.get('twitter:image:alt')?.trim(),
  'Sharing artwork requires a description.',
);
for (const match of html.matchAll(/\b(?:src|href)="([^"<>]+)"/g)) {
  const url = match[1];
  if (url.startsWith('#')) {
    assert(ids.includes(url.slice(1)), `Missing navigation anchor: ${url}`);
    continue;
  }
  if (/^(?:https?:|data:|mailto:|tel:)/.test(url)) continue;
  assert(url.startsWith('./'), `Use a relative project-page URL: ${url}`);
  await localFile(url);
}
for (const match of css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/g)) {
  const url = match[2] ?? match[3];
  if (url.startsWith('#') || /^(?:https?:|data:)/.test(url)) continue;
  assert(url.startsWith('./'), `Use a relative CSS asset URL: ${url}`);
  await localFile(url);
}

const { metricNotes } = await import(pathToFileURL(resolve(sourceRoot, 'metric-notes.js')).href);
assert.deepEqual(
  Object.keys(metricNotes),
  Object.keys(benchmarks),
  'Metric-note benchmark keys must have the same order as data.js.',
);
let metricCount = 0;
for (const [key, dataset] of Object.entries(benchmarks)) {
  assert.equal(
    dataset.methods.length,
    new Set(dataset.methods).size,
    `${key}: method names must be unique.`,
  );
  assert.equal(
    metricNotes[key].length,
    dataset.metrics.length,
    `${key}: every metric index requires a note.`,
  );
  for (const [index, metric] of dataset.metrics.entries()) {
    assert.equal(
      metric.values.length,
      dataset.methods.length,
      `${key}[${index}]: every value needs a method.`,
    );
    assert(
      metric.values.every(
        (value) =>
          value === null ||
          (typeof value === 'string' &&
            /^-?\d+(?:\.\d+)?$/.test(value) &&
            Number.isFinite(Number(value))),
      ),
      'Reported precision must remain in numeric strings; unsupported routes use null.',
    );
    assert(
      ['up', 'down'].includes(metric.direction),
      `${key}[${index}]: invalid evaluation direction.`,
    );
    assert(
      metric.route && metric.label,
      `${key}[${index}]: generation route and metric label are required.`,
    );
    const note = metricNotes[key][index];
    assert(typeof note === 'string' && note.trim(), `${key}[${index}]: missing metric note.`);
    const lower = note.toLowerCase();
    const requirePhrase = (phrase) =>
      assert(
        lower.includes(phrase),
        `${key}[${index}]: note no longer matches ${metric.route} / ${metric.label} (${phrase}).`,
      );
    const fidelity = /\b(?:FD|FID)$/.test(metric.label);
    if (!fidelity && metric.route.startsWith('∅')) requirePhrase('without observations');
    if (key === 'poly') {
      if (fidelity) {
        requirePhrase('verifier features');
        requirePhrase('three views');
      } else if (metric.route.endsWith('three views')) {
        requirePhrase(`unobserved ${metric.label.startsWith('Digit') ? 'digit' : 'quadrant'}`);
        requirePhrase('view pairs');
      } else if (metric.route.startsWith('∅')) {
        requirePhrase(`generated ${metric.label.startsWith('Digit') ? 'digit' : 'quadrant'} label`);
        requirePhrase('three generated views all');
      } else if (metric.route.startsWith('(Digit')) {
        for (const phrase of ['digit', 'quadrant', 'both input labels']) requirePhrase(phrase);
      } else requirePhrase(`input ${metric.route.startsWith('Digit') ? 'digit' : 'quadrant'}`);
    } else if (key === 'ffhq') {
      if (fidelity) requirePhrase('inception v3 features');
      else {
        requirePhrase('frozen verifier');
        if (metric.route.startsWith('(Age')) requirePhrase('given age and gender');
        else if (metric.route.startsWith('Age')) requirePhrase('input age bin');
        else if (metric.route.startsWith('Gender')) requirePhrase('given a gender label');
        if (metric.label.includes('segmentation')) requirePhrase('19-class pixel accuracy');
        if (metric.label.includes('normal error'))
          requirePhrase('one minus mean per-pixel cosine similarity');
        if (metric.label === 'Age coherence') requirePhrase('generated age label');
        if (metric.label === 'Gender coherence') requirePhrase('generated gender label');
        if (metric.label === 'Both-label accuracy')
          requirePhrase('both frozen verifier predictions');
      }
    } else if (key === 'ita') {
      assert(/\b100\b/.test(note), `ITA index ${index} must retain the ×100 scale.`);
      requirePhrase(metric.measure.toLowerCase());
      if (metric.observed) requirePhrase(`with ${metric.observed.toLowerCase()} observed`);
      requirePhrase('generated');
    }
    metricCount++;
  }
}

for (const route of ['digit', 'quadrant'])
  for (const method of ['muni', 'munite'])
    for (let view = 0; view < 3; view++) {
      await localFile(`assets/poly/${route}-${method}-${view}.webp`);
    }
const provenance = JSON.parse(provenanceText);
assert(Array.isArray(provenance), 'Provenance is an array of asset and authoring records.');
const provenanceByPath = new Map(provenance.map((item) => [item.path, item]));
assert.equal(provenanceByPath.size, provenance.length, 'Provenance paths must be unique.');
for (const entry of provenance) {
  await localFile(entry.path);
  for (const related of entry.related_paths ?? []) await localFile(related);
}
const audioEntries = provenance.filter((item) => item.path.startsWith('assets/audio/'));
assert(audioEntries.length > 0, 'Original qualitative audio must have provenance.');
for (const entry of audioEntries) {
  const body = await readFile(await localFile(entry.path));
  assert.equal(body.toString('ascii', 0, 4), 'RIFF', `${entry.path}: not a RIFF WAV.`);
  assert.equal(body.toString('ascii', 8, 12), 'WAVE', `${entry.path}: not a WAV waveform.`);
  assert.equal(
    createHash('sha256').update(body).digest('hex'),
    entry.sha256,
    `${entry.path}: SHA-256 does not match provenance.`,
  );
  assert.equal(
    createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex'),
    entry.git_blob_sha,
    `${entry.path}: Git blob SHA does not match the original.`,
  );
  assert(
    /^[a-f\d]{40}$/.test(entry.source_commit),
    `${entry.path}: an immutable source commit is required.`,
  );
  assert(['observed', 'generated'].includes(entry.role), `${entry.path}: audio role is required.`);
}
const sampleIDs = new Set();
const sourceRoutes = {
  unconditional: 'unconditional',
  text: 'text_to_image+audio',
  image: 'image_to_text+audio',
  audio: 'audio_to_text+image',
};
for (const [routeKey, route] of Object.entries(gallery))
  for (const sample of route.samples) {
    assert(
      Number.isInteger(sample.id) && !sampleIDs.has(sample.id),
      'Gallery sample IDs must be distinct integers.',
    );
    sampleIDs.add(sample.id);
    await localFile(`assets/multimodal/${sample.image}.webp`);
    await localFile(`assets/waveforms/A${sample.id}.svg`);
    const audioPath = `assets/audio/A${sample.id}.wav`;
    await localFile(audioPath);
    const entry = provenanceByPath.get(audioPath);
    assert(entry, `Missing audio provenance: A${sample.id}`);
    assert.equal(
      entry.role,
      sample.audioObserved ? 'observed' : 'generated',
      `A${sample.id}: observed/generated role mismatch.`,
    );
    assert.equal(entry.figure, route.figure, `A${sample.id}: figure mismatch.`);
    assert.equal(entry.route, sourceRoutes[routeKey], `A${sample.id}: generation route mismatch.`);
    assert.equal(
      entry.description,
      sample.audio,
      `A${sample.id}: preserve the source AudioSet reading aid.`,
    );
  }
const waveformRecords = await compileWaveforms(root, { check: true });
assert.equal(
  waveformRecords.length,
  audioEntries.length,
  'Every authentic WAV has a deterministic waveform.',
);
await localFile('assets/fonts/DM-Sans-OFL.txt');
await localFile('assets/fonts/Sora-OFL.txt');
const workflow = await readFile(resolve(sourceRoot, '.github/workflows/pages.yml'), 'utf8');
assert.match(
  workflow,
  /^on:\s*\r?\n\s+workflow_dispatch:/m,
  'Pages deployment must remain manually triggered.',
);
assert(
  !/^\s+(?:push|pull_request|schedule):/m.test(workflow),
  'Commits must not automatically publish this research project site.',
);
console.log(
  `Checked ${built ? 'dist' : buildInput ? 'build input (read-only)' : 'source'}: ${browserModules.length} browser modules, ${importCount} relative imports, ${metricCount} indexed metric notes, ${sampleIDs.size} gallery WAVs, ${audioEntries.length} original audio hashes, ${Object.keys(defaults.html).length} static blocks, ${controls.length} gated controls, native audio/image fallbacks and case-sensitive paths.`,
);
