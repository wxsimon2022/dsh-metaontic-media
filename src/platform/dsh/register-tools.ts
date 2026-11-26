import { registerConfigTools } from '../../tools/config.tool.js';
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
export function registerTools(ctx: HostContext, root: string, getApp: () => Promise<Application>, reset: () => void, runScoped: <T>(exec: HostExec | undefined, action: () => Promise<T>) => Promise<T> = (_exec, action) => action()) {
  const cleanups: (() => void)[] = [];
  function tool<T>(name: string, description: string, schema: z.ZodType<T>, handler: (args: T, exec?: HostExec) => Promise<unknown>) {
    const cleanup = ctx.tools.register({ name, description, parameters: z.toJSONSchema(schema), output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, data: {}, warnings: { type: 'array', items: { type: 'string' } }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, retryable: { type: 'boolean' } }, required: ['code', 'message', 'retryable'] } }, required: ['ok'], additionalProperties: false },
      render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; },
    }, async execute(input, exec) {
      try { return { ok: true, data: await (['media_config','media_config_status','media_settings','media_models','media_providers','media_models_sync','media_model_test','media_prompt'].includes(name) ? handler(schema.parse(input), exec) : runScoped(exec, () => handler(schema.parse(input), exec))), warnings: [] }; }
      catch (error) { const code = error instanceof z.ZodError ? 'CONFIG_INVALID' : error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof Error && /^(CONFIG_INVALID|AUTH_FAILED|UNSUPPORTED_CAPABILITY|PROTOCOL_INVALID|NETWORK_FAILED):?/.test(error.message) ? error.message.split(':')[0] : 'REMOTE_FAILED'; return { ok: false, error: { code, message: error instanceof z.ZodError ? '输入结构不符合要求，请修复一次后重试。' : '操作未完成，请检查配置、任务状态或服务可用性。', retryable: code === 'RATE_LIMITED' || code === 'DOWNLOAD_FAILED' } }; }
    } }); if (cleanup) cleanups.push(cleanup);
  }
  registerPromptTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerImageTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerVideoTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerConfigTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerModelTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerTaskTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  registerAssetTools(tool, { root, getApp, reset, approve: (exec, name, reason) => confirm(ctx, exec, name, reason) });
  return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
}
