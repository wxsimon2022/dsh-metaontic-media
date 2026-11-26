import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Application } from '../app/bootstrap.js';
import { configSchema } from '../config/schema.js';
import { Repository } from '../storage/atomic-json.js';
import { prepare, prepareSchema } from '../businesses/prompt/prepare.js';
import type { RegisterTool, ToolContext } from './types.js';
const idSchema = z.object({ taskId: z.string().min(1) }).strict();
export function registerTaskTools(tool: RegisterTool, context: ToolContext) {
  const { root, getApp, reset, approve } = context;
  tool('media_usage', '查看媒体调用次数与已知费用；文本 token 与未知费用返回 null。', z.object({}).strict(), async () => (await getApp()).usage.list());
  tool('media_tasks', '查看任务历史。', z.object({}).strict(), async () => (await getApp()).tasks.list());
  tool('media_task_status', '读取本地任务状态，不重新提交或自动重发。', idSchema, async args => (await getApp()).tasks.read(args.taskId));
  tool('media_task_resume', '恢复远端查询或文件下载，不重新付费生成。', idSchema, async args => { const app = await getApp(); const task = await app.resume(args.taskId); return { ...task, assets: await Promise.all((task.assetIds ?? []).map(id => app.assets.read(id).then(x => ({ ...x.asset, path: x.path })))) }; });
  tool('media_task_retry', '下载或查询失败时恢复；明确生成失败时创建待确认新草稿，必须再次调用生成工具确认。', idSchema, async args => (await getApp()).retry(args.taskId));
  tool('media_task_cancel', '取消未提交任务或暂停本地轮询；远端可能继续执行，不代表退款。', idSchema, async args => ({ task: await (await getApp()).cancel(args.taskId), remoteState: 'unknown' }));
}
