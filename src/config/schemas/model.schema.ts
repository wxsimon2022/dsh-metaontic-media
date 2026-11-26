import { z } from 'zod';
import { capabilitiesSchema } from '../schema.js';
export const modelSchema = z.object({ id: z.string().regex(/^[\w-]+$/), name: z.string().min(1), providerId: z.string(), model: z.string().min(1), enabled: z.boolean(), capabilities: capabilitiesSchema.optional(), capabilitySource: z.enum(['manual', 'discovered', 'unknown']).default('manual') }).strict().refine(m => !m.enabled || Boolean(m.capabilities), 'Enabled model requires confirmed capabilities');
export type ModelConfig = z.infer<typeof modelSchema>;
