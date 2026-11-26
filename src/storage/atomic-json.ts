import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export class Repository<T> {
  constructor(private directory: string) {}
  private path(id: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid identifier');
    return join(this.directory, `${id}.json`);
  }
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
    await writeFile(path, String(process.pid), { flag: 'wx', mode: 0o600 });
    try { return await action(); } finally { await unlink(path); }
  }
}
