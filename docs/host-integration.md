# DSH 原生集成

核验环境：macOS，DSH CLI 0.2.2-rc.5。本机 desktop profile 已安装的插件采用 ESM `apply(ctx)`、`inject = ['tools']`、`ctx.tools.register({name,description,parameters,execute})` 和 `cordis.patch.yml` bundle 声明。本项目使用相同入口。

专业提示词通过可选 `systemPrompt.section` 服务注入主 Agent；未提供该服务时不创建独立推理运行时。生成审批使用本机现有插件采用的 `ctx.get('approval').request`，只有 `allowed-once` 才执行；缺少审批服务或会话则拒绝生成。确认直接发生在任务锁内，参数快照哈希和消费时间写入任务，不接受模型构造的 approvalId。

本地安装：`npm pack --pack-destination /private/tmp` 后执行 `dsh plugin --profile desktop add /private/tmp/dsh-metaontic-media-1.0.0.tgz`。保留 npm 1.0.0 占位版本，不再次发布。卸载用 `dsh plugin --profile desktop remove dsh-metaontic-media`。

工具提交后返回 taskId，不承诺后台持续生成；用 media_task_resume 查询或恢复下载。media_task_status 只读本地快照。宿主重新加载时仅恢复查询和下载；不恢复付费提交。退出停止本地轮询，不取消远端生成。

真实模型验收需要用户提供实际协议、模型、密钥环境变量和预算。离线宿主替身测试不代表真实 DSH 自然语言及付费渠道验收完成。
