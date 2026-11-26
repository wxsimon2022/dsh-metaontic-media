import { settingsSchema } from './schemas/settings.schema.js';
import type { ConfigSnapshot } from './config-validator.js';
export function defaultConfig(): ConfigSnapshot { return { providers: [], models: [], settings: settingsSchema.parse({ schemaVersion: 1 }) }; }
