const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2]);
const PORT = Number(process.argv[3]);

const TYPES = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, url.replace(/^\/+/, ''));

    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('fuera de root');
    }

    // Directorio -> index.html
    if (url.endsWith('/')) {
      file = path.join(file, 'index.html');
    }

    fs.stat(file, (err, stat) => {
      if (!err && stat.isDirectory()) {
        file = path.join(file, 'index.html');
      }

      fs.readFile(file, (e, data) => {
        if (e) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 ' + url);
        }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log('static on ' + PORT + ' root ' + ROOT));
