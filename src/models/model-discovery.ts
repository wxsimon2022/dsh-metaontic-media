import { createHash } from 'node:crypto';
import { validateDownloadUrl } from '../shared/media-validation.js';
import type { ProviderConfig } from '../config/schemas/provider.schema.js';
import { CredentialManager } from '../config/credential-manager.js';
import type { ModelConfig } from '../config/schemas/model.schema.js';
export interface DiscoveredModel { remoteModelId: string; name?: string }
export class ModelDiscovery {
  constructor(private credentials = new CredentialManager(), private fetchImpl: typeof fetch = fetch) {}
  private async get(provider: ProviderConfig, path: string) {
    const base = new URL(provider.baseUrl); const url = new URL(path, base);
    if (url.origin !== base.origin || url.username || url.password) throw new Error('CONFIG_INVALID: discovery must use provider origin');
    if (!provider.allowPrivateService) await validateDownloadUrl(url.href);
    const key = this.credentials.resolve(provider.apiKeyRef); if (!key) throw new Error('AUTH_FAILED: credential environment variable is missing');
    const response = await this.fetchImpl(url, { method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(provider.timeoutMs) });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : `NETWORK_FAILED: HTTP ${response.status}`);
    const contentLength = Number(response.headers.get('content-length')); if (contentLength > 2097152) { await response.body?.cancel(); throw new Error('PROTOCOL_INVALID: response too large'); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('PROTOCOL_INVALID: empty response');
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2097152) throw new Error('PROTOCOL_INVALID: response too large'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  async discover(provider: ProviderConfig): Promise<DiscoveredModel[]> {
    if (!provider.discoveryPath) throw new Error('UNSUPPORTED_CAPABILITY: verified model-list endpoint not configured; add models manually');
    const json = await this.get(provider, provider.discoveryPath) as { data?: { id?: unknown; name?: unknown }[] };
    if (!Array.isArray(json.data) || json.data.some(m => typeof m.id !== 'string')) throw new Error('PROTOCOL_INVALID: expected OpenAI model-list data');
    return [...new Map(json.data.map(m => [String(m.id), { remoteModelId: String(m.id), ...(typeof m.name === 'string' ? { name: m.name } : {}) }])).values()];
  }
  async testConnection(provider: ProviderConfig) {
    if (!provider.testPath && !provider.discoveryPath) return { ok: false, code: 'UNVERIFIABLE', message: '未配置已验证的非生成接口；不会自动提交付费任务。', capabilitiesVerified: false };
    try { if (provider.discoveryPath && (!provider.testPath || provider.testPath === provider.discoveryPath)) await this.discover(provider); else await this.get(provider, provider.testPath!); return { ok: true, code: 'CONNECTED', message: '非生成接口可访问，媒体能力仍需单独核验。', capabilitiesVerified: false }; }
    catch (error) { const message = error instanceof Error ? error.message : ''; const code = message.startsWith('AUTH_FAILED') ? 'AUTH_FAILED' : message.startsWith('PROTOCOL_INVALID') || error instanceof SyntaxError ? 'PROTOCOL_INVALID' : 'NETWORK_FAILED'; return { ok: false, code, message: code === 'AUTH_FAILED' ? '凭据缺失或认证失败。' : code === 'PROTOCOL_INVALID' ? '接口响应不符合已配置协议。' : '连接失败，请检查服务地址及网络。', capabilitiesVerified: false }; }
  }
  additions(providerId: string, models: ModelConfig[], discovered: DiscoveredModel[]): ModelConfig[] {
    return discovered.filter(d => !models.some(m => m.providerId === providerId && m.model === d.remoteModelId)).map(d => ({ id: `${providerId}-${createHash('sha256').update(d.remoteModelId).digest('hex').slice(0,16)}`, providerId, model: d.remoteModelId, name: d.name ?? d.remoteModelId, enabled: false, capabilitySource: 'unknown' }));
  }
}
