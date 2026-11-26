import { z } from 'zod';
import { defaultConfig } from '../../../config/defaults.js';
import { snapshotSchema, type ConfigSnapshot } from '../../../config/config-validator.js';
import { providerSchema } from '../../../config/schemas/provider.schema.js';
const model = z.object({ id: z.string(), name: z.string(), providerId: z.string(), model: z.string(), enabled: z.boolean().default(false), modes: z.array(z.enum(['text','image','edit','first-last-frame'])).default(['text']), aspectRatios: z.array(z.string()).default([]), resolutions: z.array(z.string()).default([]), durations: z.array(z.number()).default([]), nativeAudio: z.boolean().default(false), maxReferences: z.number().default(0), negativePrompt: z.boolean().default(false), cancellation: z.boolean().default(false), idempotency: z.boolean().default(false) });
const formSchema = z.object({ providers: z.array(z.object({ id: z.string(), name: z.string(), enabled: z.boolean().default(true), baseUrl: z.string(), apiKeyRef: z.string(), imageEnabled: z.boolean().default(true), videoEnabled: z.boolean().default(false), timeoutMs: z.number().default(60000), discoveryPath: z.string().optional(), testPath: z.string().optional(), videoProtocol: z.string().optional() })).optional(), imageModels: z.array(model).optional(), videoModels: z.array(model).optional(), defaults: z.object({ imageModelId: z.string().optional(), videoModelId: z.string().optional(), videoDuration: z.number().optional(), videoAspectRatio: z.string().optional() }).optional(), outputDir: z.string().optional() });
export function normalizeSettings(input: unknown, previous: ConfigSnapshot = defaultConfig()): ConfigSnapshot | undefined {
  const form = formSchema.parse(input);
  if (form.providers === undefined && form.imageModels === undefined && form.videoModels === undefined && form.defaults === undefined && !form.outputDir) return;
  const config = structuredClone(previous);
  if (form.providers !== undefined) config.providers = form.providers.map(p => providerSchema.parse({ id: p.id, name: p.name, enabled: p.enabled, baseUrl: p.baseUrl, apiKeyRef: p.apiKeyRef, adapters: { ...(p.imageEnabled ? { image: 'openai-image' } : {}), ...(p.videoEnabled ? { video: 'newapi-video' } : {}) }, timeoutMs: p.timeoutMs, ...(p.discoveryPath ? { discoveryPath: p.discoveryPath } : {}), ...(p.testPath ? { testPath: p.testPath } : {}), ...(p.videoProtocol?.trim() ? { videoProtocol: JSON.parse(p.videoProtocol) } : {}) }));
  for (const [type, items] of [['image',form.imageModels],['video',form.videoModels]] as const) {
    if (items === undefined) continue;
    config.models = [...config.models.filter(m => m.capabilities?.mediaType !== type), ...items.map(m => ({ id: m.id, name: m.name, providerId: m.providerId, model: m.model, enabled: m.enabled, capabilitySource: 'manual' as const, capabilities: { mediaType: type, modes: m.modes, ...(m.aspectRatios.length ? { aspectRatios: m.aspectRatios } : {}), ...(m.resolutions.length ? { resolutions: m.resolutions } : {}), ...(type === 'video' && m.durations.length ? { durations: m.durations } : {}), maxReferences: m.maxReferences, nativeAudio: type === 'video' && m.nativeAudio, negativePrompt: m.negativePrompt, cancellation: m.cancellation, idempotency: m.idempotency } }))];
  }
  if (form.defaults) {
    if (form.defaults.imageModelId !== undefined) config.settings.defaults.image.modelId = form.defaults.imageModelId || null;
    if (form.defaults.videoModelId !== undefined) config.settings.defaults.video.modelId = form.defaults.videoModelId || null;
    if (form.defaults.videoDuration !== undefined) config.settings.defaults.video.duration = form.defaults.videoDuration;
    if (form.defaults.videoAspectRatio !== undefined) config.settings.defaults.video.aspectRatio = form.defaults.videoAspectRatio || undefined;
  }
  if (form.outputDir) config.settings.storage.outputDir = form.outputDir;
  return snapshotSchema.parse(config);
}
