import { mathLabel } from '../generated/math.mjs';
import { colours, tint, marginal, conditional, waveform } from './common.mjs';

// An editable SVG translation of the geometry in the authors' Figure 1 TikZ.
// Contours are schematic, not measured densities or a projected embedding.
const clamp = (n) => Math.max(0, Math.min(1, n));

// Same chord-relative cubic handles and monotonically tapering width as TikZ.
function ribbon(sourceY, tipX, tipY, angle) {
  const dir = [Math.cos(angle), Math.sin(angle)],
    start = [340, sourceY];
  const base = [tipX - 30 * dir[0], tipY - 30 * dir[1]];
  const handle = 0.34 * Math.hypot(base[0] - start[0], base[1] - start[1]);
  const control1 = [start[0] + handle, sourceY];
  const control2 = [base[0] - handle * dir[0], base[1] - handle * dir[1]];
  const upper = [],
    lower = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64,
      u = 1 - t;
    const p = [0, 1].map(
      (k) =>
        u ** 3 * start[k] +
        3 * u * u * t * control1[k] +
        3 * u * t * t * control2[k] +
        t ** 3 * base[k],
    );
    const d = [0, 1].map(
      (k) =>
        3 * u * u * (control1[k] - start[k]) +
        6 * u * t * (control2[k] - control1[k]) +
        3 * t * t * (base[k] - control2[k]),
    );
    const length = Math.hypot(...d),
      half = (52 + (12 - 52) * t) / 2;
    upper.push([p[0] - (half * d[1]) / length, p[1] + (half * d[0]) / length]);
    lower.unshift([p[0] + (half * d[1]) / length, p[1] - (half * d[0]) / length]);
  }
  const points = [
    ...upper,
    [base[0] - 14 * dir[1], base[1] + 14 * dir[0]],
    [tipX, tipY],
    [base[0] + 14 * dir[1], base[1] - 14 * dir[0]],
    ...lower,
  ];
  return (
    points.map((p, i) => `${i ? 'L' : 'M'}${p.map((n) => n.toFixed(2)).join(' ')}`).join('') + 'Z'
  );
}

function ribbonCenterline(sourceY, tipX, tipY, angle) {
  const dir = [Math.cos(angle), Math.sin(angle)];
  const base = [tipX - 30 * dir[0], tipY - 30 * dir[1]];
  const handle = 0.34 * Math.hypot(base[0] - 340, base[1] - sourceY);
  return `M340 ${sourceY}C${340 + handle} ${sourceY} ${base[0] - handle * dir[0]} ${base[1] - handle * dir[1]} ${base[0]} ${base[1]}L${tipX} ${tipY}`;
}

function sourceCircle(y, index) {
  return `<g class="source-cloud" data-highlight="${index}">${[1, 0.825, 0.65, 0.475, 0.3].map((r, i) => `<circle cx="330" cy="${y}" r="${r * 44}" fill="${tint(colours[index], [0.22, 0.32, 0.46, 0.65, 0.9][i])}"/>`).join('')}</g>${mathLabel('query', 330, y + 74, { size: 24 })}`;
}
export function desktopFigureMarkup() {
  const purple = [1, 0.91, 0.82, 0.73, 0.64, 0.55, 0.46, 0.37]
    .map(
      (s, i) =>
        `<path d="${marginal}" transform="translate(782 455) scale(${310 * s} ${345 * s})" fill="${tint(colours[0], [0.06, 0.11, 0.17, 0.24, 0.31, 0.38, 0.44, 0.49][i])}"/>`,
    )
    .join('');
  const blue = [1, 0.8, 0.69, 0.58, 0.47, 0.36, 0.25, 0.14]
    .map(
      (s, i) =>
        `<path d="${conditional}" transform="translate(735 505) scale(${221 * s} ${226 * s})" fill="${['#b7d1fe', '#aecdfe', '#90c0fe', '#6fb2fe', '#4da5fe', '#2c99fe', '#1391fe', '#008cfe'][i]}"/>`,
    )
    .join('');
  return `<svg class="inference-svg inference-desktop" viewBox="0 0 1440 835" role="img" aria-labelledby="inference-title inference-desc">
      <title id="inference-title">One model, three observation regimes</title>
      <desc id="inference-desc">A single conditional flow transports Gaussian noise to the latent marginal with no observations, a conditional distribution with partial observations, or one encoded point with full observations. An image, audio and text are decoded from one shared latent sample. The densities are schematic, and the displayed outputs form one unconditional sample.</desc>
      <defs>
        ${[
          [196, 830, 266, 0],
          [442, 720, 488, 0],
          [704, 733, 575, -Math.PI / 4],
        ]
          .map(
            (p, i) =>
              `<mask id="flow-mask-${i}" maskUnits="userSpaceOnUse" x="290" y="110" width="610" height="650"><path class="flow-trace" data-flow="${i}" d="${ribbonCenterline(...p)}" fill="none" stroke="white" stroke-width="72" pathLength="1"/></mask>`,
          )
          .join('')}
        ${colours.map((c, i) => `<linearGradient id="ribbon-${i}"><stop offset="0" stop-color="${tint(c, 0.22)}"/><stop offset=".3" stop-color="${tint(c, 0.22)}"/><stop offset="1" stop-color="${i === 0 ? tint(c, 0.82) : c}"/></linearGradient>`).join('')}
        <marker id="decoder-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#667181"/></marker>
        <clipPath id="output-image-clip"><rect x="1175" y="162" width="220" height="164" rx="10"/></clipPath>
      </defs>
      <g class="latent-marginal" data-highlight="0">${purple}</g>
      <g class="latent-conditional" data-highlight="1">${blue}</g>
      <g class="evidence-ribbon" data-highlight="0"><path d="${ribbon(196, 830, 266, 0)}" fill="url(#ribbon-0)" mask="url(#flow-mask-0)"/></g>
      <g class="evidence-ribbon" data-highlight="1"><path d="${ribbon(442, 720, 488, 0)}" fill="url(#ribbon-1)" mask="url(#flow-mask-1)"/></g>
      <g class="evidence-ribbon" data-highlight="2"><path d="${ribbon(704, 733, 575, -Math.PI / 4)}" fill="url(#ribbon-2)" mask="url(#flow-mask-2)"/></g>
      ${sourceCircle(196, 0)}${sourceCircle(442, 1)}${sourceCircle(704, 2)}
      <g data-highlight="2"><circle cx="745" cy="563" r="12.5" fill="#00904d" stroke="white" stroke-width="3"/></g>
      <g class="diagram-titles"><text x="145" y="52">Conditioning</text><text x="762" y="52">Latent space</text>${mathLabel('space', 860, 52, { size: 30, anchor: 'start' })}<text x="1285" y="52">Generation</text></g>
      <text class="diagram-subtext output-context" data-decoding x="1285" y="87">Unconditional example</text>
      <g class="regime-label" data-highlight="0">${mathLabel('none', 145, 159, { size: 30 })}<text class="diagram-subtext" x="145" y="191">Unconditional</text>${mathLabel('marginal', 510, 149, { size: 30, fill: '#731efc' })}</g>
      <g class="regime-label" data-highlight="1">${mathLabel('partial', 145, 374, { size: 30 })}<text class="diagram-subtext" x="145" y="406">Partial observation</text>${mathLabel('conditional', 550, 375, { size: 30, fill: '#0053b8' })}
        <rect class="diagram-panel" x="79" y="435" width="150" height="110" rx="9"/><g fill="none" stroke="#667181" stroke-width="3.5" stroke-linejoin="round"><circle cx="184" cy="463" r="8"/><path d="M98 523 133 480 157 508 174 490 210 523Z"/></g>
      </g>
      <g class="regime-label" data-highlight="2">${mathLabel('full', 145, 657, { size: 30 })}<text class="diagram-subtext" x="145" y="689">Full observation</text>${mathLabel('point', 510, 611, { size: 30, fill: '#006735' })}
        <rect class="diagram-panel" x="22" y="729" width="78" height="76" rx="7"/><g fill="none" stroke="#667181" stroke-width="2.5" stroke-linejoin="round"><circle cx="79" cy="745" r="4"/><path d="M33 789 50 758 64 779 75 766 90 789Z"/></g>
        <rect class="diagram-panel" x="113" y="729" width="78" height="76" rx="7"/><path d="M123 767H133L138 751 145 784 152 744 159 780 165 754 172 767H181" fill="none" stroke="#667181" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <rect class="diagram-panel" x="204" y="729" width="78" height="76" rx="7"/>
        ${[746, 756, 766, 776, 786].map((y) => `<path d="M222 ${y}H264" stroke="#667181" stroke-width="3"/>`).join('')}
      </g>
      <g class="decoder-routes" data-decoding fill="none" stroke="#667181" stroke-width="2" stroke-linecap="round" marker-end="url(#decoder-arrow)">
        <path class="decoder-trace" pathLength="1" d="M998 491C1079 491 1086 245 1153 245"/><path class="decoder-trace" pathLength="1" d="M998 491H1153"/><path class="decoder-trace" pathLength="1" d="M998 491C1079 491 1086 737 1153 737"/>
      </g>
      <circle class="shared-sample" data-decoding cx="998" cy="491" r="11" fill="#536176"/>${mathLabel('sample', 998, 538, { size: 32, className: 'shared-sample-label' })}
      <g class="diagram-outputs" data-decoding>
        <text class="diagram-subtext output-name" x="1285" y="140">Image</text>
        <image href="./assets/multimodal/Im12-Im1.webp" x="1175" y="135" width="220" height="220" clip-path="url(#output-image-clip)"/><rect class="diagram-panel" x="1175" y="162" width="220" height="164" rx="10" fill="none"/>
        <text class="diagram-subtext output-name" x="1285" y="386">Audio</text><rect class="diagram-panel" x="1175" y="409" width="220" height="164" rx="10"/>${waveform(1190, 464, 190, 54)}
        <text class="diagram-subtext output-name" x="1285" y="632">Text</text><rect class="diagram-panel" x="1175" y="655" width="220" height="164" rx="10"/>
        <text class="output-text" x="1285" y="714"><tspan x="1285">“The sun sets over</tspan><tspan x="1285" dy="28">a town on</tspan><tspan x="1285" dy="28">the coast.”</tspan></text>
      </g>
    </svg>`;
}
