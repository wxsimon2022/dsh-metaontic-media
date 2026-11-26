import { Repository } from '../storage/atomic-json.js';
import type { Task } from './task.service.js';
export interface Usage { schemaVersion: 1; taskId: string; providerId?: string; model: string; mediaCount: number; textTokens: null; reportedCost: number | null; estimatedCost: number | null; currency: string | null }
export class UsageService {
  constructor(private repository: Repository<Usage>) {}
  async record(task: Task) {
    const cost = task.result?.cost;
    const record: Usage = { schemaVersion: 1, taskId: task.id, providerId: task.providerId, model: task.request.model, mediaCount: task.attempts ?? 0, textTokens: null, reportedCost: cost?.source === 'reported' ? cost.amount : null, estimatedCost: cost?.source === 'estimated' ? cost.amount : null, currency: cost?.currency ?? null };
    await this.repository.write(task.id, record); return record;
  }
  list() { return this.repository.list(); }
}
