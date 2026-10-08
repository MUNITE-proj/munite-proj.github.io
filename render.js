import { benchmarks, coherenceExamples, gallery } from './data.js';
import { audioDurations } from './audio-data.js';

export const playIcon =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5 13 8 4 13.5Z"/></svg>';
export const pauseIcon =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h4v12H3zM9 2h4v12H9z"/></svg>';

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

// Shared presentation for the browser and the static HTML build. Importing
// this module does not read document/window or start a media/network request.
export const initialSelections = Object.freeze({
  benchmark: 'ita',
  faceSample: '0',
  trainingStage: 'overview',
  inferenceRegime: 'overview',
});

export function benchmarkContext(key) {
  const contexts = {
    poly: 'MUNITE has the highest joint coherence across the evaluated routes and the lowest unconditional image FD.',
    ffhq: 'MUNITE is best on all evaluated FFHQ64 metrics except conditional surface-normal error, where DFM is lower.',
    ita: 'MUNITE achieves the highest coherence in all six joint-generation comparisons.',
  };
  if (!Object.hasOwn(contexts, key)) throw new RangeError(`Unknown benchmark context: ${key}`);
  return contexts[key];
}

export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );

export function benchmarkNoteMarkup(key) {
  const notes = {
    poly: 'FD measures image quality (↓). Accuracy checks observed labels. Coherence measures agreement on unobserved labels. ∅ denotes no observations.',
    ffhq: 'FID measures RGB quality (↓). Segmentation and normal scores compare the generated maps with a frozen verifier applied to the generated RGB.',
    ita: 'CLIP: text–image · CLAP: text–audio · AIS: image–audio. Scores ×100. A dash (—) marks an unsupported setting. OmniFlow unconditional scores are from ',
  };
  if (!Object.hasOwn(notes, key)) throw new RangeError(`Unknown benchmark note: ${key}`);
  const note = escapeHTML(notes[key]);
  return key === 'ita'
    ? `${note}<a class="inline-link keep-together" href="https://muni-proj.github.io/">MUNI (Yeo et al., 2026)</a>.`
    : note;
}

function bestValue(metric) {
  const numbers = metric.values.filter((value) => value !== null).map(Number);
  return metric.direction === 'up' ? Math.max(...numbers) : Math.min(...numbers);
}

function coherenceChartMarkup(example) {
  const rows = [
    ['MUNI', example.muni],
    ['MUNITE, separate draws', example.independent],
    ['MUNITE', example.munite],
  ];
  const best = Math.max(...rows.map(([, value]) => Number(value)));
  return `<div class="score-chart"><div class="score-axis" aria-hidden="true"><span>0</span><span>0.5</span><span>1</span></div><div class="score-rows"><div class="score-grid" aria-hidden="true"><i></i><i></i><i></i><span class="chance-reference" style="left:${example.chance * 100}%"></span></div>${rows.map(([method, value]) => `<div class="score-row ${method === 'MUNITE' ? 'ours' : ''} ${Number(value) === best ? 'is-best' : ''}" style="--position:${Number(value) * 100}%"><span class="score-method">${escapeHTML(method)}</span><span class="score-track" aria-hidden="true"><span class="score-stem"></span><span class="score-point"></span></span><span class="score-value">${escapeHTML(value)}</span></div>`).join('')}</div></div>`;
}

function numericCell(value, metric, ours = false, headers = []) {
  const headerAttribute = headers.length ? ` headers="${escapeHTML(headers.join(' '))}"` : '';
  return `<td${headerAttribute} class="${value !== null && Number(value) === bestValue(metric) ? 'best' : ''} ${ours ? 'ours' : ''}">${value === null ? '—' : escapeHTML(value)}</td>`;
}

export function benchmarkTableMarkup(key) {
  const dataset = benchmarks[key];
  if (!dataset) throw new RangeError(`Unknown benchmark: ${key}`);
  const prefix = `results-${key}`;
  if (key === 'ita') {
    const initials = { image: 'I', text: 'T', audio: 'A' };
    const columns = dataset.metrics.map((metric) => {
      const { measure: name, targets: pair, observed } = metric;
      return {
        name,
        mode: `${prefix}-mode-${observed ? 'conditional' : 'unconditional'}`,
        heading: observed ? 'One-to-many' : 'Unconditional',
        label: `${observed ? `${observed} → ` : ''}${pair.map((value) => initials[value]).join(', ')}`,
        description: observed
          ? `${observed} observed, ${pair.join(' and ')} generated`
          : `Generated ${pair.join(' and ')}`,
      };
    });
    const groups = [];
    for (const column of columns) {
      if (groups.at(-1)?.mode === column.mode) groups.at(-1).count++;
      else groups.push({ mode: column.mode, heading: column.heading, count: 1 });
    }
    return `<table class="results-table ita-table"><caption>Coherence between jointly generated modalities. ↑ Higher is better. Best values are bold.</caption><colgroup span="1"></colgroup>${groups.map((group) => `<colgroup span="${group.count}"></colgroup>`).join('')}<thead><tr><th id="${prefix}-method-label" rowspan="3" scope="col">Method</th>${groups.map((group) => `<th id="${group.mode}" colspan="${group.count}" scope="colgroup">${group.heading}</th>`).join('')}</tr><tr>${columns.map((column, index) => `<th id="${prefix}-route-${index}" scope="col" headers="${columns[index].mode}" abbr="${escapeHTML(column.description)}">${column.label}</th>`).join('')}</tr><tr>${columns
      .map(
        (column, index) =>
          `<th id="${prefix}-metric-${index}" scope="col" headers="${column.mode} ${prefix}-route-${index}">${column.name} ↑</th>`,
      )
      .join(
        '',
      )}</tr></thead><tbody>${dataset.methods.map((method, index) => `<tr class="${method === 'MUNITE' ? 'ours-row' : ''}"><th id="${prefix}-method-${index}" scope="row">${escapeHTML(method)}</th>${dataset.metrics.map((metric, metricIndex) => numericCell(metric.values[index], metric, method === 'MUNITE', [`${prefix}-method-${index}`, columns[metricIndex].mode, `${prefix}-route-${metricIndex}`, `${prefix}-metric-${metricIndex}`])).join('')}</tr>`).join('')}</tbody></table>`;
  }
  const groups = [];
  for (const metric of dataset.metrics) {
    const last = groups.at(-1);
    if (last?.route === metric.route) last.metrics.push(metric);
    else groups.push({ route: metric.route, metrics: [metric] });
  }
  return `<table class="results-table"><caption>Generation quality, label accuracy and coherence. Best values are bold. ↑ Higher is better. ↓ Lower is better.</caption><thead><tr><th id="${prefix}-route-label" scope="col">Input → output</th><th id="${prefix}-metric-label" scope="col" class="metric-cell">Metric</th>${dataset.methods.map((method, index) => `<th id="${prefix}-method-${index}" scope="col" class="${method === 'MUNITE' ? 'ours' : ''}">${escapeHTML(method)}</th>`).join('')}</tr></thead>${groups
    .map(
      (group, groupIndex) =>
        `<tbody>${group.metrics
          .map((metric, index) => {
            const metricIndex = dataset.metrics.indexOf(metric);
            const routeId = `${prefix}-route-${groupIndex}`;
            const metricId = `${prefix}-metric-${metricIndex}`;
            return `<tr class="${index === 0 ? 'group-start' : ''}">${index === 0 ? `<th id="${routeId}" scope="rowgroup" rowspan="${group.metrics.length}" class="route-cell">${escapeHTML(group.route)}</th>` : ''}<th id="${metricId}" scope="row" headers="${routeId}" class="metric-cell">${escapeHTML(metric.label)}<span class="metric-direction">${metric.direction === 'up' ? '↑' : '↓'}</span></th>${metric.values.map((value, methodIndex) => numericCell(value, metric, dataset.methods[methodIndex] === 'MUNITE', [`${routeId}`, `${metricId}`, `${prefix}-method-${methodIndex}`])).join('')}</tr>`;
          })
          .join('')}</tbody>`,
    )
    .join('')}</table>`;
}

function zoomMarkup(src, alt, { nativeLink = false, model, modality, size = 192 } = {}) {
  const tag = nativeLink ? 'a' : 'button';
  const action = nativeLink ? `href="${escapeHTML(src)}"` : 'type="button"';
  return `<${tag} ${action} class="image-zoom"${model ? ` data-model="${escapeHTML(model)}"` : ''}${modality ? ` data-modality="${escapeHTML(modality)}"` : ''} aria-label="Enlarge ${escapeHTML(alt)}"><img src="${escapeHTML(src)}" width="${size}" height="${size}" loading="lazy" alt="${escapeHTML(alt)}"></${tag}>`;
}

function polyMatrixMarkup(route, { nativeLinks = false } = {}) {
  const example = coherenceExamples[route];
  if (!example) throw new RangeError(`Unknown PolyMNIST condition: ${route}`);
  return `${[0, 1, 2].map((index) => `<span class="matrix-heading">View ${index}</span>`).join('')}${['muni', 'munite'].map((model) => `<span class="matrix-model ${model === 'munite' ? 'ours' : ''}">${model.toUpperCase()}</span>${[0, 1, 2].map((view) => zoomMarkup(`./assets/poly/${route}-${model}-${view}.webp`, `${model.toUpperCase()} view ${view}, conditioned on ${example.input}`, { nativeLink: nativeLinks, model })).join('')}`).join('')}`;
}

export function polyPanelsMarkup({ nativeLinks = false } = {}) {
  return ['quadrant', 'digit']
    .map((route) => {
      const example = coherenceExamples[route];
      const caption =
        route === 'quadrant'
          ? 'The MUNITE views shown share the unobserved digit, while the MUNI views differ.'
          : 'The MUNITE views shown share the unobserved quadrant, while the MUNI views differ.';
      return `<article class="poly-result-panel" data-poly-scene="${route}" aria-labelledby="poly-${route}-heading"><h4 id="poly-${route}-heading">Observed: ${escapeHTML(example.input)}</h4><p class="poly-unobserved">Unobserved: ${escapeHTML(example.unobserved)}</p><figure aria-labelledby="poly-${route}-caption"><div class="poly-matrix">${polyMatrixMarkup(route, { nativeLinks })}</div><figcaption id="poly-${route}-caption">${caption}</figcaption></figure><div class="poly-coherence"><p class="plot-label">Coherence of the unobserved ${escapeHTML(example.unobserved)}</p>${coherenceChartMarkup(example)}<p class="plot-note">Independent-uniform chance: ${example.chance}.</p></div></article>`;
    })
    .join('');
}

export const faceSampleLabels = Object.freeze({
  '0': 'Male, 0–2',
  '1': 'Male, 10–14',
  '2': 'Female, 20–29',
  '3': 'Female, 20–29',
  '4': 'Female, 40–49',
  '5': 'Male, 40–49',
  '6': 'Male, 50–69',
  '7': 'Male, 70+',
});

export function faceChoicesMarkup(
  selected = initialSelections.faceSample,
  { disabled = false } = {},
) {
  return Object.entries(faceSampleLabels)
    .map(([row, label]) => {
      const [gender, age] = label.split(', ');
      const suffix = row === '2' ? ' (1)' : row === '3' ? ' (2)' : '';
      return `<button type="button" data-face="${row}" data-js-control aria-pressed="${String(row) === String(selected)}" aria-label="${escapeHTML(label)}${suffix}"${disabled ? ' disabled' : ''}><span>${gender}</span><span>${age}${suffix}</span></button>`;
    })
    .join('');
}

export function faceCaption(sample) {
  const row = String(sample);
  if (!faceSampleLabels[row]) throw new RangeError(`Unknown FFHQ sample: ${row}`);
  return `Sample ${Number(row) + 1} of 8 · ${faceSampleLabels[row]}`;
}

export function faceMatrixMarkup(sample, { nativeLinks = false } = {}) {
  const row = String(sample);
  const label = faceSampleLabels[row];
  if (!label) throw new RangeError(`Unknown FFHQ sample: ${row}`);
  const modalityNames = { rgb: 'RGB', segmentation: 'segmentation', normals: 'surface normals' };
  const overlay = (model) =>
    `<div class="face-overlay" data-model="${model}"><span class="face-overlay-model ${model === 'munite' ? 'ours' : ''}" aria-hidden="true">${model.toUpperCase()}</span><div class="face-wipe" role="img" aria-label="${model.toUpperCase()} modality comparison, conditioned on ${escapeHTML(label)}"><div class="face-wipe-images">${['rgb', 'segmentation', 'normals'].map((modality) => `<img src="./assets/ffhq/sample-${row}-${model}-${modality}.webp" width="192" height="192" loading="lazy" alt="" aria-hidden="true" data-wipe-modality="${modality}">`).join('')}</div><span class="face-wipe-marker" aria-hidden="true"></span></div></div>`;
  return `<div class="face-matrix sample-matrix" data-face-row="${row}"><span></span>${['RGB', 'Segmentation', 'Normals'].map((modality) => `<span class="matrix-heading">${modality}</span>`).join('')}<span class="matrix-heading face-wipe-heading">Seg. | RGB</span>${['muni', 'munite'].map((model) => `<span class="matrix-model ${model === 'munite' ? 'ours' : ''}" data-face-model="${model}">${model.toUpperCase()}</span>${['rgb', 'segmentation', 'normals'].map((modality) => zoomMarkup(`./assets/ffhq/sample-${row}-${model}-${modality}.webp`, `${model.toUpperCase()} ${modalityNames[modality]}, conditioned on ${label}`, { nativeLink: nativeLinks, model, modality })).join('')}${overlay(model)}`).join('')}</div>`;
}

function audioPlayerMarkup(sample, input, { nativeControls = false } = {}) {
  const label = `${input ? 'observed' : 'generated'} audio A${sample.id}`;
  const src = `./assets/audio/A${sample.id}.wav`;
  if (nativeControls) {
    return `<div class="audio-player audio-player-native" data-label="${escapeHTML(label)}"><audio src="${escapeHTML(src)}" controls preload="none" aria-label="${escapeHTML(label)}"><a href="${escapeHTML(src)}">Download ${escapeHTML(label)}</a></audio></div>`;
  }
  const duration = audioDurations[sample.id];
  if (!Number.isFinite(duration))
    throw new RangeError(`No verified duration for audio A${sample.id}`);
  const end = formatTime(duration);
  return `<div class="audio-player" data-label="${escapeHTML(label)}" data-duration="${duration}"><audio src="${escapeHTML(src)}" preload="none"></audio><button type="button" class="audio-play" aria-label="Play ${escapeHTML(label)}">${playIcon}</button><input type="range" class="audio-seek" min="0" max="1000" step="1" value="0" disabled aria-label="Seek ${escapeHTML(label)}"><span class="audio-time">0:00 / ${end}</span></div>`;
}

function galleryRoute(routeKey) {
  const route = gallery[routeKey];
  if (!route) throw new RangeError(`Unknown gallery route: ${routeKey}`);
  return route;
}

export function gallerySourceCaption(routeKey, index = 0) {
  const route = galleryRoute(routeKey);
  return `A${gallerySample(route, index).id} · Sample ${index + 1} of ${route.samples.length}`;
}

function gallerySample(route, index) {
  if (!Number.isInteger(index) || !route.samples[index])
    throw new RangeError(`Unknown gallery sample index: ${index}`);
  return route.samples[index];
}

function modalityLabel(name, input) {
  return `<div class="modality-label">${input ? 'Observed' : 'Generated'} ${name.toLowerCase()}</div>`;
}

function galleryExampleMarkup(
  routeKey,
  index,
  { nativeLinks = false, nativeControls = false } = {},
) {
  const route = galleryRoute(routeKey);
  const sample = gallerySample(route, index);
  const imageInput = routeKey === 'image',
    textInput = routeKey === 'text',
    audioInput = routeKey === 'audio';
  const alt = `${imageInput ? 'Observed' : 'Generated'} image A${sample.id}, paired with text: ${sample.input || sample.text}`;
  const imageMarkup = `<figure class="example-image ${imageInput ? 'is-input' : ''}">${modalityLabel('Image', imageInput)}${zoomMarkup(`./assets/multimodal/${sample.image}.webp`, alt, { nativeLink: nativeLinks, size: 320 })}</figure>`;
  const textMarkup = `<div class="example-text ${textInput ? 'is-input' : ''}">${modalityLabel('Text', textInput)}<p>“${escapeHTML(sample.input || sample.text)}”</p></div>`;
  const audioMarkup = `<figure class="example-audio ${audioInput ? 'is-input' : ''}">${modalityLabel('Audio', audioInput)}<img src="./assets/waveforms/A${sample.id}.svg" width="768" height="144" alt="" aria-hidden="true">${audioPlayerMarkup(sample, audioInput, { nativeControls })}<figcaption><span class="sound-label">Sound labels</span>${escapeHTML(sample.audio)}</figcaption></figure>`;
  return (
    textInput
      ? [textMarkup, imageMarkup, audioMarkup]
      : audioInput
        ? [audioMarkup, imageMarkup, textMarkup]
        : [imageMarkup, textMarkup, audioMarkup]
  ).join('');
}

function filmstripMarkup(routeKey, index, { disabled = false } = {}) {
  const route = galleryRoute(routeKey);
  gallerySample(route, index);
  return route.samples
    .map(
      (sample, sampleIndex) =>
        `<button type="button" data-sample="${sampleIndex}" data-js-control aria-pressed="${sampleIndex === index}"${disabled ? ' disabled' : ''} aria-label="Sample A${sample.id}: ${escapeHTML(sample.input || sample.text)}"><img src="./assets/multimodal/${sample.image}.webp" width="80" height="80" loading="lazy" alt=""><span>A${sample.id}</span></button>`,
    )
    .join('');
}

export const featuredGallerySamples = Object.freeze({
  unconditional: 0,
  text: 0,
  image: 0,
  audio: 0,
});
export function galleryBandsMarkup({ nativeLinks = false, nativeControls = false } = {}) {
  return Object.entries(featuredGallerySamples)
    .map(([key, index]) => {
      const route = galleryRoute(key);
      return `<section class="generation-band" id="sample-${key}" data-gallery-route="${key}" aria-labelledby="route-${key}-heading"><div class="figure-story gallery-story is-static"><div class="story-frame gallery-frame"><div class="generation-band-heading"><h4 id="route-${key}-heading">${escapeHTML(route.name)}</h4><p>${escapeHTML(route.description)}${key === 'image' ? ' The observed images were generated with FLUX.1.' : ''}</p></div><figure class="gallery-content"><div class="sample-filmstrip" role="group" aria-label="${escapeHTML(route.name)} samples">${filmstripMarkup(key, index, { disabled: nativeControls })}</div><div class="gallery-stage" data-gallery-slot>${route.samples.map((_, sampleIndex) => `<div class="gallery-example${sampleIndex === index ? ' is-active' : ''}" data-observed="${key}" data-gallery-sample="${sampleIndex}">${galleryExampleMarkup(key, sampleIndex, { nativeLinks, nativeControls })}<p class="gallery-sample-caption">${escapeHTML(gallerySourceCaption(key, sampleIndex))}</p></div>`).join('')}</div><figcaption class="gallery-source">${escapeHTML(gallerySourceCaption(key, index))}</figcaption></figure></div></div></section>`;
    })
    .join('');
}
