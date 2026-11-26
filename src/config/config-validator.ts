import { z } from 'zod';
import { isAbsolute, normalize } from 'node:path';
import { providerSchema } from './schemas/provider.schema.js';
import { modelSchema } from './schemas/model.schema.js';
import { settingsSchema } from './schemas/settings.schema.js';
export const snapshotSchema = z.object({ providers: z.array(providerSchema), models: z.array(modelSchema), settings: settingsSchema }).strict().superRefine((c, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  for (const key of ['providers', 'models'] as const) if (new Set(c[key].map(x => x.id)).size !== c[key].length) fail(`Duplicate ${key}`);
  for (const p of c.providers) if (new URL(p.baseUrl).protocol !== 'https:' && !(p.allowPrivateService && new URL(p.baseUrl).protocol === 'http:')) fail('HTTPS required');
  for (const m of c.models) {
    const p = c.providers.find(p => p.id === m.providerId); if (!p) { fail('Unknown provider'); continue; }
    if (m.enabled && (!p.enabled || !m.capabilities || !p.adapters[m.capabilities.mediaType])) fail('Enabled model requires enabled provider and adapter');
    if (m.enabled && m.capabilities?.mediaType === 'video' && !p.videoProtocol) fail('Video protocol must be verified and configured');
  }
  for (const type of ['image', 'video'] as const) {
    const defaults = c.settings.defaults[type]; if (!defaults.modelId) continue;
    const m = c.models.find(m => m.id === defaults.modelId);
    if (!m?.enabled || m.capabilities?.mediaType !== type) { fail('Default model must be enabled and compatible'); continue; }
    const cap = m.capabilities;
    if (defaults.duration !== undefined && !cap.durations?.includes(defaults.duration)) fail('Default duration unsupported');
    if (defaults.aspectRatio !== undefined && !cap.aspectRatios?.includes(defaults.aspectRatio)) fail('Default aspect ratio unsupported');
    if (defaults.resolution !== undefined && !cap.resolutions?.includes(defaults.resolution)) fail('Default resolution unsupported');
    if (defaults.generateAudio && !cap.nativeAudio) fail('Default audio unsupported');
  }
  const path = normalize(c.settings.storage.outputDir);
  if (isAbsolute(path) || path === '..' || path.startsWith('../')) fail('External output directory requires a separately authorized host path; use a relative directory');
});
export type ConfigSnapshot = z.infer<typeof snapshotSchema>;
