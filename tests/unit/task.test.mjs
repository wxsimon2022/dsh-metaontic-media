import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository, TaskService } from '../../dist/index.js';
for (const scenario of ['cancel', 'timeout', 'resume']) {
  test(scenario, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'media-'));
    try {
      let submissions = 0;
      const repository = new Repository(directory);
      const provider = {
        id: 'mock', capabilities: async () => ({ mediaType: 'image', modes: ['text'], maxReferences: 0, nativeAudio: false, negativePrompt: false, cancellation: false, idempotency: false }),
        submit: async () => { submissions++; if (scenario === 'timeout') throw Error('timeout'); return { state: 'running', remoteId: 'remote' }; },
        query: async () => ({ state: 'succeeded', outputs: [{ base64: 'test' }] }),
      };
      const service = new TaskService(repository, provider);
      const draft = await service.create({ requestId: 'request', model: 'mock', mediaType: 'image', mode: 'text', prompt: 'cat', references: [] });
      const result = await service.execute(draft.id, async () => scenario !== 'cancel');
      assert.equal(result.state, scenario === 'cancel' ? 'CANCELLED' : scenario === 'timeout' ? 'SUBMISSION_UNKNOWN' : 'RUNNING');
      assert.equal(submissions, scenario === 'cancel' ? 0 : 1);
      await assert.rejects(service.execute(draft.id, async () => true));
      if (scenario === 'resume') assert.equal((await new TaskService(repository, provider).resume(draft.id)).state, 'DOWNLOADING');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
