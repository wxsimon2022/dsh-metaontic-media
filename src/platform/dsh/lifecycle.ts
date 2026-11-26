import { homedir } from 'node:os';
import { join } from 'node:path';
import { Application } from '../../app/bootstrap.js';
import { registerTools } from './register-tools.js';
import { registerAgents } from './register-agents.js';
import type { HostContext } from './host-bridge.js';
export const inject = ['tools'];
export function apply(ctx: HostContext, options: { dataDirectory?: string } = {}) {
  const root = options.dataDirectory ?? join(homedir(), '.dsh', 'dsh-metaontic-media');
  let app: Application | undefined; let loading: Promise<Application> | undefined; let disposed = false;
  const reset = () => { app?.dispose(); app = undefined; loading = undefined; };
  const getApp = () => loading ??= Application.load(root).then(value => { if (disposed) { value.dispose(); throw new Error('Plugin disposed'); } return app = value; }).catch(error => { loading = undefined; throw error; });
  const prompts = registerAgents(ctx); const tools = registerTools(ctx, root, getApp, reset);
  void getApp().then(value => value.recover()).catch(() => ctx.logger?.warn?.('[dsh-metaontic-media] 请使用 media_config 配置媒体服务和模型。'));
  return () => { disposed = true; tools(); prompts(); reset(); };
}
