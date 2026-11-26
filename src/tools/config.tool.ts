import { z } from 'zod';
import { ConfigManager } from '../config/config-manager.js';
import { CredentialManager } from '../config/credential-manager.js';
import { snapshotSchema } from '../config/config-validator.js';
import { providerSchema } from '../config/schemas/provider.schema.js';
import { modelSchema } from '../config/schemas/model.schema.js';
import { settingsSchema } from '../config/schemas/settings.schema.js';
import type { RegisterTool, ToolContext } from './types.js';
export function registerConfigTools(tool: RegisterTool, context: ToolContext) {
  const { root, reset, approve } = context; const manager = new ConfigManager(root); const credentials = new CredentialManager();
  const status = async () => {
    const version = await manager.load();
    return { ...version, credentials: version.config.providers.map(p => ({ providerId: p.id, configured: credentials.configured(p.apiKeyRef) })), missing: [...(!version.config.providers.length ? ['providers'] : []), ...(['image','video'] as const).filter(type => !version.config.settings.defaults[type].modelId).map(type => `defaults.${type}`)], entry: 'media_settings', secretInput: '仅使用 env:变量名；不要在聊天中输入密钥。' };
  };
  tool('media_config_status', '只读脱敏配置、版本及缺失项，不返回密钥。', z.object({}).strict(), status);
  tool('media_config', 'media_config_status 的只读兼容别名。修改配置必须使用 media_settings 并经宿主确认。', z.object({}).strict(), status);
  tool('media_settings', 'DSH 原生交互式设置入口。读取无需确认；服务商、模型和默认值修改均展示完整差异并请求宿主可信确认。密钥仅接受环境变量引用。', z.discriminatedUnion('action', [
    z.object({ action: z.literal('show') }).strict(),
    z.object({ action: z.literal('replace'), revision: z.string().nullable(), config: snapshotSchema }).strict(),
    z.object({ action: z.literal('provider_save'), revision: z.string().nullable(), provider: providerSchema }).strict(),
    z.object({ action: z.literal('provider_delete'), revision: z.string().nullable(), providerId: z.string() }).strict(),
    z.object({ action: z.literal('model_save'), revision: z.string().nullable(), model: modelSchema }).strict(),
    z.object({ action: z.literal('model_delete'), revision: z.string().nullable(), modelId: z.string() }).strict(),
    z.object({ action: z.literal('settings_save'), revision: z.string().nullable(), settings: settingsSchema }).strict(),
  ]), async (args, exec) => {
    if (args.action === 'show') return status();
    const current = await manager.load(); if (args.revision !== current.revision) throw new Error('CONFIG_INVALID: reload latest revision');
    let config = structuredClone(current.config);
    switch (args.action) {
      case 'replace': config = args.config; break;
      case 'provider_save': { const old = config.providers.find(p => p.id === args.provider.id); if (old && old.baseUrl !== args.provider.baseUrl && args.provider.enabled) throw new Error('CONFIG_INVALID: save changed provider disabled, test connection, then enable'); config.providers = [...config.providers.filter(p => p.id !== args.provider.id), args.provider]; break; }
      case 'provider_delete': config.providers = config.providers.filter(p => p.id !== args.providerId); break;
      case 'model_save': config.models = [...config.models.filter(m => m.id !== args.model.id), args.model]; break;
      case 'model_delete': config.models = config.models.filter(m => m.id !== args.modelId); break;
      case 'settings_save': config.settings = args.settings; break;
    }
    snapshotSchema.parse(config);
    if (!await approve(exec, 'media_settings', `修改媒体插件配置？密钥仅保存引用。修改前：${JSON.stringify(current.config)}；修改后：${JSON.stringify(config)}`)) return { saved: false, reason: '未取得宿主用户授权' };
    const saved = await manager.save(config, current.revision); reset(); return { saved: true, revision: saved.revision };
  });
}
