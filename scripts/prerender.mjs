import { lstat, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHTML } from '../render.js';
import { renderDefaultBlocks } from './render-defaults.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
    if (name) return named[name.toLowerCase()] ?? entity;
    const code = Number.parseInt(decimal ?? hex, decimal ? 10 : 16);
    return code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : entity;
  });
}

function tagEnd(html, start) {
  let quote = null;
  for (let cursor = start + 1; cursor < html.length; cursor++) {
    const character = html[cursor];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '>') return cursor + 1;
  }
  throw new Error(`Unclosed HTML tag at character ${start}.`);
}

function attributesFor(html, start, end, nameLength) {
  const attributes = new Map();
  let cursor = start + 1 + nameLength;
  while (cursor < end - 1) {
    while (/\s/.test(html[cursor] ?? '')) cursor++;
    if (cursor >= end - 1 || html[cursor] === '/') break;
    const attributeStart = cursor;
    while (cursor < end - 1 && !/[\s=/>]/.test(html[cursor])) cursor++;
    if (cursor === attributeStart)
      throw new Error(`Invalid HTML attribute at character ${cursor}.`);
    const originalName = html.slice(attributeStart, cursor),
      name = originalName.toLowerCase(),
      nameEnd = cursor;
    while (/\s/.test(html[cursor] ?? '')) cursor++;
    let value = '',
      attributeEnd = nameEnd;
    if (html[cursor] === '=') {
      cursor++;
      while (/\s/.test(html[cursor] ?? '')) cursor++;
      const quote = html[cursor];
      if (quote === '"' || quote === "'") {
        const valueStart = ++cursor;
        while (cursor < end - 1 && html[cursor] !== quote) cursor++;
        if (html[cursor] !== quote) throw new Error(`Unclosed attribute ${originalName}.`);
        value = html.slice(valueStart, cursor++);
      } else {
        const valueStart = cursor;
        while (cursor < end - 1 && !/[\s>]/.test(html[cursor])) cursor++;
        value = html.slice(valueStart, cursor);
      }
      attributeEnd = cursor;
    }
    if (attributes.has(name)) throw new Error(`Duplicate attribute ${originalName}.`);
    attributes.set(name, {
      name: originalName,
      value: decodeEntities(value),
      start: attributeStart,
      end: attributeEnd,
    });
  }
  return attributes;
}

/** A structural tokenizer for this authored HTML/SVG/MathML document.
 * It records balanced element boundaries, skips comments and raw script/style
 * content, and respects quoted > characters. It does not infer HTML repairs. */
export function parseHTML(html) {
  const elements = [],
    comments = [],
    stack = [];
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const close = html.indexOf('-->', start + 4);
      if (close < 0) throw new Error(`Unclosed HTML comment at character ${start}.`);
      comments.push({
        start,
        end: close + 3,
        text: html.slice(start + 4, close).trim(),
        parent: stack.at(-1) ?? null,
      });
      cursor = close + 3;
      continue;
    }
    if (html.startsWith('<![CDATA[', start)) {
      const close = html.indexOf(']]>', start + 9);
      if (close < 0) throw new Error('Unclosed CDATA section.');
      cursor = close + 3;
      continue;
    }
    if (/^<!|^<\?/.test(html.slice(start, start + 2))) {
      cursor = tagEnd(html, start);
      continue;
    }
    const closing = html.slice(start).match(/^<\/([a-z][\w:.-]*)\s*>/i);
    if (closing) {
      const element = stack.pop(),
        tag = closing[1].toLowerCase();
      if (!element || element.tag !== tag)
        throw new Error(`Unbalanced closing </${tag}> at character ${start}.`);
      element.closeStart = start;
      element.end = start + closing[0].length;
      cursor = element.end;
      continue;
    }
    const opening = html.slice(start).match(/^<([a-z][\w:.-]*)/i);
    if (!opening) {
      cursor = start + 1;
      continue;
    }
    const openEnd = tagEnd(html, start),
      tag = opening[1].toLowerCase();
    const element = {
      tag,
      start,
      openEnd,
      closeStart: openEnd,
      end: openEnd,
      parent: stack.at(-1) ?? null,
      attributes: attributesFor(html, start, openEnd, opening[1].length),
    };
    elements.push(element);
    cursor = openEnd;
    if (voidElements.has(tag) || /\/\s*>$/.test(html.slice(start, openEnd))) continue;
    if (tag === 'script' || tag === 'style') {
      const closingPattern = new RegExp(`</${tag}\\s*>`, 'gi');
      closingPattern.lastIndex = openEnd;
      const close = closingPattern.exec(html);
      if (!close) throw new Error(`Unclosed <${tag}>.`);
      element.closeStart = close.index;
      element.end = close.index + close[0].length;
      cursor = element.end;
    } else stack.push(element);
  }
  if (stack.length) throw new Error(`Unclosed <${stack.at(-1).tag}>.`);
  return { elements, comments };
}

export const attributeValue = (element, name) => element.attributes.get(name)?.value;
export const hasClass = (element, name) =>
  (attributeValue(element, 'class') ?? '').split(/\s+/).includes(name);
export function hasAncestor(element, predicate) {
  for (let parent = element.parent; parent; parent = parent.parent)
    if (predicate(parent)) return true;
  return false;
}
export function elementByID(document, id) {
  const matches = document.elements.filter((element) => attributeValue(element, 'id') === id);
  if (matches.length !== 1) throw new Error(`Expected one #${id}; found ${matches.length}.`);
  return matches[0];
}
export const isJSControl = (element) => element.attributes.has('data-js-control');

function applyEdits(html, edits) {
  const ordered = edits.sort((first, second) => second.start - first.start);
  let boundary = html.length;
  for (const edit of ordered) {
    if (edit.end > boundary || edit.start > edit.end)
      throw new Error('Overlapping HTML generation regions.');
    html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
    boundary = edit.start;
  }
  return html;
}

function modifiedOpening(html, element, updates) {
  let opening = html.slice(element.start, element.openEnd);
  const edits = [],
    additions = [];
  for (const [name, value] of updates) {
    const existing = element.attributes.get(name);
    const replacement =
      value === null ? '' : value === '' ? name : `${name}="${escapeHTML(value)}"`;
    if (existing)
      edits.push({
        start: existing.start - element.start,
        end: existing.end - element.start,
        value: replacement,
      });
    else if (replacement) additions.push(replacement);
  }
  opening = applyEdits(opening, edits);
  if (additions.length) opening = opening.replace(/(\/?\s*>)$/, ` ${additions.join(' ')}$1`);
  return opening;
}

export function renderIndex(html, blocks = renderDefaultBlocks()) {
  const document = parseHTML(html),
    contentEdits = [];
  const markers = new Set();
  for (const kind of ['html', 'text'])
    for (const [id, content] of Object.entries(blocks[kind])) {
      const element = elementByID(document, id);
      if (element.closeStart === element.openEnd && element.end === element.openEnd)
        throw new Error(`#${id} must have a closing tag.`);
      const startMarker = `MUNITE:${kind}:${id}:start`,
        endMarker = `MUNITE:${kind}:${id}:end`;
      markers.add(startMarker);
      markers.add(endMarker);
      const starts = document.comments.filter((comment) => comment.text === startMarker);
      const ends = document.comments.filter((comment) => comment.text === endMarker);
      if (starts.length || ends.length) {
        if (
          starts.length !== 1 ||
          ends.length !== 1 ||
          starts[0].parent !== element ||
          ends[0].parent !== element ||
          starts[0].end > ends[0].start
        )
          throw new Error(`Invalid generation markers for #${id}.`);
      }
      const generated = kind === 'text' ? escapeHTML(content) : content;
      const value =
        kind === 'text'
          ? `<!-- ${startMarker} -->${generated}<!-- ${endMarker} -->`
          : `\n<!-- ${startMarker} -->\n${generated}\n<!-- ${endMarker} -->\n`;
      contentEdits.push({ start: element.openEnd, end: element.closeStart, value });
    }
  for (const comment of document.comments)
    if (comment.text.startsWith('MUNITE:') && !markers.has(comment.text))
      throw new Error(`Unknown generation marker: ${comment.text}`);
  html = applyEdits(html, contentEdits);

  const generatedDocument = parseHTML(html),
    attributeEdits = new Map();
  const set = (element, name, value) => {
    if (!attributeEdits.has(element)) attributeEdits.set(element, new Map());
    attributeEdits.get(element).set(name, value === null ? null : String(value));
  };
  const addClass = (id, name) => {
    const element = elementByID(generatedDocument, id);
    const classes = new Set((attributeValue(element, 'class') ?? '').split(/\s+/).filter(Boolean));
    classes.add(name);
    set(element, 'class', [...classes].join(' '));
  };
  for (const [id, attributes] of Object.entries(blocks.attributes))
    for (const [name, value] of Object.entries(attributes))
      set(elementByID(generatedDocument, id), name, value);
  addClass('inference-story', 'is-static');
  addClass('training-story', 'is-static');
  addClass('face-story', 'is-static');
  const { defaults } = blocks;
  for (const element of generatedDocument.elements) {
    if (isJSControl(element)) {
      set(element, 'data-js-control', '');
      set(element, 'disabled', '');
    }
    if (hasClass(element, 'equation-viewport')) set(element, 'tabindex', '0');
    if (element.tag === 'button') {
      for (const [attribute, selected, aria] of [
        ['data-regime', defaults.inferenceRegime, 'aria-pressed'],
        ['data-benchmark', defaults.benchmark, 'aria-selected'],
      ])
        if (element.attributes.has(attribute)) {
          const matches = attributeValue(element, attribute) === String(selected);
          set(element, aria, matches ? 'true' : 'false');
          if (aria === 'aria-selected') set(element, 'tabindex', matches ? '0' : '-1');
        }
    }
  }
  return applyEdits(
    html,
    [...attributeEdits].map(([element, updates]) => ({
      start: element.start,
      end: element.openEnd,
      value: modifiedOpening(html, element, updates),
    })),
  );
}

async function updateSource() {
  const filename = resolve(projectRoot, 'index.html');
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || (await realpath(filename)) !== filename)
    throw new Error('Prerender only writes the regular project index.html.');
  const source = await readFile(filename, 'utf8'),
    rendered = renderIndex(source);
  if (rendered === source) {
    console.log('index.html already contains the current static defaults.');
    return;
  }
  const temporary = resolve(projectRoot, `.index-prerender-${process.pid}.tmp`);
  if (
    isAbsolute(relative(projectRoot, temporary)) ||
    relative(projectRoot, temporary).startsWith('..')
  )
    throw new Error('Temporary output must remain inside the project.');
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(rendered, 'utf8');
    await handle.close();
    await rename(temporary, filename);
  } catch (error) {
    await handle.close().catch(() => {});
    await rm(temporary, { force: true });
    throw error;
  }
  console.log('Rendered index.html from the shared diagrams, tables and qualitative samples.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2)
    throw new Error('Prerender takes no paths or options; it updates this project’s index.html.');
  await updateSource();
}
