export type MediaType = 'image' | 'video';
export type Mode = 'text' | 'image' | 'edit' | 'first-last-frame';
export interface ModelCapabilities {
  mediaType: MediaType;
  modes: Mode[];
  aspectRatios?: string[];
  durations?: number[];
  resolutions?: string[];
  maxReferences: number;
  nativeAudio: boolean;
  negativePrompt: boolean;
  cancellation: boolean;
  idempotency: boolean;
}
export interface MediaRequest {
  requestId: string;
  model: string;
  mediaType: MediaType;
  mode: Mode;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  references: { assetId: string; role: 'reference'|'first'|'last'|'mask' }[];
}
export interface ProviderResult {
  remoteId?: string;
  state: 'queued'|'running'|'succeeded'|'failed'|'cancelled';
  outputs?: { url?: string; base64?: string; mimeType?: string }[];
  error?: { code: string; message: string };
  cost?: { amount: number; currency: string; source: 'reported'|'estimated' };
}
export interface MediaProvider {
  id: string;
  capabilities(model: string): Promise<ModelCapabilities>;
  submit(request: MediaRequest): Promise<ProviderResult>;
  query?(remoteId: string): Promise<ProviderResult>;
  cancel?(remoteId: string): Promise<void>;
}
