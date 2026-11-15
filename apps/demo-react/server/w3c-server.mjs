// A small in-memory server that implements the parts of the W3C Annotation Protocol the demo uses:
// container GET, create (POST), item GET, replace (PUT with If-Match) and delete (DELETE with If-Match).
// It exists so the protocol client can be exercised end to end. It is not a production store.
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4000);
const CONTAINER = `http://localhost:${PORT}/anno/`;
const MEDIA_TYPE = 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"';

/** @type {Map<string, { annotation: Record<string, unknown>, etag: string }>} */
const store = new Map();
let sequence = 0;
let revision = 0;

function headers(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, If-Match, Prefer',
    'Access-Control-Expose-Headers': 'ETag, Location, Allow',
    ...extra,
  };
}

function send(res, status, body, extra = {}) {
  if (body === undefined) {
    res.writeHead(status, headers(extra));
    res.end();
    return;
  }
  res.writeHead(status, headers({ 'Content-Type': MEDIA_TYPE, ...extra }));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function containerBody() {
  const items = [...store.values()].map((entry) => entry.annotation);
  return {
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    id: CONTAINER,
    type: ['BasicContainer', 'AnnotationCollection'],
    total: items.length,
    first: { type: 'AnnotationPage', id: `${CONTAINER}?page=1`, items },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS')
    return send(res, 204, undefined, { Allow: 'GET, POST, PUT, DELETE, OPTIONS' });

  if (url.pathname === '/anno/' && req.method === 'GET') return send(res, 200, containerBody());

  if (url.pathname === '/anno/' && req.method === 'POST') {
    const annotation = JSON.parse(await readBody(req));
    sequence += 1;
    const id = `${CONTAINER}${sequence}`;
    const saved = { ...annotation, id };
    const etag = `"v${++revision}"`;
    store.set(id, { annotation: saved, etag });
    return send(res, 201, saved, { Location: id, ETag: etag });
  }

  const match = url.pathname.match(/^\/anno\/(\d+)$/);
  if (match) {
    const id = `${CONTAINER}${match[1]}`;
    const entry = store.get(id);
    if (!entry) return send(res, 404, { error: 'not found' });

    if (req.method === 'GET') return send(res, 200, entry.annotation, { ETag: entry.etag });

    const ifMatch = req.headers['if-match'];
    if (ifMatch !== undefined && ifMatch !== entry.etag) {
      return send(res, 412, { error: 'precondition failed: the annotation changed' });
    }

    if (req.method === 'PUT') {
      const replacement = { ...JSON.parse(await readBody(req)), id };
      const etag = `"v${++revision}"`;
      store.set(id, { annotation: replacement, etag });
      return send(res, 200, replacement, { ETag: etag });
    }

    if (req.method === 'DELETE') {
      store.delete(id);
      return send(res, 204);
    }
  }

  return send(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, () => {
  console.log(`W3C annotation demo server on ${CONTAINER}`);
});
