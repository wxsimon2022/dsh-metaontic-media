import { CredentialManager } from '../config/credential-manager.js';
import { loadManagedConfig } from '../config/config-loader.js';
import { runtimeConfig, type RuntimeConfig } from '../config/runtime.js';
import type { ConfigSnapshot } from '../config/config-validator.js';
import { ModelSelector } from '../models/model-selector.js';
import type { MediaProvider } from '../types/media.js';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { type MediaConfig } from '../config/schema.js';
import { AssetService } from './asset.service.js';
import { Repository } from '../storage/atomic-json.js';
import { TaskService, type Task } from './task.service.js';
import { UsageService } from './usage.service.js';
import { Queue } from './queue.js';
import { HttpMediaProvider } from '../providers/http.js';
import { openAIImage } from '../providers/openai-image.js';
import { newAPIVideo } from '../providers/newapi-video.js';
import { ModelRegistry } from '../providers/registry.js';
import { requestSchema } from '../businesses/prompt/prepare.js';
import type { MediaRequest } from '../types/media.js';
export class Application {
  readonly usage: UsageService; readonly tasks: Repository<Task>; readonly assets: AssetService; readonly registry = new ModelRegistry();
  private providers = new Map<string, HttpMediaProvider>(); private queue: Queue;
  private controllers = new Map<string, AbortController>();
  constructor(readonly root: string, readonly config: RuntimeConfig, readonly managedConfig?: ConfigSnapshot) {
    this.usage = new UsageService(new Repository(join(root, 'usage')));
    this.tasks = new Repository(join(root, 'tasks')); this.assets = new AssetService(root, config.limits.maxDownloadBytes, undefined, managedConfig?.settings.storage.outputDir);
    this.queue = new Queue(config.tasks.maxConcurrent);
    for (const p of config.providers) this.registry.registerProvider(this.makeProvider(p, config.models.filter(m => m.providerId === p.id), config.upstreamModels ?? {}));
    for (const model of config.models) this.registry.registerModel(model);
  }
  static async load(root: string) { const loaded = await loadManagedConfig(root); return new Application(root, runtimeConfig(loaded.config), loaded.config); }
  private makeProvider(p: MediaConfig['providers'][number], models: MediaConfig['models'], upstream: Record<string, string>): MediaProvider {
    const options = { ...p, apiKey: () => new CredentialManager().resolve(`env:${p.apiKeyEnv}`), models: Object.fromEntries(models.flatMap(m => [[m.id, m.capabilities], [upstream[m.id] ?? m.id, m.capabilities]])) };
    const adapter = p.adapter === 'openai-image' ? openAIImage(options, async id => { const { asset, bytes } = await this.assets.read(id); return { bytes, mimeType: asset.mimeType, name: asset.relativePath.split('/').pop()! }; }) : newAPIVideo(options, p.protocol!, id => this.assets.dataUrl(id));
    return { id: p.id, capabilities: model => adapter.capabilities(model), submit: request => adapter.submit({ ...request, model: upstream[request.model] ?? request.model }), query: id => adapter.query(id), cancel: id => adapter.cancel(id) };
  }
  private service(task: Task) {
    const provider = task.binding ? this.makeProvider(task.binding.provider, [task.binding.model], task.binding.upstreamModels) : this.registry.resolve(task.request.model).provider;
    return new TaskService(this.tasks, provider);
  }
  async draft(request: Omit<MediaRequest, 'requestId'>) {
    let selected = request.model;
    if (this.managedConfig) selected = new ModelSelector(this.managedConfig).resolve(request.mediaType, request.mode, selected).id;
    else selected ||= (request.mediaType === 'image' ? this.config.defaults.imageModel : this.config.defaults.videoModel) ?? '';
    const defaults = this.managedConfig?.settings.defaults[request.mediaType];
    const { modelId, ...parameters } = defaults ?? { modelId: null };
    const snapshot = { ...parameters, ...requestSchema.parse(request), model: selected, requestId: randomUUID() };
    const resolved = this.registry.resolve(selected);
    const task = await new TaskService(this.tasks, resolved.provider).create(snapshot);
    task.binding = { provider: structuredClone(this.config.providers.find(p => p.id === resolved.model.providerId)!), model: resolved.model, upstreamModels: structuredClone(this.config.upstreamModels ?? {}) };
    task.providerId = this.config.sourceProviders?.[resolved.model.providerId] ?? resolved.model.providerId;
    await this.tasks.write(task.id, task); return task;
  }
  async execute(id: string, confirm: (request: MediaRequest) => Promise<boolean>) {
    return this.queue.run(async () => { const task = await this.tasks.read(id); const result = await this.service(task).execute(id, confirm); await this.usage.record(result); return this.complete(result); });
  }
  async resume(id: string) {
    return this.queue.run(async () => {
      let task = await this.tasks.read(id);
      if (task.state === 'PAUSED') { await this.tasks.lock(id, async () => { task = await this.tasks.read(id); if (task.state === 'PAUSED') { task.state = 'RUNNING'; await this.tasks.write(id, task); } }); }
      task = await this.service(task).resume(id); return this.complete(task);
    });
  }
  private async complete(task: Task): Promise<Task> {
    if (task.state !== 'DOWNLOADING' || this.managedConfig?.settings.generation.autoDownload === false) return task;
    return this.tasks.lock(task.id, async () => {
      task = await this.tasks.read(task.id); if (task.state !== 'DOWNLOADING') return task;
      const outputs = task.result?.outputs; if (!outputs?.length) throw new Error('DOWNLOAD_FAILED: missing outputs');
      task.assetIds ??= [];
      try {
        for (let i = task.assetIds.length; i < outputs.length; i++) {
          const asset = await this.assets.save(outputs[i], task.id, task.id);
          if (!asset.mimeType.startsWith(task.request.mediaType + '/')) throw new Error('DOWNLOAD_FAILED: media type mismatch');
          task.assetIds.push(asset.id); await this.tasks.write(task.id, task);
        }
        task.state = 'SUCCEEDED'; delete task.error;
      } catch { task.error = { code: 'DOWNLOAD_FAILED', message: 'Download failed; resume retries download without generating again' }; }
      await this.tasks.write(task.id, task); return task;
    });
  }
  async poll(id: string) {
    if (this.controllers.has(id)) return this.tasks.read(id);
    const controller = new AbortController(); this.controllers.set(id, controller);
    const deadline = Date.now() + this.config.tasks.pollDeadlineMs; let delay = this.config.tasks.pollIntervalMs;
    try {
      let task = await this.tasks.read(id);
      while (!controller.signal.aborted && Date.now() < deadline && ['RUNNING', 'PAUSED', 'SUBMITTING', 'DOWNLOADING'].includes(task.state)) {
        try { task = await this.resume(id); delay = this.config.tasks.pollIntervalMs; } catch { delay = Math.min(delay * 2, this.config.tasks.maxPollIntervalMs); }
        if (task.state !== 'RUNNING') return task;
        await new Promise<void>(resolve => { const timer = setTimeout(resolve, delay); controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true }); });
      }
      if (task.state === 'RUNNING') { task.state = 'PAUSED'; await this.tasks.write(id, task); }
      return task;
    } finally { this.controllers.delete(id); }
  }
  async retry(id: string) {
    const old = await this.tasks.read(id);
    if (old.state === 'DOWNLOADING' || old.state === 'RUNNING' || old.state === 'PAUSED') return this.resume(id);
    if (old.state !== 'FAILED' && old.state !== 'CANCELLED') throw new Error('Cannot safely resubmit this task');
    const { requestId, ...request } = old.request;
    return this.draft(request);
  }
  async cancel(id: string) {
    this.controllers.get(id)?.abort();
    return this.tasks.lock(id, async () => { const task = await this.tasks.read(id);
      if (task.state === 'AWAITING_CONFIRMATION') task.state = 'CANCELLED';
      else if (task.state === 'RUNNING' || task.state === 'PAUSED') {
        const { provider, model } = task.binding ? { provider: this.makeProvider(task.binding.provider, [task.binding.model], task.binding.upstreamModels), model: task.binding.model } : this.registry.resolve(task.request.model);
        if (task.result?.remoteId && model.capabilities.cancellation && provider.cancel) {
          try { await provider.cancel(task.result.remoteId); const result = await provider.query?.(task.result.remoteId); task.state = result?.state === 'cancelled' ? 'CANCELLED' : 'PAUSED'; if (result) task.result = result; }
          catch { task.state = 'PAUSED'; }
        } else task.state = 'PAUSED';
      }
      await this.tasks.write(id, task); return task;
    });
  }
  async recover() { const tasks = await this.tasks.list(); for (const task of tasks) if (['RUNNING', 'PAUSED', 'SUBMITTING', 'DOWNLOADING'].includes(task.state)) void this.poll(task.id).catch(() => {}); }
  dispose() { for (const controller of this.controllers.values()) controller.abort(); }
}
