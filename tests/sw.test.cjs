const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function setup() {
  const scope = 'https://example.test/school/';
  const handlers = {}, stores = new Map(), deleted = [], fetched = [], requests = [];
  let network = async () => new Response('network');
  let population = async () => {};
  let match = async () => undefined;
  const cache = { match: req => match(req), addAll: async reqs => { requests.push(...reqs); await population(); } };
  const context = {
    URL, Request, Response, AbortController, setTimeout, clearTimeout,
    self: { registration: { scope }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: {
      open: async key => { if (!stores.has(key)) stores.set(key, cache); return stores.get(key); },
      keys: async () => [...stores.keys()],
      delete: async key => { deleted.push(key); return stores.delete(key); },
    },
    fetch: async (req, options) => { fetched.push({ req, options }); return network(req, options); },
  };
  vm.createContext(context);
  vm.runInContext(source + '\nglobalThis.inspect = { VERSION, CACHE, CACHE_PREFIX, ASSETS, INTEGRITY };', context);
  return {
    scope, handlers, stores, deleted, fetched, requests, ...context.inspect,
    setNetwork(fn) { network = fn; }, setPopulation(fn) { population = fn; }, setMatch(fn) { match = fn; },
    lifecycle(name) { let pending; handlers[name]({ waitUntil(p) { pending = p; } }); return pending; },
    request(url = 'js/app.js', options = {}) {
      let result; handlers.fetch({ request: new Request(new URL(url, scope), options), respondWith(p) { result = p; } }); return result;
    },
  };
}

test('complete shell installs in its scoped release cache with matching hashes', async () => {
  const env = setup();
  await env.lifecycle('install');
  assert.ok(env.stores.has(env.CACHE));
  assert.match(env.CACHE, /1\.4\.0$/);
  assert.equal(env.requests.length, 16);
  for (const asset of env.ASSETS) {
    const contents = fs.readFileSync(path.join(root, asset === './' ? 'index.html' : asset));
    const hash = 'sha256-' + crypto.createHash('sha256').update(contents).digest('base64');
    assert.ok(env.INTEGRITY[asset].split(' ').includes(hash), asset);
    const req = env.requests.find(req => req.url === new URL(asset, env.scope).href);
    assert.equal(req.cache, 'reload'); assert.equal(req.integrity, env.INTEGRITY[asset]);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (!match[1].startsWith('#')) assert.ok(env.ASSETS.includes('./' + match[1]), match[1]);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  for (const icon of manifest.icons) assert.ok(env.ASSETS.includes('./' + icon.src));
});

test('install awaits writes, and failed population is cleaned up and rejected', async () => {
  const env = setup(); let finish;
  env.setPopulation(() => new Promise(resolve => { finish = resolve; }));
  let completed = false; const pending = env.lifecycle('install').then(() => { completed = true; });
  await new Promise(setImmediate); assert.equal(completed, false);
  finish(); await pending; assert.equal(completed, true);
  env.setPopulation(async () => { throw Error('integrity or cache write failed'); });
  await assert.rejects(env.lifecycle('install'), /failed/);
  assert.ok(env.deleted.includes(env.CACHE));
});

test('activation awaits owned-cache cleanup and never forces control of open clients', async () => {
  const env = setup();
  env.stores.set(env.CACHE, {});
  env.stores.set(env.CACHE_PREFIX + '1.3.0', {});
  env.stores.set('dae-shell:https://example.test/other/:1.0.0', {});
  env.stores.set('unrelated', {});
  env.stores.set('dae-1.3.2', { match: async () => new Response('legacy shell') });
  env.stores.set('dae-1.2.0', { match: async () => undefined });
  await env.lifecycle('activate');
  assert.deepEqual(env.deleted.sort(), ['dae-1.3.2', env.CACHE_PREFIX + '1.3.0'].sort());
  assert.ok(env.stores.has(env.CACHE)); assert.ok(env.stores.has('unrelated'));
  assert.doesNotMatch(source, /self\.skipWaiting\s*\(|self\.clients\.claim\s*\(/);
});

test('immutable successful cached shell wins over changed or failing network', async () => {
  const env = setup(); env.setMatch(async () => new Response('release A'));
  for (const status of [200, 404, 503]) {
    env.setNetwork(async () => new Response('release B', { status }));
    assert.equal(await (await env.request()).text(), 'release A');
  }
  env.setNetwork(async () => { throw Error('offline'); });
  assert.equal(await (await env.request()).text(), 'release A');
  assert.equal(env.fetched.length, 0);
});

test('missing shell success is integrity checked, returned and never written', async () => {
  const env = setup(); assert.equal(await (await env.request()).text(), 'network');
  assert.equal(env.fetched[0].options.integrity, env.INTEGRITY['./js/app.js']);
  assert.doesNotMatch(source, /cache\.put\s*\(/);
});

test('network failure and 5xx fall back only to successful exact cache entries', async () => {
  for (const status of [null, 500, 503, 599]) {
    const env = setup(); let reads = 0;
    env.setMatch(async () => ++reads === 1 ? undefined : new Response('fallback'));
    env.setNetwork(async () => { if (status === null) throw Error('offline'); return new Response('server error', { status }); });
    assert.equal(await (await env.request()).text(), 'fallback');
  }
  const env = setup(); env.setNetwork(async () => new Response('unavailable', { status: 503 }));
  assert.equal((await env.request()).status, 503);
  env.setMatch(async () => new Response('bad cache', { status: 503 }));
  env.setNetwork(async () => { throw Error('offline'); });
  assert.equal((await env.request()).type, 'error');
});

test('404 and other client errors are preserved; private and unknown requests bypass caching', async () => {
  const env = setup(); let reads = 0;
  env.setMatch(async () => ++reads === 1 ? undefined : new Response('should not mask 404'));
  env.setNetwork(async () => new Response('missing', { status: 404 }));
  assert.equal((await env.request()).status, 404); assert.equal(reads, 1);
  for (const url of ['generated.pdf', 'students.json', 'signature.png', 'draft.json', 'js/app.js?private=1', 'missing-route', 'https://other.test/js/app.js']) assert.equal(env.request(url), undefined);
  assert.equal(env.request('js/app.js', { method: 'POST', body: 'private medical data' }), undefined);
  assert.equal(env.request('js/app.js', { headers: { range: 'bytes=0-10' } }), undefined);
});
