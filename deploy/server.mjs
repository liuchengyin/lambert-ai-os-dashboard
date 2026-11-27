import http from 'node:http';
import {pathToFileURL} from 'node:url';

const names = [
  'account-config', 'ai-analyze', 'ai-room', 'feishu-daily',
  'feishu-health', 'feishu-review', 'feishu-targets', 'link-metadata',
  'ops-links-unlock'
];
const handlers = new Map();
for (const name of names) {
  const mod = await import(new URL('../api/' + name + '.js', import.meta.url));
  const handler = typeof mod.default === 'function'
    ? mod.default : mod.default?.default;
  if (typeof handler !== 'function') throw Error('Invalid handler: ' + name);
  handlers.set('/api/' + name, handler);
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
      return res;
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/healthz' && req.method === 'GET') {
        return res.json({ok: true, service: 'lambert-api'});
      }
      const handler = handlers.get(url.pathname);
      if (!handler) return res.status(404).json({error: 'not_found'});

      req.query = Object.fromEntries(url.searchParams);
      const limit = 8 * 1024 * 1024;
      if (Number(req.headers['content-length'] || 0) > limit) {
        req.resume();
        return res.status(413).json({error: 'body_too_large'});
      }

      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) {
          res.status(413).json({error: 'body_too_large'});
          return;
        }
        chunks.push(chunk);
      }
      req.body = {};
      if (size) {
        const type = String(req.headers['content-type'] || '')
          .split(';')[0].trim().toLowerCase();
        if (type !== 'application/json') {
          return res.status(415).json({error: 'json_required'});
        }
        try {
          req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          return res.status(400).json({error: 'invalid_json'});
        }
      }

      await handler(req, res);
      if (!res.writableEnded) res.end();
    } catch {
      console.error('lambert_api_request_failed');
      if (!res.headersSent) res.status(500).json({error: 'internal_error'});
      else res.end();
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log('Lambert API listening on 127.0.0.1:' + port);
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
  }
}
