import { z } from 'zod';
import { intentSchema, creativeSchema, imagePromptSchema, videoPromptSchema } from '../../types/agent-schemas.js';
export const requestSchema = z.object({ model: z.string().default(''), mediaType: z.enum(['image', 'video']), mode: z.enum(['text', 'image', 'edit', 'first-last-frame']), prompt: z.string().min(1), negativePrompt: z.string().optional(), duration: z.number().positive().optional(), aspectRatio: z.string().optional(), resolution: z.string().optional(), generateAudio: z.boolean().optional(), references: z.array(z.object({ assetId: z.string().min(1), role: z.enum(['reference', 'first', 'last', 'mask']) })).default([]) }).strict();
export const prepareSchema = z.object({ idea: z.string().min(1), request: requestSchema.optional(), promptOnly: z.boolean().default(false), intent: intentSchema.optional(), creative: creativeSchema.optional(), imagePrompt: imagePromptSchema.optional(), videoPrompt: videoPromptSchema.optional() }).strict();
export function prepare(input: unknown) {
  const data = prepareSchema.parse(input);
  if (data.intent?.questions.length) return { data, questions: data.intent.questions };
  const duration = data.intent?.duration ?? data.request?.duration ?? data.videoPrompt?.parameters.duration;
  let previous = 0;
  for (const shot of data.videoPrompt?.shots ?? []) { if (shot.start < previous || shot.end < shot.start || duration && shot.end > duration) throw new Error('Invalid shot timeline'); previous = shot.end; }
  for (const beat of data.creative?.beats ?? []) if (beat.end < beat.start || duration && beat.end > duration) throw new Error('Invalid creative timeline');
  return { data, questions: [] };
}
