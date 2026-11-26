import { randomUUID } from 'node:crypto';
import type { MediaProvider, MediaRequest, ProviderResult } from '../types/media.js';
import { validateRequest } from '../models/gateway.js';
import { Repository } from '../storage/atomic-json.js';
export interface Task {
  schemaVersion: 1; id: string; request: MediaRequest;
  state: 'AWAITING_CONFIRMATION' | 'CANCELLED' | 'SUBMITTING' | 'SUBMISSION_UNKNOWN' | 'RUNNING' | 'DOWNLOADING' | 'FAILED';
  confirmedAt?: string; result?: ProviderResult;
}
export class TaskService {
  constructor(private repository: Repository<Task>, private provider: MediaProvider) {}
  async create(request: MediaRequest): Promise<Task> {
    await this.validate(request);
    const task: Task = { schemaVersion: 1, id: randomUUID(), request: structuredClone(request), state: 'AWAITING_CONFIRMATION' };
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
      task.confirmedAt = new Date().toISOString(); task.state = 'SUBMITTING';
      await this.repository.write(id, task);
      let result: ProviderResult;
      try { result = await this.provider.submit(structuredClone(task.request)); }
      catch { task.state = 'SUBMISSION_UNKNOWN'; await this.repository.write(id, task); return task; }
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
