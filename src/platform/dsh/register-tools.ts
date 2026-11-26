import { registerPromptTools } from '../../tools/prompt.tool.js';
import { registerImageTools } from '../../tools/image.tool.js';
import { registerVideoTools } from '../../tools/video.tool.js';
import { registerModelTools } from '../../tools/model.tool.js';
import { registerTaskTools } from '../../tools/task.tool.js';
import { registerAssetTools } from '../../tools/asset.tool.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Application } from '../../app/bootstrap.js';
import { configSchema } from '../../config/schema.js';
import { Repository } from '../../storage/atomic-json.js';
import { prepare, prepareSchema } from '../../businesses/prompt/prepare.js';
import { confirm, type HostContext, type HostExec } from './host-bridge.js';
const idSchema = z.object({ taskId: z.string().min(1) }).strict();
export function registerTools(ctx: HostContext, root: string, getApp: () => Promise<Application>, reset: () => void) {
  const cleanups: (() => void)[] = [];
  function tool<T>(name: string, description: string, schema: z.ZodType<T>, handler: (args: T, exec?: HostExec) => Promise<unknown>) {
    const cleanup = ctx.tools.register({ name, description, parameters: z.toJSONSchema(schema), async execute(input, exec) {
      try { return { ok: true, data: await handler(schema.parse(input), exec), warnings: [] }; }
      catch (error) { const code = error instanceof z.ZodError ? 'CONFIG_INVALID' : error && typeof error === 'object' && 'code' in error ? String(error.code) : 'REMOTE_FAILED'; return { ok: false, error: { code, message: error instanceof z.ZodError ? '输入结构不符合要求，请修复一次后重试。' : '操作未完成，请检查配置、任务状态或服务可用性。', retryable: code === 'RATE_LIMITED' || code === 'DOWNLOAD_FAILED' } }; }
    } }); if (cleanup) cleanups.push(cleanup);
  }
  registerPromptTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerImageTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerVideoTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerModelTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerTaskTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerAssetTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
}
