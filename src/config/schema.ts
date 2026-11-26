import { z } from 'zod';
import { readFile } from 'node:fs/promises';
export const capabilitiesSchema = z.object({
  mediaType: z.enum(['image', 'video']), modes: z.array(z.enum(['text', 'image', 'edit', 'first-last-frame'])).min(1),
  aspectRatios: z.array(z.string()).optional(), durations: z.array(z.number().positive()).optional(), resolutions: z.array(z.string()).optional(),
  maxReferences: z.number().int().nonnegative(), nativeAudio: z.boolean(), negativePrompt: z.boolean(), cancellation: z.boolean(), idempotency: z.boolean(),
});
const provider = z.object({ id: z.string().min(1), adapter: z.enum(['openai-image', 'newapi-video']), baseUrl: z.url(), apiKeyEnv: z.string().regex(/^[A-Z_][A-Z0-9_]*$/), allowPrivateService: z.boolean().default(false),
  protocol: z.object({ submitPath: z.string(), queryPath: z.string(), cancelPath: z.string().optional(), idempotencyHeader: z.string().regex(/^[A-Za-z0-9-]+$/).optional(), fields: z.record(z.string(), z.string()).default({}), states: z.record(z.string(), z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled'])), idField: z.string().default('id'), stateField: z.string().default('status'), outputsField: z.string().default('outputs') }).optional() });
export const configSchema = z.object({ version: z.literal(1), providers: z.array(provider), models: z.array(z.object({ id: z.string().min(1), providerId: z.string(), capabilities: capabilitiesSchema })),
  defaults: z.object({ imageModel: z.string().optional(), videoModel: z.string().optional(), optimize: z.boolean().default(true), confirmPaidGeneration: z.literal(true).default(true) }).default({ optimize: true, confirmPaidGeneration: true }),
  tasks: z.object({ maxConcurrent: z.number().int().min(1).max(16).default(2), pollIntervalMs: z.number().int().positive().default(5000), maxPollIntervalMs: z.number().int().positive().default(30000), pollDeadlineMs: z.number().int().positive().default(900000) }).default({ maxConcurrent: 2, pollIntervalMs: 5000, maxPollIntervalMs: 30000, pollDeadlineMs: 900000 }),
  limits: z.object({ maxDownloadBytes: z.number().int().positive().default(524288000) }).default({ maxDownloadBytes: 524288000 }),

}).superRefine((c, ctx) => {
  for (const key of ['providers', 'models'] as const) if (new Set(c[key].map(x => x.id)).size !== c[key].length) ctx.addIssue({ code: 'custom', message: `Duplicate ${key}` });
  for (const m of c.models) if (!c.providers.some(p => p.id === m.providerId)) ctx.addIssue({ code: 'custom', message: 'Unknown provider' });
  for (const id of [c.defaults.imageModel, c.defaults.videoModel]) if (id && !c.models.some(m => m.id === id)) ctx.addIssue({ code: 'custom', message: 'Unknown default model' });
  for (const p of c.providers) if (p.adapter === 'newapi-video' && !p.protocol) ctx.addIssue({ code: 'custom', message: 'Video protocol must be configured explicitly' });
});
export type MediaConfig = z.infer<typeof configSchema>;
export async function loadConfig(path: string): Promise<MediaConfig> { return configSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
