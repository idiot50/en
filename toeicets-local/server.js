// Local HTTP server for TOEIC ETS clone.
// Run: node server.js
// Then open: http://localhost:8000/
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.m4a':  'audio/mp4',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
};

const ROUTES = {
  '/':           '/index.html',
  '/tests':      '/tests.html',
  '/test':       '/test.html',
  '/grammar':    '/grammar.html',
  '/vocabulary': '/vocabulary.html',
};

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const resolved = path.normalize(path.join(root, decoded));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function sendRangeOr200(req, res, filePath, stat, mime) {
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': mime,
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }
  }
  res.writeHead(200, {
    'Content-Length': stat.size,
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let p = parsed.pathname || '/';
  if (ROUTES[p]) p = ROUTES[p];

  const filePath = safeJoin(ROOT, p);
  if (!filePath) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      console.log(`404 ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found: ' + p);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    console.log(`200 ${req.method} ${req.url}`);
    sendRangeOr200(req, res, filePath, stat, mime);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TOEIC ETS local server running at http://localhost:${PORT}/`);
  console.log(`Root: ${ROOT}`);
  console.log('Press Ctrl+C to stop.');
});
