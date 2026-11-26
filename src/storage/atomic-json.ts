import { mkdir, readFile, writeFile, rename, unlink, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export class Repository<T> {
  constructor(private directory: string) {}
  private path(id: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid identifier');
    return join(this.directory, `${id}.json`);
  }
  async list(): Promise<T[]> {
    const files = await readdir(this.directory).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
    return Promise.all(files.filter(name => /^[a-zA-Z0-9_-]+\.json$/.test(name)).map(name => this.read(name.slice(0, -5))));
  }
  async remove(id: string): Promise<void> { await unlink(this.path(id)); }
  async read(id: string): Promise<T> { return JSON.parse(await readFile(this.path(id), 'utf8')) as T; }
  async write(id: string, value: T): Promise<void> {
    const destination = this.path(id);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
      await rename(temporary, destination);
    } finally { await unlink(temporary).catch(() => {}); }
  }
  async lock<R>(id: string, action: () => Promise<R>): Promise<R> {
    const path = `${this.path(id)}.lock`;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { await writeFile(path, String(process.pid), { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const owner = Number(await readFile(path, 'utf8'));
      if (!Number.isSafeInteger(owner) || owner <= 0 || Date.now() - (await lstat(path)).mtimeMs < 2000) throw new Error('Task is locked');
      try { process.kill(owner, 0); throw new Error('Task is locked'); }
      catch (check) { if ((check as NodeJS.ErrnoException).code !== 'ESRCH') throw check; }
      await unlink(path);
      await writeFile(path, String(process.pid), { flag: 'wx', mode: 0o600 });
    }
    try { return await action(); } finally { await unlink(path); }
  }
}
