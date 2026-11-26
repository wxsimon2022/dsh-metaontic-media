import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import { validateDownloadUrl, privateAddress } from '../shared/media-validation.js';
/** Resolve once and pin the approved address for the TLS connection. */
export const downloadFetch: typeof fetch = async (input, init) => {
  const url = await validateDownloadUrl(String(input));
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true });
  if (!addresses.length || addresses.some(item => privateAddress(item.address))) throw new Error('DOWNLOAD_FAILED: unsafe destination');
  const destination = addresses[0];
  return new Promise<Response>((resolve, reject) => {
    const req = request(url, {
      method: 'GET', signal: init?.signal ?? undefined,
      lookup: ((_hostname: unknown, _options: unknown, callback: (error: Error | null, address: string, family: number) => void) => callback(null, destination.address, destination.family)) as never,
    }, response => {
      const headers = new Headers();
      for (const [name, values] of Object.entries(response.headers)) if (values !== undefined) headers.set(name, Array.isArray(values) ? values.join(', ') : values);
      resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status: response.statusCode ?? 502, headers }));
    });
    req.on('error', reject); req.end();
  });
};
