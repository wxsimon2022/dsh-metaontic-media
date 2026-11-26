import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, copyFile, readdir } from 'node:fs/promises';
import { Repository } from '../storage/atomic-json.js';
import { snapshotSchema, type ConfigSnapshot } from './config-validator.js';
import { defaultConfig } from './defaults.js';
import { configSchema } from './schema.js';
import type { Task } from '../services/task.service.js';
export interface ConfigVersion { revision: string | null; config: ConfigSnapshot }
export class ConfigManager {
  private repository: Repository<{ schemaVersion: 1; revision: string }>;
  constructor(readonly root: string) { this.repository = new Repository(join(root, 'config')); }
  async load(): Promise<ConfigVersion> {
    let revision: string;
    try { revision = (await this.repository.read('current')).revision; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; return { revision: null, config: defaultConfig() }; }
    if (!/^[\w-]+$/.test(revision)) throw new Error('Invalid configuration revision');
    const directory = join(this.root, 'config', 'revisions', revision);
    const read = async (name: string) => JSON.parse(await readFile(join(directory, name + '.json'), 'utf8'));
    const [providers, models, settings] = await Promise.all([read('providers'), read('models'), read('settings')]);
    if (providers.schemaVersion !== 1 || models.schemaVersion !== 1) throw new Error('Unsupported configuration schema');
    return { revision, config: snapshotSchema.parse({ providers: providers.providers, models: models.models, settings }) };
  }
  async save(input: unknown, expectedRevision: string | null): Promise<ConfigVersion> {
    const config = snapshotSchema.parse(input);
    return this.repository.lock('transaction', async () => {
      const previous = await this.load();
      if (previous.revision !== expectedRevision) throw new Error('CONFIG_INVALID: revision conflict; reload settings');
      for (const provider of config.providers) { const old = previous.config.providers.find(p => p.id === provider.id); if (old && old.baseUrl !== provider.baseUrl && provider.enabled) throw new Error('CONFIG_INVALID: address changes must first be saved disabled and revalidated'); }
      const tasks = await new Repository<Task>(join(this.root, 'tasks')).list();
      for (const mode of ['session','project']) {
        const directory = join(this.root, 'scopes', mode);
        const entries = await readdir(directory, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return []; throw e; });
        for (const entry of entries) if (entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name)) tasks.push(...await new Repository<Task>(join(directory, entry.name, 'tasks')).list());
      }
      for (const p of previous.config.providers) if (!config.providers.some(next => next.id === p.id) && tasks.some(t => t.providerId === p.id && !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(t.state))) throw new Error('CONFIG_INVALID: provider has unfinished tasks');
      const revision = randomUUID();
      const files = new Repository(join(this.root, 'config', 'revisions', revision));
      await files.write('providers', { schemaVersion: 1, providers: config.providers });
      await files.write('models', { schemaVersion: 1, models: config.models });
      await files.write('settings', config.settings);
      await this.repository.write('current', { schemaVersion: 1, revision });
      return { revision, config };
    });
  }
  async migrate(): Promise<void> {
    if ((await this.load()).revision) return;
    let old;
    try { old = configSchema.parse(JSON.parse(await readFile(join(this.root, 'config.json'), 'utf8'))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
    await copyFile(join(this.root, 'config.json'), join(this.root, `config.backup-${randomUUID()}.json`));
    const config = defaultConfig();
    config.providers = old.providers.map(p => ({ id: p.id, name: p.id, enabled: true, baseUrl: p.baseUrl, apiKeyRef: `env:${p.apiKeyEnv}`, adapters: p.adapter === 'openai-image' ? { image: 'openai-image' as const } : { video: 'newapi-video' as const }, timeoutMs: 60000, allowPrivateService: p.allowPrivateService, videoProtocol: p.protocol }));
    config.models = old.models.map(m => ({ ...m, model: m.id, name: m.id, enabled: true, capabilitySource: 'manual' as const }));
    config.settings.defaults.image.modelId = old.defaults.imageModel ?? null; config.settings.defaults.video.modelId = old.defaults.videoModel ?? null;
    config.settings.tasks = { ...config.settings.tasks, ...old.tasks }; config.settings.limits = old.limits;
    await this.save(config, null);
  }
}
