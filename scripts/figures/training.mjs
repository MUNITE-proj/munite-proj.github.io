import { escapeHTML as escapeXML } from '../../render.js';
import { mathLabel } from '../generated/math.mjs';
import { trainingObjectives } from '../../figure-data.js';
/** Editable Figure 2: one 360 x 350 row grid for each jointly trained objective.
 * Ordinary arrows forward values; black slashes stop gradients.
 * Math uses compiled outlines; the emphasis controller changes no model values. */
const C = Object.freeze({
  ink: '#202124',
  edge: '#272a30',
  network: '#edf4ff',
  networkEdge: '#38639a',
  loss: '#f3f3f3',
  white: '#ffffff',
});

const attrs = (attributes) =>
  Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([key, value]) => ' ' + key + '="' + escapeXML(value) + '"')
    .join('');
const element = (name, attributes, body = '') =>
  '<' + name + attrs(attributes) + '>' + body + '</' + name + '>';
const encoder = 'inference';
const observed = (set, indexed = false) =>
  indexed
    ? set === 'S'
      ? 'contrastS'
      : 'contrastC'
    : { 'S∖{m}': 'otherInputs', 'm': 'target', 'A': 'richer', 'S': 'subset' }[set];
const representation = (set) => (set === 'S' ? 'reprS' : 'reprC');
function text(x, y, value, size = 18, mathematical = true, anchor = 'middle') {
  return mathematical
    ? mathLabel(value, x, y, { size, anchor })
    : element(
        'text',
        { x, y, 'text-anchor': anchor, fill: C.ink, 'font-size': size, class: 'training-role' },
        escapeXML(value),
      );
}
function edge(path, marker, arrow = true, extra = {}) {
  return element('path', {
    d: path,
    fill: 'none',
    stroke: C.edge,
    'stroke-width': 1.25,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    pathLength: 1,
    class: 'training-flow',
    'marker-end': arrow ? 'url(#' + marker + ')' : null,
    ...extra,
  });
}
function input(cx, cy, notation, radius = 24, size = 20) {
  return (
    element('circle', { cx, cy, r: radius, fill: C.white, stroke: C.edge, 'stroke-width': 1.1 }) +
    text(cx, cy + 6, notation, size)
  );
}
function network(x, y, width = 60, height = 42, role = '') {
  return (
    element('rect', {
      x,
      y,
      width,
      height,
      rx: 1.5,
      fill: C.network,
      stroke: C.networkEdge,
      'stroke-width': 1.15,
    }) +
    (role ? text(x + width / 2, y + 16, role, 16, false) : '') +
    text(x + width / 2, y + (role ? 37 : 28), encoder, role ? 18 : 20)
  );
}
function objective(x, y, label, width = 64, height = 40) {
  return (
    element('rect', {
      x,
      y,
      width,
      height,
      rx: 1.5,
      fill: C.loss,
      stroke: C.edge,
      'stroke-width': 1.1,
    }) + text(x + width / 2, y + 26, label, 20)
  );
}
function detach(x, y, vertical = false) {
  return element(
    'g',
    {
      class: 'training-detach',
      'data-gradient-stop': 'true',
      transform: vertical ? 'rotate(90 ' + x + ' ' + y + ')' : null,
    },
    element('path', {
      d:
        'M' +
        (x - 6) +
        ' ' +
        (y + 4) +
        'L' +
        (x - 2) +
        ' ' +
        (y - 4) +
        'M' +
        (x + 2) +
        ' ' +
        (y + 4) +
        'L' +
        (x + 6) +
        ' ' +
        (y - 4),
      fill: 'none',
      stroke: C.edge,
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
    }),
  );
}
const group = (stage, className, body) =>
  element('g', { class: className, 'data-flow-stage': stage }, body.join(''));

function reconstruction(marker) {
  return [
    group(0, 'training-inputs', [
      input(100, 56, observed('S∖{m}'), 31, 18),
      input(260, 56, observed('m'), 24, 20),
      text(25, 214, 'query', 18),
      // Conditional forward edge is retained. Slashes affect only its gradient.
      element(
        'g',
        { class: 'training-target-input-gradient' },
        edge('M260 130H100', marker, false, { 'data-conditional-input': 'm-in-S' }) +
          element('circle', { cx: 260, cy: 130, r: 1.9, fill: C.edge }) +
          detach(181, 130) +
          text(181, 119, 'membership', 15.5),
      ),
    ]),
    group(1, 'training-network', [
      edge('M100 87V184', marker),
      edge('M47 207H69', marker),
      network(70, 185, 60, 44),
    ]),
    group(2, 'training-modality-prediction', [
      edge('M100 229V275', marker),
      element('rect', {
        x: 70,
        y: 276,
        width: 60,
        height: 40,
        rx: 1.5,
        fill: C.network,
        stroke: C.networkEdge,
        'stroke-width': 1.15,
      }),
      text(100, 302, 'decoder', 21),
    ]),
    group(3, 'training-target-and-loss', [
      edge('M260 80V275', marker),
      edge('M130 296H227', marker),
      objective(228, 276, 'recLoss'),
    ]),
  ].join('');
}

function distillation(marker) {
  return [
    group(0, 'training-inputs', [
      input(75, 56, observed('A'), 24, 20),
      input(285, 56, observed('S'), 24, 20),
      text(180, 28, 'gaussian', 18),
    ]),
    group(1, 'training-rollout-and-common-state', [
      // The curved motif denotes richer-conditioned numerical flow, not a third model.
      edge('M180 39C150 48 150 80 177 111', marker),
      text(136, 70, 'euler', 15),
      text(231, 88, 'vectorField', 15.5),
      text(180, 136, 'commonState', 20),
      edge('M180 148V166', marker, false),
      detach(180, 156, true),
      edge('M180 166H95V184', marker),
      edge('M180 166H265V184', marker),
      element('circle', { cx: 180, cy: 166, r: 1.9, fill: C.edge }),
    ]),
    group(2, 'training-shared-network-predictions', [
      edge('M75 80V184', marker),
      edge('M285 80V184', marker),
      network(39, 185, 72, 44, 'Teacher'),
      network(249, 185, 72, 44, 'Student'),
      edge('M75 229V244', marker),
      edge('M285 229V244', marker),
      text(75, 262, 'teacherPrediction', 16.5),
      text(285, 262, 'studentPrediction', 16.5),
    ]),
    group(3, 'training-detached-teacher-objective', [
      edge('M75 273V295H145', marker),
      edge('M285 273V295H215', marker),
      detach(108, 295),
      objective(146, 276, 'distLoss', 68, 40),
      text(180, 335, 'nested', 16),
    ]),
  ].join('');
}

function stackedInput(cx, cy, notation, direction) {
  return (
    [2, 1]
      .map((i) =>
        element('circle', {
          cx: cx + direction * 4 * i,
          cy: cy - 4 * i,
          r: 24,
          fill: C.white,
          stroke: C.edge,
          'stroke-width': 1.1,
        }),
      )
      .join('') + input(cx, cy, notation, 24, 20)
  );
}
function stackedNetwork(x, y, direction) {
  return (
    [2, 1]
      .map((i) =>
        element('rect', {
          x: x + direction * 4 * i,
          y: y - 4 * i,
          width: 60,
          height: 44,
          rx: 1.5,
          fill: C.network,
          stroke: C.networkEdge,
          'stroke-width': 1.15,
        }),
      )
      .join('') + network(x, y, 60, 44)
  );
}
function contrastive(marker) {
  return [
    group(0, 'training-input-batches', [
      text(180, 20, 'complement', 16),
      text(180, 42, 'nonempty', 14.5),
      stackedInput(90, 56, observed('S', true), 1),
      stackedInput(270, 56, observed('C', true), -1),
      text(26, 214, 'queryS', 17),
      text(334, 214, 'queryC', 17),
    ]),
    group(1, 'training-shared-network-batches', [
      edge('M90 80V184', marker),
      edge('M270 80V184', marker),
      edge('M46 207H59', marker),
      edge('M314 207H301', marker),
      stackedNetwork(60, 185, 1),
      stackedNetwork(240, 185, -1),
    ]),
    group(2, 'training-normalized-predictions', [
      edge('M90 229V244', marker),
      edge('M270 229V244', marker),
      text(90, 267, representation('S'), 21),
      text(270, 267, representation('C'), 21),
      text(180, 267, 'unitNorm', 14.5),
    ]),
    group(3, 'training-symmetric-batch-objective', [
      edge('M90 276V296H147', marker),
      edge('M270 276V296H213', marker),
      objective(148, 276, 'conLoss'),
    ]),
  ].join('');
}

const drawings = [reconstruction, distillation, contrastive];
const metadata = [
  [
    'Reconstruction with target detaching',
    'Other observed inputs and a Gaussian query feed one shared inference network and a modality-specific decoder. The observed target also supplies the loss. Its conditional input edge, when m is in S, keeps forward values but stops reconstruction gradients through target keys and values.',
  ],
  [
    'Self-distillation at a common detached state',
    'For incomplete examples, an N-step flow conditioned on all available modalities constructs the noisy latent state. At that detached state and time, the same network predicts clean latents from the available modalities and a smaller subset. The teacher prediction is detached before the loss.',
  ],
  [
    'Symmetric contrastive alignment of complementary subsets',
    'Stacked observations and model boxes denote batch examples. Nonempty complementary S and C use independent Gaussian queries through one shared network. Flattened clean predictions are l2-normalized. Symmetric InfoNCE uses same-example positives and other batch examples as negatives.',
  ],
];

function trainingDiagramMarkup(index) {
  if (!Number.isInteger(index) || index < 0 || index >= drawings.length) {
    throw new RangeError('Training diagram index must be 0, 1, or 2.');
  }
  const id = 'training-objective-' + index + '-page';
  const marker = id + '-arrow';
  const [title, description] = metadata[index];
  return element(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 360 350',
      width: 360,
      height: 350,
      role: 'img',
      class: 'training-svg',
      'data-training-objective': index,
      'aria-labelledby': id + '-title ' + id + '-desc',
      style: 'display:block;width:100%;overflow:visible',
    },
    element('title', { id: id + '-title' }, escapeXML(title)) +
      element('desc', { id: id + '-desc' }, escapeXML(description)) +
      element(
        'defs',
        {},
        element(
          'marker',
          {
            id: marker,
            viewBox: '0 0 7 7',
            refX: 6.5,
            refY: 3.5,
            markerWidth: 6,
            markerHeight: 6,
            markerUnits: 'userSpaceOnUse',
            orient: 'auto',
          },
          element('path', { d: 'M0 0L7 3.5L0 7Z', fill: C.edge }),
        ),
      ) +
      drawings[index](marker),
  );
}

export function trainingPanelsMarkup(selected = 'overview') {
  return trainingObjectives
    .map(
      (objective, index) =>
        `<section class="training-panel" data-objective="${index}"><h3><button type="button" data-training="${index}" data-js-control aria-pressed="${String(index) === String(selected)}" aria-controls="training-drawing"><span class="panel-letter">(${String.fromCharCode(97 + index)})</span> ${objective.title}</button></h3>${trainingDiagramMarkup(index)}<p class="training-caption">${objective.caption}</p></section>`,
    )
    .join('');
}
