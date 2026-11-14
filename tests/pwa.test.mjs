import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(fetch) {
  const handlers = {};
  const stored = new Map();
  const deleted = [];
  const cache = { put: async (key, value) => stored.set(key, value), match: async (key) => stored.get(key) };
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://tracker.test' }, clients: { claim: async () => {} }, addEventListener: (type, fn) => { handlers[type] = fn; } },
    fetch, URL, Request: class { constructor(url, options) { this.url = url; Object.assign(this, options); } }, Response,
    caches: { open: async () => cache, keys: async () => ['money-tracker-offline-old', 'another-app'], delete: async (key) => deleted.push(key) },
  });
  return { handlers, stored, deleted };
}
const navigation = (path, extra = {}) => ({ url: `https://tracker.test${path}`, method: 'GET', mode: 'navigate', ...extra });
async function dispatch(w, request) {
  let response;
  w.handlers.fetch({ request, respondWith: (promise) => { response = promise; } });
  return response;
}
test('offline fallback only handles same-origin GET navigation; HTTP errors stay intact', async () => {
  const w = worker(async () => { throw new TypeError('offline'); });
  w.stored.set('/offline/', new Response('generic offline'));
  assert.equal(await (await dispatch(w, navigation('/transactions/?transaction=private'))).text(), 'generic offline');
  for (const req of [navigation('/api/session'), navigation('/api'), navigation('/api/auth/callback/google'), navigation('/api/transactions', { method: 'POST' }), navigation('/chat/', { mode: 'cors' }), { ...navigation('/'), url: 'https://other.test/' }]) {
    assert.equal(await dispatch(w, req), undefined);
  }
  assert.deepEqual([...w.stored.keys()], ['/offline/']);
  const error = worker(async () => new Response('unavailable', { status: 503 }));
  assert.equal((await dispatch(error, navigation('/chat/'))).status, 503);
});
test('failed installation rejects and activation deletes only obsolete app caches', async () => {
  const w = worker(async () => new Response('not found', { status: 404 }));
  let pending;
  w.handlers.install({ waitUntil: (p) => { pending = p; } });
  await assert.rejects(pending, /could not be installed/);
  assert.equal(w.stored.size, 0);
  w.handlers.activate({ waitUntil: (p) => { pending = p; } });
  await pending;
  assert.deepEqual(w.deleted, ['money-tracker-offline-old']);
});
