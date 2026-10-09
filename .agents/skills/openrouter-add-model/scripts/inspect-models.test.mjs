import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectModels } from './inspect-models.mjs';

test('authenticates single-model lookups and preserves missing/null/false and aliases', async () => {
  const calls = [];
  const results = await inspectModels(['openai/nano', 'anthropic/haiku:free', 'openrouter/free', 'openai/nano'], {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ data: {
        id: url.includes('nano') ? 'openai/canonical-nano' : 'resolved/model',
        ...(url.includes('nano') ? { reasoning: { mandatory: true, supported_efforts: ['minimal'], default_effort: 'medium' } }
          : url.includes('haiku') ? { reasoning: { mandatory: false, supported_efforts: null, default_enabled: false } } : {}),
      } }) };
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, 'https://openrouter.ai/api/v1/model/anthropic/haiku%3Afree');
  for (const { options } of calls) {
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, undefined);
  }
  assert.equal(results[0].resolvedModel, 'openai/canonical-nano');
  assert.equal(results[0].reasoning.default_enabled, undefined);
  assert.equal(results[1].reasoning.supported_efforts, null);
  assert.equal(results[1].reasoning.mandatory, false);
  assert.equal(results[1].reasoning.default_enabled, false);
  assert.equal(results[2].reasoning, null);
  assert.ok(!JSON.stringify(results).includes('test-key'));
});

test('missing key and invalid model IDs fail before requests', async () => {
  const fetchImpl = () => { throw new Error('Unexpected request'); };
  await assert.rejects(inspectModels(['openai/nano'], { apiKey: '', fetchImpl }), /OPENROUTER_API_KEY/);
  for (const id of ['https://example.com', '../secret', 'openai/nano?key=secret']) {
    await assert.rejects(inspectModels([id], { apiKey: 'test-key', fetchImpl }), /author\/slug/);
  }
});

test('records failures per model without exposing provider errors or credentials', async () => {
  const statuses = [404, 401, 429, 500];
  const fetchImpl = async () => ({ ok: false, status: statuses.shift(), json: async () => { throw new Error('Must not log body'); } });
  const results = await inspectModels(['a/one', 'a/two', 'a/three', 'a/four'], { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(results.map(r => r.status), ['unavailable', 'error', 'error', 'error']);
  assert.deepEqual(results.map(r => r.httpStatus), [404, 401, 429, 500]);
  const failed = await inspectModels(['a/one'], { apiKey: 'test-key', fetchImpl: async () => { throw new Error('Bearer test-key'); } });
  assert.equal(failed[0].status, 'error');
  assert.ok(!JSON.stringify(failed).includes('test-key'));
});
