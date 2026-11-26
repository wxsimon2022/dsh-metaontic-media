import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpMediaProvider, ModelRegistry } from '../../dist/index.js';
const capabilities = { mediaType: 'video', modes: ['text'], maxReferences: 0, nativeAudio: false, negativePrompt: false, cancellation: false, idempotency: false, durations: [5] };
const request = { requestId: 'req', model: 'video', mediaType: 'video', mode: 'text', prompt: 'cat', duration: 5, references: [] };
function provider(fetch, overrides = {}) {
  return new HttpMediaProvider({ id: 'test', baseUrl: 'https://example.com', apiKey: () => 'secret', models: { video: capabilities }, protocol: { submitPath: '/submit', queryPath: id => `/tasks/${encodeURIComponent(id)}`, encode: r => ({ prompt: r.prompt }), decode: r => r }, fetch, ...overrides });
}
test('registry validates before HTTP and returns isolated capabilities', async () => {
  let calls = 0;
  const adapter = provider(async () => { calls++; return Response.json({ state: 'running', remoteId: 'r' }); });
  const registry = new ModelRegistry(); registry.registerProvider(adapter);
  registry.registerModel({ id: 'video', providerId: 'test', capabilities });
  registry.list()[0].capabilities.durations.push(10);
  await assert.rejects(registry.submit({ ...request, duration: 10 }));
  assert.equal(calls, 0);
  assert.equal((await registry.submit(request)).remoteId, 'r');
});
test('query uses configured path and does not submit again', async () => {
  const adapter = provider(async (url, options) => {
    assert.equal(url.pathname, '/tasks/remote%2Fid'); assert.equal(options.method, 'GET');
    return Response.json({ state: 'succeeded', outputs: [{ url: 'https://example.com/video.mp4' }] });
  });
  assert.equal((await adapter.query('remote/id')).state, 'succeeded');
});
test('HTTP errors redact upstream messages and preserve retry delay', async () => {
  const adapter = provider(async () => new Response('secret upstream details', { status: 429, headers: { 'retry-after': '2' } }));
  await assert.rejects(adapter.submit(request), error => error.code === 'RATE_LIMITED' && error.retryAfterMs === 2000 && !error.message.includes('secret'));
});
test('reject credential forwarding across origins', async () => {
  let called = false;
  const adapter = provider(async () => { called = true; }, { protocol: { submitPath: 'https://other.example/submit', encode: r => r, decode: r => r } });
  await assert.rejects(adapter.submit(request)); assert.equal(called, false);
});
