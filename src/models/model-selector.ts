import type { ConfigSnapshot } from '../config/config-validator.js';
import type { MediaType, Mode } from '../types/media.js';
export class ModelSelector {
  private sessions = new Map<string, Partial<Record<MediaType, string>>>();
  constructor(private config: ConfigSnapshot) {}
  setSession(sessionId: string, mediaType: MediaType, modelId: string) { this.resolve(mediaType, 'text', modelId); this.sessions.set(sessionId, { ...this.sessions.get(sessionId), [mediaType]: modelId }); }
  resolve(mediaType: MediaType, mode: Mode, explicitId?: string, sessionId?: string) {
    const id = explicitId || (sessionId ? this.sessions.get(sessionId)?.[mediaType] : undefined) || this.config.settings.defaults[mediaType].modelId;
    const candidates = this.config.models.filter(m => m.enabled && m.capabilities?.mediaType === mediaType && m.capabilities.modes.includes(mode) && this.config.providers.some(p => p.id === m.providerId && p.enabled));
    if (!id) throw new Error(`CONFIG_INVALID: choose a model: ${candidates.map(m => m.id).join(', ')}`);
    const selected = candidates.find(m => m.id === id); if (!selected) throw new Error('UNSUPPORTED_CAPABILITY: explicitly selected model is disabled or incompatible');
    return structuredClone(selected);
  }
}
