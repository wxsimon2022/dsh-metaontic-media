import type { MediaConfig } from '../config/schema.js';
import { MediaError } from '../shared/errors.js';
import { randomUUID, createHash } from 'node:crypto';
import type { MediaProvider, MediaRequest, ProviderResult } from '../types/media.js';
import { validateRequest } from '../providers/capabilities.js';
import { Repository } from '../storage/atomic-json.js';
export interface Task {
  binding?: { provider: MediaConfig['providers'][number]; model: MediaConfig['models'][number]; upstreamModels: Record<string, string> };
  schemaVersion: 1; id: string; request: MediaRequest;
  state: 'AWAITING_CONFIRMATION' | 'CANCELLED' | 'SUBMITTING' | 'SUBMISSION_UNKNOWN' | 'RUNNING' | 'DOWNLOADING' | 'FAILED' | 'PAUSED' | 'SUCCEEDED';
  assetIds?: string[]; error?: { code: string; message: string };
  providerId?: string; projectId?: string; attempts?: number; createdAt?: string; updatedAt?: string;
  confirmation?: { requestHash: string; confirmedAt: string; expiresAt: string; consumedAt: string; cost: 'unknown' };
  confirmedAt?: string; result?: ProviderResult;
}
export class TaskService {
  constructor(private repository: Repository<Task>, private provider: MediaProvider) {}
  async create(request: MediaRequest): Promise<Task> {
    await this.validate(request);
    const task: Task = { schemaVersion: 1, id: randomUUID(), request: structuredClone(request), state: 'AWAITING_CONFIRMATION', providerId: this.provider.id, attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.repository.write(task.id, task);
    return task;
  }
  private async validate(request: MediaRequest): Promise<void> {
    validateRequest(request, await this.provider.capabilities(request.model));
  }
  async execute(id: string, confirm: (request: MediaRequest) => Promise<boolean>): Promise<Task> {
    return this.repository.lock(id, async () => {
      const task = await this.repository.read(id);
      if (task.state !== 'AWAITING_CONFIRMATION') throw new Error('Task cannot be submitted again');
      await this.validate(task.request);
      if (!await confirm(structuredClone(task.request))) {
        task.state = 'CANCELLED'; await this.repository.write(id, task); return task;
      }
      task.confirmedAt = new Date().toISOString();
      task.confirmation = { requestHash: createHash('sha256').update(JSON.stringify(task.request)).digest('hex'), confirmedAt: task.confirmedAt, consumedAt: task.confirmedAt, expiresAt: new Date(Date.now() + 60000).toISOString(), cost: 'unknown' };
      task.attempts = (task.attempts ?? 0) + 1; task.updatedAt = task.confirmedAt; task.state = 'SUBMITTING';
      await this.repository.write(id, task);
      let result: ProviderResult;
      try { result = await this.provider.submit(structuredClone(task.request)); }
      catch (error) {
        task.state = error instanceof MediaError && ['AUTH_FAILED', 'RATE_LIMITED', 'CONTENT_REJECTED', 'UNSUPPORTED_CAPABILITY', 'CONFIG_INVALID'].includes(error.code) ? 'FAILED' : 'SUBMISSION_UNKNOWN';
        task.error = { code: error instanceof MediaError ? error.code : 'SUBMISSION_UNKNOWN', message: 'Submission failed or result is unknown; do not blindly resubmit' };
        await this.repository.write(id, task); return task;
      }
      return this.saveResult(task, result);
    });
  }
  async resume(id: string): Promise<Task> {
    return this.repository.lock(id, async () => {
      const task = await this.repository.read(id);
      if (task.state === 'SUBMITTING') {
        task.state = 'SUBMISSION_UNKNOWN'; await this.repository.write(id, task);
      }
      if (task.state !== 'RUNNING' || !task.result?.remoteId || !this.provider.query) return task;
      return this.saveResult(task, await this.provider.query(task.result.remoteId));
    });
  }
  private async saveResult(task: Task, result: ProviderResult): Promise<Task> {
    task.result = { ...result, remoteId: result.remoteId ?? task.result?.remoteId };
    task.state = result.state === 'succeeded' ? 'DOWNLOADING' : result.state === 'failed' ? 'FAILED' : result.state === 'cancelled' ? 'CANCELLED' : task.result.remoteId ? 'RUNNING' : 'SUBMISSION_UNKNOWN';
    await this.repository.write(task.id, task); return task;
  }
}
