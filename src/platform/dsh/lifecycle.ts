import { ScopeRouter, type ScopeMode } from './scope.js';
import { runtimeConfig } from '../../config/runtime.js';
import { normalizeSettings } from './settings/normalize.js';
import { ConfigManager } from '../../config/config-manager.js';
import { snapshotSchema } from '../../config/config-validator.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Application } from '../../app/bootstrap.js';
import { registerTools } from './register-tools.js';
import { registerAgents } from './register-agents.js';
import type { HostContext } from './host-bridge.js';
export const inject = ['tools'];
export function apply(ctx: HostContext, options: { dataDirectory?: string; configuration?: string; providers?: unknown[]; imageModels?: unknown[]; videoModels?: unknown[]; defaults?: unknown; outputDir?: string; scopeMode?: ScopeMode } = {}) {
  const root = options.dataDirectory?.trim() || join(homedir(), '.dsh', 'dsh-metaontic-media');
  const mode = options.scopeMode ?? 'global';
  if (!['global','project','session'].includes(mode)) throw new Error('Invalid scope mode');
  const router = new ScopeRouter(ctx, root, mode);
  const apps = new Map<string, Promise<Application>>(); let disposed = false;
  const reset = () => { for (const pending of apps.values()) void pending.then(app => app.dispose()).catch(() => {}); apps.clear(); };
  const initialize = async (dataRoot: string) => {
    const manager = new ConfigManager(root); await manager.migrate(); const current = await manager.load();
    const config = normalizeSettings(options, current.config) ?? (options.configuration?.trim() ? snapshotSchema.parse(JSON.parse(options.configuration)) : undefined);
    if (config && JSON.stringify(current.config) !== JSON.stringify(config)) await manager.save(config, current.revision);
    const managed = (await manager.load()).config;
    const app = new Application(dataRoot, runtimeConfig(managed), managed);
    if (disposed) { app.dispose(); throw new Error('Plugin disposed'); }
    return app;
  };
  const getApp = () => {
    const dataRoot = router.currentRoot();
    let pending = apps.get(dataRoot);
    if (!pending) { pending = initialize(dataRoot).catch(error => { apps.delete(dataRoot); throw error; }); apps.set(dataRoot, pending); }
    return pending;
  };
  const prompts = registerAgents(ctx); const tools = registerTools(ctx, root, getApp, reset, (exec, action) => router.run(exec, action));
  if (mode === 'global') void getApp().then(value => value.recover()).catch(() => ctx.logger?.warn?.('[dsh-metaontic-media] 请使用 media_config 配置媒体服务和模型。'));
  return () => { disposed = true; tools(); prompts(); reset(); };
}
