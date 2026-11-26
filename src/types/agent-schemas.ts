import { z } from 'zod';
const strings = z.array(z.string());
const optionalText = z.string().nullable();
const reference = z.object({ assetId: z.string(), role: z.enum(['reference', 'first', 'last', 'mask']) });
export const intentSchema = z.object({ mediaType: z.enum(['image', 'video']), action: z.enum(['generate', 'prompt']), mode: z.enum(['text', 'image', 'edit', 'first-last-frame']), idea: z.string().min(1), subjects: strings, dialogue: strings, style: optionalText, aspectRatio: optionalText, duration: z.number().positive().nullable(), resolution: optionalText, references: z.array(reference), model: optionalText, optimize: z.boolean(), constraints: strings, questions: strings, assumptions: strings });
export const creativeSchema = z.object({ title: z.string(), concept: z.string(), subjects: strings, setting: z.string(), beats: z.array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative(), visual: z.string(), action: z.string(), dialogue: z.string() })), visualStyle: z.string(), audio: z.string(), constraints: strings, warnings: strings });
const common = { prompt: z.string().min(1), negativePrompt: optionalText, referenceRoles: z.array(reference), warnings: strings };
export const imagePromptSchema = z.object({ ...common, parameters: z.object({ aspectRatio: optionalText, resolution: optionalText }) });
export const videoPromptSchema = z.object({ ...common, parameters: z.object({ duration: z.number().positive().nullable(), aspectRatio: optionalText, resolution: optionalText, generateAudio: z.boolean().nullable() }), shots: z.array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative(), visual: z.string(), camera: z.string(), dialogue: z.string(), audio: z.string() })) });
