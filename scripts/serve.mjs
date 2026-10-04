import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { root, build } from './build.mjs';
import config from '../site.config.mjs';
await build({ preview: true });
const output = resolve(root, 'dist');
const port = Number(process.env.PORT || 4173);
const base = config.basePath === '/' ? '/' : '/' + config.basePath.split('/').filter(Boolean).join('/') + '/';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.wav': 'audio/wav' };
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(base)) { res.writeHead(404); res.end('Not found'); return; }
    pathname = pathname.slice(base.length);
    let target = resolve(output, pathname || '.');
    if (target !== output && !target.startsWith(output + sep)) { res.writeHead(403); res.end(); return; }
    try { if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html'); }
    catch { target = resolve(output, '404.html'); res.statusCode = 404; }
    const data = await readFile(target);
    res.setHeader('Content-Type', types[extname(target)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}${base}games/memory/`));
