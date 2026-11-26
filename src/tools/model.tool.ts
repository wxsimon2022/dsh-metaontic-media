import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Application } from '../app/bootstrap.js';
import { configSchema } from '../config/schema.js';
import { Repository } from '../storage/atomic-json.js';
import { prepare, prepareSchema } from '../businesses/prompt/prepare.js';
import type { RegisterTool, ToolContext } from './types.js';
const idSchema = z.object({ taskId: z.string().min(1) }).strict();
export function registerModelTools(tool: RegisterTool, context: ToolContext) {
  const { root, getApp, reset, approve } = context;
  tool('media_models', '列出配置的模型与能力；不生成。', z.object({ mediaType: z.enum(['image', 'video']).optional() }).strict(), async args => (await getApp()).registry.list().filter(m => !args.mediaType || m.capabilities.mediaType === args.mediaType));
  tool('media_config', '读取或保存无密钥配置。密钥只引用环境变量；不发送测试生成请求。', z.object({ config: configSchema.optional() }).strict(), async args => { if (args.config) { await new Repository(root).write('config', args.config); reset(); return { saved: true }; } return (await getApp()).config; });
}
