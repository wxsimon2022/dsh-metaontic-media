export class Queue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit: number) { if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid concurrency'); }
  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await action(); } finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}
