import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
export function privateAddress(ip: string): boolean {
  if (ip.includes(':')) return /^(::|fc|fd|fe[89ab]|ff)/i.test(ip) || ip.toLowerCase().includes('ffff:');
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224 || a === 100 && b >= 64 && b <= 127;
}
export async function validateDownloadUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('DOWNLOAD_FAILED: URL requires HTTPS');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(x => privateAddress(x.address))) throw new Error('DOWNLOAD_FAILED: private destination denied');
  return url;
}
export function mediaSignature(bytes: Uint8Array): { mimeType: string; extension: string } {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mimeType: 'image/png', extension: 'png' };
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { mimeType: 'image/webp', extension: 'webp' };
  if (b.toString('ascii', 4, 8) === 'ftyp') return { mimeType: 'video/mp4', extension: 'mp4' };
  if (b.subarray(0, 4).equals(Buffer.from([26,69,223,163]))) return { mimeType: 'video/webm', extension: 'webm' };
  throw new Error('DOWNLOAD_FAILED: unsupported file signature');
}
