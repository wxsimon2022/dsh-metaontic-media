export class CredentialManager {
  constructor(private environment: NodeJS.ProcessEnv = process.env) {}
  resolve(reference: string): string | undefined {
    if (!/^env:[A-Z_][A-Z0-9_]*$/.test(reference)) throw new Error('Unsupported credential reference');
    return this.environment[reference.slice(4)];
  }
  configured(reference: string): boolean { return Boolean(this.resolve(reference)); }
}
