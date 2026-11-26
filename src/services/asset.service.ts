import { downloadFetch } from './download.service.js';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, open, rename, unlink, readFile, realpath, lstat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Repository } from '../storage/atomic-json.js';
import { mediaSignature, validateDownloadUrl } from '../shared/media-validation.js';
export interface Asset { schemaVersion: 1; id: string; projectId: string; taskId?: string; relativePath: string; mimeType: string; size: number; sha256: string; source: 'generated' | 'reference'; createdAt: string }
export class AssetService {
  readonly repository: Repository<Asset>;
  constructor(private root: string, private maxBytes: number, private fetchImpl: typeof fetch = downloadFetch) { this.repository = new Repository(join(root, 'assets')); }
  async list() { return this.repository.list(); }
  async read(id: string) {
    const asset = await this.repository.read(id);
    const root = await realpath(this.root);
    const path = await realpath(join(root, asset.relativePath));
    if (!path.startsWith(root + sep)) throw new Error('Unsafe asset path');
    return { asset, bytes: await readFile(path), path };
  }
  async import(path: string, projectId: string) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > this.maxBytes) throw new Error('Invalid reference file');
    return this.save({ base64: (await readFile(path)).toString('base64') }, projectId, undefined, 'reference');
  }
  async dataUrl(id: string) { const { asset, bytes } = await this.read(id); return `data:${asset.mimeType};base64,${bytes.toString('base64')}`; }
  async remove(id: string, confirm: () => Promise<boolean>) {
    if (!await confirm()) return false;
    const { path } = await this.read(id); await unlink(path); await this.repository.remove(id); return true;
  }
  async save(output: { url?: string; base64?: string; mimeType?: string }, projectId: string, taskId?: string, source: Asset['source'] = 'generated'): Promise<Asset> {
    if (!/^[\w-]+$/.test(projectId)) throw new Error('Invalid project ID');
    const id = randomUUID();
    const directory = join(this.root, 'projects', projectId, source === 'reference' ? 'references' : 'output');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const root = await realpath(this.root);
    if (!(await realpath(directory)).startsWith(root + sep)) throw new Error('Unsafe output directory');
    const temporary = join(directory, `${id}.tmp`);
    const file = await open(temporary, 'wx', 0o600);
    let size = 0; const hash = createHash('sha256'); const prefix: Buffer[] = [];
    let declared = output.mimeType;
    try {
      const write = async (chunk: Uint8Array) => {
        size += chunk.length; if (size > this.maxBytes) throw new Error('DOWNLOAD_FAILED: size limit');
        if (prefix.reduce((sum, b) => sum + b.length, 0) < 32) prefix.push(Buffer.from(chunk.subarray(0, 32)));
        hash.update(chunk); await file.writeFile(chunk);
      };
      if (output.base64) {
        if (output.base64.length > Math.ceil(this.maxBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(output.base64)) throw new Error('Invalid base64');
        await write(Buffer.from(output.base64, 'base64'));
      } else if (output.url) {
        let url = await validateDownloadUrl(output.url);
        let response: Response | undefined;
        for (let redirects = 0; redirects <= 4; redirects++) {
          response = await this.fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(120000) });
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location'); await response.body?.cancel();
            if (!location || redirects === 4) throw new Error('DOWNLOAD_FAILED: redirect limit');
            url = await validateDownloadUrl(new URL(location, url).href); continue;
          }
          break;
        }
        if (!response?.ok || !response.body) throw new Error('DOWNLOAD_FAILED: HTTP failure');
        if (Number(response.headers.get('content-length')) > this.maxBytes) { await response.body.cancel(); throw new Error('DOWNLOAD_FAILED: size limit'); }
        declared = response.headers.get('content-type')?.split(';')[0] ?? declared;
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) await write(chunk);
      } else throw new Error('Missing output');
      const signature = mediaSignature(Buffer.concat(prefix));
      if (declared && declared !== 'application/octet-stream' && declared !== signature.mimeType) throw new Error('DOWNLOAD_FAILED: content type mismatch');
      await file.sync(); await file.close();
      const relativePath = `projects/${projectId}/${source === 'reference' ? 'references' : 'output'}/${id}.${signature.extension}`;
      await rename(temporary, resolve(this.root, relativePath));
      const asset: Asset = { schemaVersion: 1, id, projectId, taskId, relativePath, mimeType: signature.mimeType, size, sha256: hash.digest('hex'), source, createdAt: new Date().toISOString() };
      await this.repository.write(id, asset); return asset;
    } finally { await file.close().catch(() => {}); await unlink(temporary).catch(() => {}); }
  }
}
