import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Application } from '../app/bootstrap.js';
import { configSchema } from '../config/schema.js';
import { Repository } from '../storage/atomic-json.js';
import { prepare, prepareSchema } from '../businesses/prompt/prepare.js';
import type { RegisterTool, ToolContext } from './types.js';
const idSchema = z.object({ taskId: z.string().min(1) }).strict();
export function registerVideoTools(tool: RegisterTool, context: ToolContext) {
  const { root, getApp, reset, approve } = context;
  for (const type of ['video'] as const) tool(`media_generate_${type}`, '提交草稿；由宿主人工确认当前参数和参考素材发送范围后执行，可能扣费。', z.object({ draftId: z.string().min(1) }).strict(), async (args, exec) => {
    const app = await getApp(); const task = await app.tasks.read(args.draftId); if (task.request.mediaType !== type) throw new Error('Media type mismatch');
    const result = await app.execute(task.id, request => approve(exec, `media_generate_${type}`, `付费生成，费用未知。上游：${app.config.providers.find(p => p.id === app.registry.resolve(request.model).model.providerId)?.baseUrl}。以下参考素材将发送给上游。参数：${JSON.stringify(request)}`));
    return { ...result, assets: await Promise.all((result.assetIds ?? []).map(id => app.assets.read(id).then(x => ({ ...x.asset, path: x.path })))) };
  });
}
