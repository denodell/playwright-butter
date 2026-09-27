// Serves the demo apps on http://localhost:4300, after bundling the kanban app (React).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { build } from 'esbuild';

const root = join(import.meta.dirname, 'apps');
await build({
  entryPoints: [join(root, 'kanban/src/main.jsx')],
  outfile: join(root, 'kanban/dist/main.js'),
  bundle: true,
  minify: true,
  sourcemap: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
createServer(async (req, res) => {
  let path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, decodeURIComponent(path)));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(4300, () => console.log('demo apps on http://localhost:4300'));
