// The same public surface is used by the builder, preview server and validator.
export const publicFiles = Object.freeze([
  'index.html',
  'styles.css',
  'app.js',
  'figures.js',
  'figure-data.js',
  'stories.js',
  'audio.js',
  'audio-data.js',
  'data.js',
  'render.js',
  'favicon.svg',
]);
export const isPublic = (name) =>
  publicFiles.includes(name) ||
  (name.startsWith('assets/') && !name.toLowerCase().endsWith('.pdf'));
