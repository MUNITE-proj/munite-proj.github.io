import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { renderIndex } from './prerender.mjs';
import { publicFiles as files } from './public-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'dist');
if (relative(root, destination) !== 'dist')
  throw new Error('Build output must remain inside the project.');
async function inspectAssets(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Pages assets must not contain symbolic links: ${relative(root, filename)}`);
    if (entry.isDirectory()) count += await inspectAssets(filename);
    else {
      if (!entry.isFile()) throw new Error(`Unsupported asset: ${relative(root, filename)}`);
      if (entry.name.toLowerCase().endsWith('.pdf'))
        throw new Error(
          `Keep the source manuscript outside public assets: ${relative(root, filename)}`,
        );
      count++;
    }
  }
  return count;
}
// Validate before replacing dist; publish only the allowlist and public assets.
for (const name of files) {
  const info = await lstat(resolve(root, name));
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error(`Missing regular public file: ${name}`);
}
const assetInfo = await lstat(resolve(root, 'assets'));
if (!assetInfo.isDirectory() || assetInfo.isSymbolicLink())
  throw new Error('Public assets must be a regular project directory.');
const assetCount = await inspectAssets(resolve(root, 'assets'));
// Render in memory: building always uses fresh defaults without changing source.
const renderedHTML = renderIndex(await readFile(resolve(root, 'index.html'), 'utf8'));
const run = promisify(execFile);
await run(process.execPath, [resolve(root, 'scripts/check.mjs'), '--build-input']);
try {
  const info = await lstat(destination);
  if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(destination)) !== destination)
    throw new Error('Build output must be the regular project dist directory.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of files) {
  if (name === 'index.html') await writeFile(resolve(destination, name), renderedHTML, 'utf8');
  else await cp(resolve(root, name), resolve(destination, name));
}
await cp(resolve(root, 'assets'), resolve(destination, 'assets'), { recursive: true });
await writeFile(resolve(destination, '.nojekyll'), '');
const entries = await readdir(destination);
if (entries.some((name) => name.toLowerCase().endsWith('.pdf')))
  throw new Error('Source PDF must not be published.');
if ((await inspectAssets(resolve(destination, 'assets'))) !== assetCount)
  throw new Error('Built assets do not match the source package.');
const html = await readFile(resolve(destination, 'index.html'), 'utf8');
if (!html.includes('./app.js'))
  throw new Error('Relative script paths are required for GitHub project pages.');
const { stdout } = await run(process.execPath, [resolve(root, 'scripts/check.mjs'), '--dist']);
console.log(stdout.trim());
console.log(
  `Built dist/ with ${files.length} public source files, ${assetCount} self-hosted assets and .nojekyll. The source PDF, scripts and maintenance documents are excluded.`,
);
