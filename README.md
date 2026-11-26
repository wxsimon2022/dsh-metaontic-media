# MetaOntic Media

按 `dsh-metaontic-media-v1.md` 实施的 DSH 媒体插件项目。

当前完成的领域基础：严格 TypeScript 类型、模型能力校验、原子 JSON 仓库、跨进程任务锁、参数快照确认、提交不确定保护及远端任务查询恢复。

运行 `npm install`、`npm test`、`npm run typecheck`。构建产物位于 `dist/`。

此阶段为可测试的核心库，尚非可安装的 DSH 插件。尚待实现宿主桥接、配置加载与具体渠道适配器、四个 Agent、下载及素材管理、并发队列与完整命令。生成成功后先进入 DOWNLOADING，不会在文件落盘前报告成功。提交异常不自动重发；崩溃遗留锁需确认原进程退出后人工移除。存储目录应由宿主提供且为可信私有目录。

真实图片及视频渠道尚未验证，未执行付费调用、发布或版本推送。

源码目录遵循设计文档第 4 节。通用类型位于 `src/types/`，任务服务位于 `src/services/task.ts`，JSON 存储位于 `src/storage/atomic-json.ts`。未实现模块使用 `.gitkeep` 保留目录，不提供空实现。Agent 实现时按约定提供 `agent.ts`、`system-prompt.ts`、`schema.ts` 与 `index.ts`。测试按 unit、integration、fixtures、e2e 分目录存放。

新增 `ModelRegistry` 管理模型与 Provider；`HttpMediaProvider` 支持显式配置提交、查询路径与编解码，不假设 New API 视频协议一致。密钥在请求时由回调读取，禁止跨域发送认证信息；HTTP 错误映射为统一错误码并解析 Retry-After。当前不自动重试付费请求。
