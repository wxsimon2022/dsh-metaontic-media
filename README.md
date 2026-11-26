# MetaOntic Media

面向 DeepSeek Harness 的原生图片与视频插件，以 `dsh-metaontic-media-v1-native.md` 为实施基线。文本推理使用 DSH 主 Agent；插件提供专业提示词、结构化校验、媒体 Provider、可信确认、任务恢复与本地素材管理，不启动独立 Web 服务或文本 Provider。

## 安装与配置

`npm ci`，`npm test`，`npm run typecheck`，`npm pack`。

本地安装：`dsh plugin --profile desktop add /absolute/path/dsh-metaontic-media-1.0.0.tgz`。重新加载 DSH 后生效。

使用 `media_config` 保存配置，参考 [配置示例](docs/config.example.json)。数据默认存放于 `~/.dsh/dsh-metaontic-media`。密钥只引用环境变量，需确保启动 DSH 的进程可以读取；不把密钥写进配置或聊天。示例域名和模型必须替换成已核验渠道。

## 使用

向 DSH 描述图片、视频或提示词需求。宿主先获取 media_models，使用四个专业提示词定义完成解析、创意及提示词，再通过 media_prepare 校验保存。生成需使用 media_generate_image 或 media_generate_video，经宿主原生人工确认后才会调用媒体 API。费用未知显示 unknown。

工具还包括 media_tasks、media_task_status、media_task_resume、media_task_retry、media_task_cancel、media_assets、media_asset_import、media_asset_delete。

提示词模式设置 promptOnly，不调用媒体模型。直接生成提供完整 request。提交超时进入 SUBMISSION_UNKNOWN，禁止盲目重发。下载失败保留 DOWNLOADING，通过 resume 单独重试下载。明确失败后 retry 创建新草稿，重新确认才能提交。取消本地轮询不代表远端取消或退款。

视频必须显式配置提交/查询路径、字段与状态映射，不假设 New API 协议一致。参考图通过素材 ID 解析为上传内容，不发送本地路径。

## 验证范围

离线测试覆盖原生工具注册/卸载、缺少可信审批时拒绝生成、提示词不提交、配置、能力、并发、状态恢复、提交超时、下载校验及私有地址阻止。具体版本和集成边界见 [宿主集成记录](docs/host-integration.md)。真实图片/视频渠道与自然语言端到端验收需独立验证。
