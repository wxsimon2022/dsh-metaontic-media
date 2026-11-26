import { definition as intent } from '../agents/intent/index.js';
import { definition as creative } from '../agents/creative/index.js';
import { definition as image } from '../agents/image-prompt/index.js';
import { definition as video } from '../agents/video-prompt/index.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Application } from '../app/bootstrap.js';
import { configSchema } from '../config/schema.js';
import { Repository } from '../storage/atomic-json.js';
import { prepare, prepareSchema } from '../businesses/prompt/prepare.js';
import type { RegisterTool, ToolContext } from './types.js';
const idSchema = z.object({ taskId: z.string().min(1) }).strict();
export function registerPromptTools(tool: RegisterTool, context: ToolContext) {
  const { root, getApp, reset, approve } = context;
  tool('media_prompt', '获取需求解析、创意、图片及视频提示词专业定义。由 DSH 当前模型完成推理后交 media_prepare 校验，最多修复一次。无媒体调用。', z.object({}).strict(), async () => [intent, creative, image, video].map(d => ({ id: d.id, version: d.version, systemPrompt: d.systemPrompt, schema: z.toJSONSchema(d.schema) })));
  tool('media_prepare', '校验宿主生成的创意与提示词并保存草稿，不调用媒体模型。直接生成时提供 request，优化时同时传结构化 intent/creative/imagePrompt/videoPrompt。', prepareSchema, async input => {
    const validated = prepare(input); if (validated.questions.length) return validated;
    const app = await getApp();
    const draftId = randomUUID(); const drafts = new Repository(join(app.root, 'drafts'));
    await drafts.write(draftId, { schemaVersion: 1, id: draftId, promptVersion: '1', createdAt: new Date().toISOString(), ...input });
    if (input.promptOnly) return { draftId, ...validated, cost: 'unknown' };
    if (!input.request) return { draftId, ...validated, next: 'Provide request with an explicitly selected model from media_models' };
    const task = await app.draft(input.request);
    return { draftId: task.id, task, cost: 'unknown', next: input.request.mediaType === 'image' ? 'media_generate_image' : 'media_generate_video' };
  });
}
