import { z } from 'zod';
import { ConfigManager } from '../config/config-manager.js';
import { ModelDiscovery } from '../models/model-discovery.js';
import type { RegisterTool, ToolContext } from './types.js';
export function registerModelTools(tool: RegisterTool, context: ToolContext) {
  const manager = new ConfigManager(context.root); const discovery = new ModelDiscovery();
  tool('media_models', '列出本地模型、真实上游 ID、启用状态、能力及默认值。', z.object({ mediaType: z.enum(['image','video']).optional() }).strict(), async args => { const { config } = await manager.load(); return { models: config.models.filter(m => !args.mediaType || m.capabilities?.mediaType === args.mediaType), defaults: config.settings.defaults }; });
  tool('media_providers', '列出服务商及凭据引用，不返回密钥。', z.object({}).strict(), async () => (await manager.load()).config.providers);
  tool('media_model_test', '调用显式配置的非生成接口，区分认证、网络和协议错误，不产生媒体费用。', z.object({ providerId: z.string() }).strict(), async args => { const provider = (await manager.load()).config.providers.find(p => p.id === args.providerId); if (!provider) throw new Error('CONFIG_INVALID'); return discovery.testConnection(provider); });
  tool('media_models_sync', '从已验证模型列表接口读取差异；默认只预览。apply 后仍需宿主确认才写入，新模型保持禁用且不覆盖人工能力。', z.object({ providerId: z.string(), apply: z.boolean().default(false) }).strict(), async (args, exec) => {
    const current = await manager.load(); const provider = current.config.providers.find(p => p.id === args.providerId); if (!provider) throw new Error('CONFIG_INVALID');
    const remote = await discovery.discover(provider); const additions = discovery.additions(provider.id, current.config.models, remote);
    if (!args.apply || !additions.length) return { additions, saved: false, revision: current.revision };
    if (!await context.approve(exec, 'media_models_sync', `同步添加以下模型？全部保持禁用，需人工配置能力：${JSON.stringify(additions)}`)) return { additions, saved: false };
    current.config.models.push(...additions); const saved = await manager.save(current.config, current.revision); context.reset(); return { additions, saved: true, revision: saved.revision };
  });
}
