import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublic as publicPath } from './public-files.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = process.argv.includes('--dist') ? resolve(sourceRoot, 'dist') : sourceRoot;
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};
const server = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(
      /^\/+/,
      '',
    );
    // A project-prefix preview exercises the same relative paths used by GitHub Pages.
    for (const prefix of ['MUNITE/', 'munite-website/'])
      if (pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length);
    if (!pathname) pathname = 'index.html';
    const filename = resolve(root, pathname);
    const localPath = relative(root, filename).replace(/\\/g, '/');
    if (
      pathname.includes('\\') ||
      isAbsolute(localPath) ||
      localPath === '..' ||
      localPath.startsWith('../') ||
      !publicPath(localPath)
    )
      throw new Error('Not public');
    // Check the resolved target too, so asset aliases cannot expose local documents.
    const resolvedPath = relative(root, await realpath(filename)).replace(/\\/g, '/');
    if (
      isAbsolute(resolvedPath) ||
      resolvedPath === '..' ||
      resolvedPath.startsWith('../') ||
      !publicPath(resolvedPath)
    )
      throw new Error('Not public');
    const body = await readFile(filename);
    const type = types[extname(filename)] || 'application/octet-stream';
    const headers = {
      'Content-Type': `${type}${/^(text\/|application\/(javascript|json))/.test(type) ? '; charset=utf-8' : ''}`,
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]),
        end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
      if (start > end || start >= body.length) {
        response.writeHead(416, { 'Content-Range': `bytes */${body.length}` });
        response.end();
        return;
      }
      response.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${body.length}`,
        'Content-Length': end - start + 1,
      });
      response.end(request.method === 'HEAD' ? undefined : body.subarray(start, end + 1));
    } else {
      response.writeHead(200, { ...headers, 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    }
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    `MUNITE ${process.argv.includes('--dist') ? 'dist' : 'source'} preview: http://127.0.0.1:${server.address().port}`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
