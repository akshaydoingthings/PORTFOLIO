const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

// Named handler — exported for Vercel, used by http.createServer locally.
const handler = (req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const directPath = path.resolve(root, relative);
  const publicPath = path.resolve(root, 'public', relative);
  const filePath = fs.existsSync(directPath) ? directPath : publicPath;
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  fs.createReadStream(filePath).pipe(res);
};

// Local dev only — Vercel invokes the exported handler directly.
if (require.main === module) {
  http.createServer(handler).listen(port, '0.0.0.0', () => console.log(`Akshay portfolio listening on 0.0.0.0:${port}`));
}

module.exports = handler;
