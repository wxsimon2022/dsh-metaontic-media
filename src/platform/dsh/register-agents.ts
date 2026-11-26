import { definition as intent } from '../../agents/intent/index.js';
import { definition as creative } from '../../agents/creative/index.js';
import { definition as image } from '../../agents/image-prompt/index.js';
import { definition as video } from '../../agents/video-prompt/index.js';
import type { HostContext } from './host-bridge.js';
export const definitions = [intent, creative, image, video];
export function registerAgents(ctx: HostContext) {
  const cleanups: (() => void)[] = [];
  let disposed = false;
  ctx.inject?.(['systemPrompt'], injected => {
    if (disposed) return;
    const section = injected.systemPrompt!.section({ name: 'metaontic-media', order: 80, text: '使用 DSH 当前模型完成以下专业创作步骤，不另调文本 Provider。只优化提示词时不生成媒体。先 media_models 获取能力，按以下定义输出结构化内容交给 media_prepare；若校验失败最多修复一次。media_prepare 返回草稿后先展示方案与费用未知，再调用生成工具；工具内部会请求可信人工确认，不能自行编造确认。\n' + definitions.map(d => d.id + '\n' + d.systemPrompt).join('\n\n') });
    if (typeof section === 'function') cleanups.push(section as () => void);
  });
  return () => { disposed = true; for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
}
