import { HttpMediaProvider, type HttpProviderOptions } from './http.js';
import type { MediaRequest, ProviderResult } from '../types/media.js';
export interface ReferenceFile { bytes: Uint8Array; mimeType: string; name: string }
export type ReferenceResolver = (assetId: string) => Promise<ReferenceFile>;
export function openAIImage(options: Omit<HttpProviderOptions, 'protocol'>, resolve?: ReferenceResolver): HttpMediaProvider {
  return new HttpMediaProvider({ ...options, protocol: {
    submitPath: '/v1/images/generations',
    submitPathFor: r => r.mode === 'text' ? '/v1/images/generations' : '/v1/images/edits',
    async encode(r: MediaRequest) {
      if (r.mode !== 'text') {
        if (!resolve) throw new Error('Reference resolver unavailable');
        const form = new FormData(); form.set('model', r.model); form.set('prompt', r.prompt);
        if (r.resolution) form.set('size', r.resolution);
        for (const reference of r.references) {
          const file = await resolve(reference.assetId);
          form.append(reference.role === 'mask' ? 'mask' : 'image', new Blob([Buffer.from(file.bytes)], { type: file.mimeType }), file.name);
        }
        return form;
      }
      return { model: r.model, prompt: r.prompt, ...(r.resolution ? { size: r.resolution } : {}), ...(r.negativePrompt ? { negative_prompt: r.negativePrompt } : {}), ...(r.aspectRatio ? { aspect_ratio: r.aspectRatio } : {}) };
    },
    decode(value): ProviderResult {
      const response = value as { data?: { url?: string; b64_json?: string }[] };
      if (!response.data?.length || response.data.some(x => !x.url && !x.b64_json)) throw new Error('Invalid image response');
      return { state: 'succeeded', outputs: response.data.map(x => ({ url: x.url, base64: x.b64_json })) };
    },
  } });
}
