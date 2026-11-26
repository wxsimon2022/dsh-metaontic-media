import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import type { HostContext, HostExec } from './host-bridge.js';
export type ScopeMode = 'global' | 'project' | 'session';
export class ScopeRouter {
  private context = new AsyncLocalStorage<string>();
  constructor(private ctx: HostContext, readonly root: string, readonly mode: ScopeMode) {}
  currentRoot() { const current = this.context.getStore(); if (current) return current; if (this.mode === 'global') return this.root; throw new Error('CONFIG_INVALID: missing execution scope'); }
  async run<T>(exec: HostExec | undefined, action: () => Promise<T>): Promise<T> {
    if (this.mode === 'global') return this.context.run(this.root, action);
    const session = (exec?.agent as { session?: { id?: string; cwd?: string } } | undefined)?.session;
    let identity: string;
    if (this.mode === 'session') {
      if (!session?.id || typeof session.id !== 'string') throw new Error('CONFIG_INVALID: host session ID is unavailable');
      identity = session.id;
    } else {
      const workingDirectory = this.ctx.get?.('workingDirectory') as { ensure?(agent: unknown, signal?: AbortSignal): Promise<string | undefined> } | undefined;
      const cwd = await workingDirectory?.ensure?.(exec?.agent, exec?.signal) ?? session?.cwd;
      if (!cwd || !isAbsolute(cwd)) throw new Error('CONFIG_INVALID: host project directory is unavailable');
      identity = await realpath(cwd);
    }
    const id = createHash('sha256').update(identity).digest('hex');
    return this.context.run(join(this.root, 'scopes', this.mode, id), action);
  }
}
