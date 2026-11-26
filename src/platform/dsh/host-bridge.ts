export interface HostExec { agent?: unknown; callId?: string; signal?: AbortSignal }
export interface ToolDefinition { name: string; description: string; parameters: unknown; execute(args: unknown, exec?: HostExec): Promise<unknown> }
export interface HostContext {
  tools: { register(tool: ToolDefinition): (() => void) | void };
  get?(name: string): unknown;
  systemPrompt?: { section(input: { name: string; order: number; text: string }): unknown };
  settings?: { documentPath?: string };
  logger?: { warn?(message: string): void };
}
export async function confirm(ctx: HostContext, exec: HostExec | undefined, name: string, reason: string) {
  const approval = ctx.get?.('approval') as { request?(input: unknown): Promise<string> } | undefined;
  if (!approval?.request || !exec?.agent || exec.signal?.aborted) return false;
  return await approval.request({ agent: exec.agent, toolName: name, callId: exec.callId, signal: exec.signal, reason }) === 'allowed-once';
}
