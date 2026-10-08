export const colours = ['#731efc', '#0084fe', '#00904d'];
export const tint = (hex, amount) => {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((c) => Math.round(255 + (parseInt(c, 16) - 255) * amount));
  return `rgb(${rgb.join(' ')})`;
};
export const marginal =
  'M0 -1C.48 -1.022 .88 -.69 .96 -.21C1.04 .27 .99 .74 .60 .92C.249 1.082 -.30 1.04 -.64 .84C-.98 .64 -1.03 .15 -.91 -.29C-.80 -.69 -.44 -.98 0 -1Z';
export const conditional =
  'M0 -1C.55 -1.0093 .94 -.56 1 -.03C1.06 .50 .64 .99 .09 1C-.48 1.0104 -.99 .65 -1 .09C-1.01 -.47 -.59 -.99 0 -1Z';
export function waveform(x, y, width, height) {
  return `<image href="./assets/waveforms/A13.svg" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
}
