import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Application } from '../app/bootstrap.js';
import { configSchema } from '../config/schema.js';
import { Repository } from '../storage/atomic-json.js';
import { prepare, prepareSchema } from '../businesses/prompt/prepare.js';
import type { RegisterTool, ToolContext } from './types.js';
const idSchema = z.object({ taskId: z.string().min(1) }).strict();
export function registerAssetTools(tool: RegisterTool, context: ToolContext) {
  const { root, getApp, reset, approve } = context;
  tool('media_assets', '列出本地素材。', z.object({ projectId: z.string().optional(), cursor: z.string().optional() }).strict(), async args => { const items = (await (await getApp()).assets.list()).filter(x => !args.projectId || x.projectId === args.projectId).sort((a,b) => a.id.localeCompare(b.id)); const filtered = items.filter(x => !args.cursor || x.id > args.cursor).slice(0,50); return { items: filtered, nextCursor: filtered.length === 50 ? filtered.at(-1)?.id : undefined }; });
  tool('media_asset_import', '仅导入用户指定的参考图片文件，不扫描目录。', z.object({ path: z.string(), projectId: z.string().default('references') }).strict(), async args => (await getApp()).assets.import(args.path, args.projectId));
  tool('media_asset_delete', '经宿主人工确认删除本地素材。', z.object({ assetId: z.string() }).strict(), async (args, exec) => (await getApp()).assets.remove(args.assetId, () => approve(exec, 'media_asset_delete', `删除素材 ${args.assetId}？`)));
}
