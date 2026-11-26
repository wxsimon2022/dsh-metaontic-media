import { providerResultSchema } from '../types/provider-result.js';
import type { MediaProvider, MediaRequest, ModelCapabilities, ProviderResult } from '../types/media.js';
import { MediaError } from '../shared/errors.js';
import { validateDownloadUrl } from '../shared/media-validation.js';
import { validateRequest } from './capabilities.js';
export interface HttpProtocol {
  submitPath: string;
  queryPath?: (remoteId: string) => string;
  cancelPath?: (remoteId: string) => string;
  idempotencyHeader?: string;
  encode(request: MediaRequest): unknown | Promise<unknown>;
  submitPathFor?(request: MediaRequest): string;
  decode(response: unknown): ProviderResult;
}
export interface HttpProviderOptions {
  id: string; baseUrl: string; apiKey: () => string | undefined;
  models: Record<string, ModelCapabilities>; protocol: HttpProtocol;
  timeoutMs?: number; allowPrivateService?: boolean; fetch?: typeof fetch;
}
export class HttpMediaProvider implements MediaProvider {
  readonly id: string;
  constructor(private options: HttpProviderOptions) {
    this.id = options.id;
    const url = new URL(options.baseUrl);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(options.allowPrivateService && url.protocol === 'http:'))) {
      throw new MediaError('CONFIG_INVALID', 'Provider requires HTTPS without URL credentials');
    }
  }
  async capabilities(model: string): Promise<ModelCapabilities> {
    const capabilities = this.options.models[model];
    if (!capabilities) throw new MediaError('CONFIG_INVALID', 'Unknown model');
    return structuredClone(capabilities);
  }
  async submit(request: MediaRequest): Promise<ProviderResult> {
    validateRequest(request, await this.capabilities(request.model));
    const body = await this.options.protocol.encode(structuredClone(request));
    return this.call(this.options.protocol.submitPathFor?.(request) ?? this.options.protocol.submitPath, body, 'POST', request);
  }
  async cancel(remoteId: string): Promise<void> {
    if (!this.options.protocol.cancelPath) throw new MediaError('UNSUPPORTED_CAPABILITY', 'Cancellation is not configured');
    await this.call(this.options.protocol.cancelPath(remoteId), {}, 'POST');
  }
  async query(remoteId: string): Promise<ProviderResult> {
    if (!this.options.protocol.queryPath) throw new MediaError('UNSUPPORTED_CAPABILITY', 'Query protocol is not configured');
    return this.call(this.options.protocol.queryPath(remoteId));
  }
  private async call(path: string, body?: unknown, method?: string, mediaRequest?: MediaRequest): Promise<ProviderResult> {
    const base = new URL(this.options.baseUrl);
    const url = new URL(path, base);
    if (url.origin !== base.origin || url.username || url.password) throw new MediaError('CONFIG_INVALID', 'Protocol path must remain on provider origin');
    if (!this.options.allowPrivateService) await validateDownloadUrl(url.href);
    const key = this.options.apiKey();
    if (!key) throw new MediaError('CONFIG_INVALID', 'API key is not configured');
    const response = await (this.options.fetch ?? fetch)(url, {
      method: method ?? (body === undefined ? 'GET' : 'POST'), redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, ...(mediaRequest && this.options.protocol.idempotencyHeader && this.options.models[mediaRequest.model]?.idempotency ? { [this.options.protocol.idempotencyHeader]: mediaRequest.requestId } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 60000),
    });
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : response.status === 429 ? 'RATE_LIMITED' : 'REMOTE_FAILED';
      const retry = response.headers.get('retry-after');
      const delay = retry === null ? undefined : /^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now());
      throw new MediaError(code, `Provider HTTP ${response.status}`, delay !== undefined && Number.isFinite(delay) ? delay : undefined);
    }
    const result = providerResultSchema.parse(this.options.protocol.decode(await response.json()));
    if (!['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(result.state)) throw new MediaError('REMOTE_FAILED', 'Invalid provider state');
    return result;
  }
}
