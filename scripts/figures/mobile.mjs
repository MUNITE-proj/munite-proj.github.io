// Mobile reflow of manuscript Figure 1. The contours remain schematic;
// only their layout changes, not the observation regimes or probability model.
import { mathLabel } from '../generated/math.mjs';
import { colours, tint, marginal, conditional, waveform } from './common.mjs';

const sources = [
  [82, 178],
  [260, 178],
  [438, 178],
];
const ribbonTips = [
  [193, 336],
  [236, 437],
  [278, 491],
];

// The same cubic, area-valued construction as the desktop/TikZ figure,
// with a downward initial tangent appropriate to the vertical composition.
function ribbon(index, angle) {
  const [sourceX, sourceY] = sources[index];
  const [tipX, tipY] = ribbonTips[index];
  const dir = [Math.cos(angle), Math.sin(angle)];
  const start = [sourceX, sourceY + 9];
  const base = [tipX - 19 * dir[0], tipY - 19 * dir[1]];
  const handle = 0.34 * Math.hypot(base[0] - start[0], base[1] - start[1]);
  const control1 = [start[0], start[1] + handle];
  const control2 = [base[0] - handle * dir[0], base[1] - handle * dir[1]];
  // The middle ribbon passes beside the latent-space heading, then returns
  // to its conditional distribution. Its two cubics share a vertical tangent.
  const segments =
    index === 1
      ? [
          [start, [260, 213], [374, 207], [374, 239]],
          [[374, 239], [374, 314], [236, 373], base],
        ]
      : [[start, control1, control2, base]];
  const upper = [],
    lower = [];
  for (let i = 0; i <= segments.length * 64; i++) {
    const segmentIndex = Math.min(segments.length - 1, Math.floor(i / 64));
    const t = (i - segmentIndex * 64) / 64,
      u = 1 - t;
    const [a, b, c, e] = segments[segmentIndex];
    const p = [0, 1].map(
      (k) => u ** 3 * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t ** 3 * e[k],
    );
    const d = [0, 1].map(
      (k) => 3 * u * u * (b[k] - a[k]) + 6 * u * t * (c[k] - b[k]) + 3 * t * t * (e[k] - c[k]),
    );
    const length = Math.hypot(...d),
      half = (30 + ((8 - 30) * i) / (segments.length * 64)) / 2;
    upper.push([p[0] - (half * d[1]) / length, p[1] + (half * d[0]) / length]);
    lower.unshift([p[0] + (half * d[1]) / length, p[1] - (half * d[0]) / length]);
  }
  const points = [
    ...upper,
    [base[0] - 10.5 * dir[1], base[1] + 10.5 * dir[0]],
    [tipX, tipY],
    [base[0] + 10.5 * dir[1], base[1] - 10.5 * dir[0]],
    ...lower,
  ];
  return (
    points.map((p, i) => `${i ? 'L' : 'M'}${p.map((n) => n.toFixed(2)).join(' ')}`).join('') + 'Z'
  );
}

function sourceCircle(index) {
  const [x, y] = sources[index];
  return `<g class="source-cloud" data-highlight="${index}">${[1, 0.825, 0.65, 0.475, 0.3].map((r, i) => `<circle cx="${x}" cy="${y}" r="${r * 24}" fill="${tint(colours[index], [0.22, 0.32, 0.46, 0.65, 0.9][i])}"/>`).join('')}</g>${mathLabel('query', x, y + 47, { size: 22 })}`;
}

export function mobileFigureMarkup() {
  const purple = [1, 0.91, 0.82, 0.73, 0.64, 0.55, 0.46, 0.37]
    .map(
      (s, i) =>
        `<path d="${marginal}" transform="translate(260 437) scale(${200 * s} ${159 * s})" fill="${tint(colours[0], [0.06, 0.11, 0.17, 0.24, 0.31, 0.38, 0.44, 0.49][i])}"/>`,
    )
    .join('');
  const blue = [1, 0.8, 0.69, 0.58, 0.47, 0.36, 0.25, 0.14]
    .map(
      (s, i) =>
        `<path d="${conditional}" transform="translate(238 451) scale(${133 * s} ${121 * s})" fill="${['#b7d1fe', '#aecdfe', '#90c0fe', '#6fb2fe', '#4da5fe', '#2c99fe', '#1391fe', '#008cfe'][i]}"/>`,
    )
    .join('');
  return `<svg class="inference-svg inference-mobile" viewBox="0 0 520 878" role="img" aria-labelledby="mobile-inference-title mobile-inference-desc">
    <title id="mobile-inference-title">One model, three observation regimes</title>
    <desc id="mobile-inference-desc">A single conditional flow transports Gaussian noise to the latent marginal with no observations, a conditional distribution with partial observations, or one encoded point with full observations. An image, audio and text are decoded from one shared latent sample. The densities are schematic, and the displayed outputs form one unconditional sample.</desc>
    <defs>
      ${colours.map((c, i) => `<linearGradient id="mobile-ribbon-${i}" gradientUnits="userSpaceOnUse" x1="${sources[i][0]}" y1="${sources[i][1] + 9}" x2="${ribbonTips[i][0]}" y2="${ribbonTips[i][1]}"><stop offset="0" stop-color="${tint(c, 0.22)}"/><stop offset=".25" stop-color="${tint(c, 0.22)}"/><stop offset="1" stop-color="${i === 0 ? tint(c, 0.82) : c}"/></linearGradient>`).join('')}
      <marker id="mobile-decoder-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#667181"/></marker>
      <clipPath id="mobile-output-image-clip"><rect x="13" y="677" width="142" height="114" rx="7"/></clipPath>
    </defs>

    <g class="latent-marginal" data-highlight="0">${purple}</g>
    <g class="latent-conditional" data-highlight="1">${blue}</g>
    <g class="evidence-ribbon" data-highlight="0"><path d="${ribbon(0, Math.PI / 6)}" fill="url(#mobile-ribbon-0)"/></g>
    <g class="evidence-ribbon" data-highlight="1"><path d="${ribbon(1, Math.PI / 2)}" fill="url(#mobile-ribbon-1)"/></g>
    <g class="evidence-ribbon" data-highlight="2"><path d="${ribbon(2, (3 * Math.PI) / 4)}" fill="url(#mobile-ribbon-2)"/></g>
    ${[0, 1, 2].map(sourceCircle).join('')}
    <g data-highlight="2"><circle cx="267" cy="502" r="8.2" fill="#00904d" stroke="white" stroke-width="2.4"/></g>

    <g class="diagram-titles mobile-titles" style="font-size:24px;font-weight:600;letter-spacing:-.35px">
      <text x="260" y="28" style="font-size:24px">Conditioning</text>
      <text x="240" y="254" style="font-size:24px">Latent space</text>${mathLabel('space', 330, 254, { size: 26, anchor: 'start' })}
    </g>
    <g class="regime-label mobile-regime-label" data-highlight="0">
      ${mathLabel('none', 82, 65, { size: 22 })}
      <text class="diagram-subtext" x="82" y="91" style="font-size:20px">Unconditional</text>
      ${mathLabel('empty', 82, 138, { size: 29, fill: '#77818d' })}
      ${mathLabel('marginal', 115, 300, { size: 28, fill: '#5b1dc0' })}
    </g>
    <g class="regime-label mobile-regime-label" data-highlight="1">
      ${mathLabel('partial', 260, 65, { size: 22 })}
      <text class="diagram-subtext" x="260" y="91" style="font-size:20px">Partial</text>
      <rect class="diagram-panel" x="226" y="107" width="68" height="41" rx="5" style="stroke-width:1.2px"/>
      <g fill="none" stroke="#667181" stroke-width="1.8" stroke-linejoin="round"><circle cx="279" cy="117" r="3"/><path d="M235 140 249 120 261 134 270 125 286 140Z"/></g>
      ${mathLabel('conditional', 152, 516, { size: 28, fill: '#003a80' })}
    </g>
    <g class="regime-label mobile-regime-label" data-highlight="2">
      ${mathLabel('full', 438, 65, { size: 22 })}
      <text class="diagram-subtext" x="438" y="91" style="font-size:20px">Full</text>
      <rect class="diagram-panel" x="384" y="111" width="34" height="34" rx="4" style="stroke-width:1.2px"/>
      <g fill="none" stroke="#667181" stroke-width="1.4" stroke-linejoin="round"><circle cx="408" cy="119" r="2"/><path d="M389 138 398 122 405 133 410 128 414 138Z"/></g>
      <rect class="diagram-panel" x="422" y="111" width="34" height="34" rx="4" style="stroke-width:1.2px"/><path d="M426 128H429L432 119 436 137 439 118 443 137 447 122 451 128H453" fill="none" stroke="#667181" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <rect class="diagram-panel" x="460" y="111" width="34" height="34" rx="4" style="stroke-width:1.2px"/>
      ${[118, 124, 130, 136].map((y) => `<path d="M467 ${y}H487" stroke="#667181" stroke-width="1.4"/>`).join('')}
      ${mathLabel('point', 352, 521, { size: 28, fill: '#006735' })}
    </g>

    <g class="mobile-decoding" transform="translate(0,36)">
    <g class="diagram-titles" style="font-size:24px;font-weight:600;letter-spacing:-.35px"><text x="29" y="605" style="font-size:24px;text-anchor:start">Generation</text></g>
    <g class="decoder-routes" fill="none" stroke="#667181" stroke-width="1.65" stroke-linecap="round" marker-end="url(#mobile-decoder-arrow)">
      <path d="M267 584C208 598 84 625 84 633V642"/>
      <path d="M267 584C267 614 260 621 260 633V642"/>
      <path d="M267 584C326 598 436 625 436 633V642"/>
    </g>
    <circle class="shared-sample" cx="267" cy="584" r="7.2" fill="#536176"/>
    ${mathLabel('sample', 285, 589, { size: 28, className: 'shared-sample-label' })}

    <g class="diagram-outputs mobile-outputs">
      <text class="diagram-subtext output-name" x="84" y="665" style="font-size:20px">Image</text>
      <image href="./assets/multimodal/Im12-Im1.webp" x="13" y="663" width="142" height="142" clip-path="url(#mobile-output-image-clip)"/>
      <rect class="diagram-panel" x="13" y="677" width="142" height="114" rx="7" style="fill:none;stroke-width:1.2px"/>
      <text class="diagram-subtext output-name" x="260" y="665" style="font-size:20px">Audio</text>
      <rect class="diagram-panel" x="189" y="677" width="142" height="114" rx="7" style="stroke-width:1.2px"/>${waveform(198, 712, 124, 44)}
      <text class="diagram-subtext output-name" x="436" y="665" style="font-size:20px">Text</text>
      <rect class="diagram-panel" x="365" y="677" width="142" height="114" rx="7" style="stroke-width:1.2px"/>
      <text class="output-text" x="436" y="701" aria-label="The sun sets over a town on the coast." style="font-size:22px;fill:#43505c"><tspan x="436">“The sun</tspan><tspan x="436" dy="23">sets over</tspan><tspan x="436" dy="23">a town on</tspan><tspan x="436" dy="23">the coast.”</tspan></text>
      <text class="diagram-subtext output-context" x="260" y="828" style="font-size:20px">Unconditional example</text>
    </g>
    </g>
  </svg>`;
}
