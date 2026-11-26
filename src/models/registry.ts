import type { MediaProvider, MediaRequest, ModelCapabilities, ProviderResult } from '../types/media.js';
import { validateRequest } from './gateway.js';
export interface ModelDefinition { id: string; providerId: string; capabilities: ModelCapabilities }
export class ModelRegistry {
  private models = new Map<string, ModelDefinition>();
  private providers = new Map<string, MediaProvider>();
  registerProvider(provider: MediaProvider): void {
    if (this.providers.has(provider.id)) throw new Error('CONFIG_INVALID: duplicate provider');
    this.providers.set(provider.id, provider);
  }
  registerModel(model: ModelDefinition): void {
    if (this.models.has(model.id) || !this.providers.has(model.providerId)) throw new Error('CONFIG_INVALID: duplicate model or missing provider');
    this.models.set(model.id, structuredClone(model));
  }
  list(): ModelDefinition[] { return structuredClone([...this.models.values()]); }
  resolve(id: string): { model: ModelDefinition; provider: MediaProvider } {
    const model = this.models.get(id);
    if (!model) throw new Error('CONFIG_INVALID: unknown model');
    return { model: structuredClone(model), provider: this.providers.get(model.providerId)! };
  }
  async submit(request: MediaRequest): Promise<ProviderResult> {
    const { model, provider } = this.resolve(request.model);
    validateRequest(request, model.capabilities);
    validateRequest(request, await provider.capabilities(request.model));
    return provider.submit(structuredClone(request));
  }
}
