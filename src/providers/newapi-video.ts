import { HttpMediaProvider, type HttpProviderOptions } from './http.js';
import type { MediaConfig } from '../config/schema.js';
import type { ProviderResult } from '../types/media.js';
type Protocol = NonNullable<MediaConfig['providers'][number]['protocol']>;
export function newAPIVideo(options: Omit<HttpProviderOptions, 'protocol'>, protocol: Protocol, resolveReference: (id: string) => Promise<string>) {
  return new HttpMediaProvider({ ...options, protocol: {
    submitPath: protocol.submitPath,
    ...(protocol.cancelPath ? { cancelPath: (id: string) => protocol.cancelPath!.replace('{id}', encodeURIComponent(id)) } : {}),
    idempotencyHeader: protocol.idempotencyHeader,
    queryPath: id => protocol.queryPath.replace('{id}', encodeURIComponent(id)),
    async encode(request) {
      const data: Record<string, unknown> = { ...request, references: await Promise.all(request.references.map(async r => ({ role: r.role, url: await resolveReference(r.assetId) }))) };
      delete data.requestId; delete data.mediaType; delete data.mode;
      return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [protocol.fields[key] ?? key, value]));
    },
    decode(value): ProviderResult {
      const data = value as Record<string, unknown>;
      const state = protocol.states[String(data[protocol.stateField])];
      if (!state) throw new Error('Unknown video provider state');
      const outputs = data[protocol.outputsField];
      return { state, ...(data[protocol.idField] ? { remoteId: String(data[protocol.idField]) } : {}), ...(Array.isArray(outputs) ? { outputs: outputs.map(x => typeof x === 'string' ? { url: x } : x) } : {}) };
    },
  } });
}
