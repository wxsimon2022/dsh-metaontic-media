import type { ConfigSnapshot } from './config-validator.js';
import type { MediaConfig } from './schema.js';
export type RuntimeConfig = MediaConfig & { upstreamModels?: Record<string, string>; sourceProviders?: Record<string, string> };
export function runtimeConfig(config: ConfigSnapshot): RuntimeConfig {
  const providers: MediaConfig['providers'] = []; const sourceProviders: Record<string,string> = {};
  for (const p of config.providers.filter(p => p.enabled)) for (const type of ['image', 'video'] as const) {
    const adapter = p.adapters[type]; if (!adapter) continue;
    const id = `${p.id}--${type}`; sourceProviders[id] = p.id;
    providers.push({ id, adapter, timeoutMs: p.timeoutMs, baseUrl: p.baseUrl, apiKeyEnv: p.apiKeyRef.slice(4), allowPrivateService: p.allowPrivateService, ...(type === 'video' ? { protocol: p.videoProtocol } : {}) });
  }
  const models = config.models.filter(m => m.enabled && m.capabilities && config.providers.some(p => p.id === m.providerId && p.enabled)).map(m => ({ id: m.id, providerId: `${m.providerId}--${m.capabilities!.mediaType}`, capabilities: m.capabilities! }));
  return { version: 1, providers, models, sourceProviders, upstreamModels: Object.fromEntries(config.models.map(m => [m.id, m.model])), defaults: { imageModel: config.settings.defaults.image.modelId ?? undefined, videoModel: config.settings.defaults.video.modelId ?? undefined, optimize: config.settings.generation.autoEnhancePrompt, confirmPaidGeneration: true }, tasks: config.settings.tasks, limits: config.settings.limits };
}
