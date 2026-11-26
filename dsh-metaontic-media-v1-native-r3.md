# MetaOntic Media V1.0 DSH 原生插件完整项目设计方案

> 项目：`dsh-metaontic-media` \| 版本：V1.0 \| 状态：原生插件修订版（V1.0-r3，模型管理增强） 宿主：DeepSeek Harness（DSH） \| 技术：TypeScript / JavaScript

## 1. 产品定位与目标

让创意成为作品（Turn Ideas into Media）。面向普通创作者、自媒体和电商用户，提供自然语言驱动的图片、视频生成能力。插件不绑定模型服务商，MetaOntic AI / New API 为可选接入渠道。第一版以单次图片或视频生成闭环为目标，不建设完整影视生产平台。

### 1.1 范围

  模块   V1.0 范围                                    优先级
  ------ -------------------------------------------- --------
  图片   文生图、参考图生成、图片编辑（模型支持时）   P0
  视频   文生视频、图生视频、首尾帧（模型支持时）     P0
  创作   需求解析、创意增强、图片/视频提示词          P0
  模型   服务商管理、模型同步、能力配置、默认模型、连接测试           P0
  任务   提交、查询、恢复、下载、失败处理             P0
  素材   本地文件、参考图、生成结果、历史记录         P0
  用量   文本 token、媒体调用次数、已知费用           P1

V1 不实现长片自动剪辑、复杂多 Agent 自主协商、音频生成、云端多租户、批量营销、独立 Web 服务。保留扩展接口。视频时长、画幅、分辨率均由模型能力决定。

## 2. 用户交互与功能需求

用户可以直接输入"生成一段15秒的乡村搞笑视频，两个老人讨论退休金，16:9"，也可以输入图片路径并要求图生视频。系统解析需求，展示创作方案、模型、参数及可获得的费用信息，确认后执行。用户明确要求直接生成时可跳过创意增强，但默认仍需确认付费操作。提示词模式不调用媒体模型。

  建议命令（逻辑名称）   功能
  ---------------------- ----------------
  `/media`               帮助与入口
  `/media image`         图片创作
  `/media video`         视频创作
  `/media prompt`        仅生成提示词
  `/media models`        模型列表及能力
  `/media config`        配置及连接测试（settings 别名）
  `/media settings`      插件设置入口
  `/media providers`     服务商管理
  `/media models sync`   同步模型列表
  `/media models test`   非付费连接与能力检查
  `/media usage`         已知用量与费用
  `/media tasks`         历史任务
  `/media status <id>`   查询与恢复任务
  `/media retry <id>`    安全重试
  `/media cancel <id>`   取消（支持时）
  `/media assets`        素材列表

上述为拟定命令，不是已验证的 DSH API；实际注册方式以宿主 SDK 为准。交互优先使用宿主原生能力，不额外开发独立 UI。

## 3. 总体架构与宿主边界

DSH 是唯一运行入口。插件不是独立应用，不启动 HTTP 服务、Web 前端、独立 Agent runtime 或独立文本模型网关。优先使用宿主的 Agent、工具、会话、文本模型及交互机制；具体能力必须在阶段 0 核验。若宿主不支持子 Agent 注册，则把专业提示词作为宿主主 Agent 可使用的技能或工具说明，不另建 Agent 引擎。若宿主无法提供必要的工具注册能力，则停止集成并报告阻塞。

``` mermaid
flowchart TD
 A[DSH 原生会话与 Agent] --> B[插件注册与宿主适配]
 B --> C[专业提示词与工具定义]
 C --> D[图片与视频业务服务]
 D --> E[模型 Provider]
 D --> F[任务与素材 Repository]
 E --> G[外部媒体模型 API]
 F --> H[本地文件系统]
```

  能力             DSH 负责                       插件负责
  ---------------- ------------------------------ ----------------------------
  会话、文本推理   原生会话及已配置模型           专业提示词、结构化结果校验
  交互             原生确认与结果呈现（若支持）   创作方案、参数和费用说明
  工具执行         加载与分发工具                 媒体请求校验、提交与查询
  生命周期         安装、启用、卸载               初始化、恢复、清理资源
  媒体任务         不假设宿主已有                 本地任务状态机、下载及恢复

依赖方向：platform → app → businesses/services → providers/storage。Agent 定义不依赖 HTTP 实现。业务流程仅为轻量函数编排，不建设通用工作流引擎。

## 4. 完整代码目录

``` text
dsh-metaontic-media/
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
├── docs/
├── src/
│   ├── index.ts
│   ├── app/
│   │   ├── bootstrap.ts
│   │   └── dispose.ts
│   ├── platform/dsh/
│   │   ├── host-bridge.ts
│   │   ├── register-tools.ts
│   │   ├── register-agents.ts
│   │   ├── lifecycle.ts
│   │   └── settings/       # 原生设置或命令适配
│   ├── agents/
│   │   ├── intent/
│   │   ├── creative/
│   │   ├── image-prompt/
│   │   └── video-prompt/
│   ├── tools/
│   │   ├── image.tool.ts
│   │   ├── video.tool.ts
│   │   ├── prompt.tool.ts
│   │   ├── task.tool.ts
│   │   ├── model.tool.ts
│   │   ├── config.tool.ts  # 仅脱敏读取；写入走可信交互
│   │   └── asset.tool.ts
│   ├── businesses/
│   │   ├── image/create.ts
│   │   ├── video/create.ts
│   │   └── prompt/prepare.ts
│   ├── providers/
│   │   ├── registry.ts
│   │   ├── capabilities.ts
│   │   ├── openai-image.ts
│   │   └── newapi-video.ts
│   ├── services/
│   │   ├── generation.service.ts
│   │   ├── task.service.ts
│   │   ├── asset.service.ts
│   │   ├── download.service.ts
│   │   └── usage.service.ts
│   ├── storage/
│   │   ├── task.repository.ts
│   │   ├── asset.repository.ts
│   │   └── atomic-json.ts
│   ├── config/
│   │   ├── config-manager.ts
│   │   ├── config-loader.ts
│   │   ├── config-validator.ts
│   │   ├── credential-manager.ts
│   │   ├── defaults.ts
│   │   └── schemas/
│   │       ├── provider.schema.ts
│   │       ├── model.schema.ts
│   │       └── settings.schema.ts
│   ├── models/
│   │   ├── model-registry.ts
│   │   ├── model-discovery.ts
│   │   ├── model-selector.ts
│   │   └── model-capabilities.ts
│   ├── shared/
│   ├── locale/
│   └── types/
└── tests/
    ├── unit/
    ├── integration/
    ├── fixtures/
    └── host/
```

每个 Agent 目录包含 system-prompt.ts、schema.ts、definition.ts、index.ts；definition 只描述宿主注册所需元数据，不实现推理循环。工具负责输入输出 schema 与业务服务调用，不直接拼装 HTTP 请求。TypeScript strict，编译成宿主支持的 JavaScript 模块格式。

## 5. 工作流设计

``` mermaid
flowchart TD
 A[用户输入] --> B[需求解析]
 B --> C{是否缺少必要信息}
 C -- 是 --> D[询问用户]
 D --> B
 C -- 否 --> E{是否需要优化}
 E -- 是 --> F[创意增强与提示词生成]
 E -- 否 --> G[使用原始提示词]
 F --> H[能力与参数校验]
 G --> H
 H --> I{仅提示词}
 I -- 是 --> J[输出提示词]
 I -- 否 --> K[展示方案与费用确认]
 K --> L[持久化任务并提交]
 L --> M[查询状态或同步返回]
 M --> N[下载与校验]
 N --> O[保存素材并展示结果]
```

图片同步返回和视频异步返回均转换为统一任务对象。模型不支持指定能力时，给出可选参数，不静默降级。确认后请求参数发生变化必须重新确认。创作草稿保存输入、输出与 promptVersion；恢复媒体任务时不重复执行文本创作或已完成的付费提交。用户取消确认时不发起媒体请求。

## 6. Agent 设计与完整系统提示词

所有 Agent 使用结构化 JSON 输出，插件在宿主返回结果后进行 schema 校验；解析失败允许一次修复，不无限重试。用户输入与参考素材描述均作为数据，不得覆盖系统约束。文本推理只使用 DSH 已配置的模型及原生能力，不另建文本 Provider。

### 6.1 IntentAgent

``` text
你是 MetaOntic Media 的多媒体需求分析师。你的任务是把用户的自然语言转换为可执行的创作需求，不生成媒体，不调用工具。
识别目标：图片、视频或仅提示词；识别生成模式、主题、人物、场景、动作、对白、视觉风格、画幅、时长、分辨率、参考素材、模型偏好、是否优化。
严格保留用户明确指定的事实、人物、对白和限制。不要虚构文件路径、模型能力、商品功效或用户未提供的事实。
必要信息缺失且无法安全推断时写入 questions；非必要信息可以采用合理默认值并记录 assumptions。不要把建议当作用户确认。
输出合法 JSON，不使用 Markdown，不输出解释性文字：
{"mediaType":"image|video","action":"generate|prompt","mode":"text|image|edit|first-last-frame","idea":"","subjects":[],"dialogue":[],"style":null,"aspectRatio":null,"duration":null,"resolution":null,"references":[],"model":null,"optimize":true,"constraints":[],"questions":[],"assumptions":[]}
```

### 6.2 CreativeAgent

``` text
你是 MetaOntic Media 的创意策划与编剧。根据结构化需求完善创意，使作品具有明确主题、可见动作、内容层次和视觉吸引力。
尊重用户指定人物、对白、主题和时长，不擅自改变核心立意。短视频优先采用开场吸引、内容发展、结尾落点；根据题材选择适合的节奏，不强制所有视频反转。图片强调主体、构图、环境和视觉重点。
补充必要的细节，不引入无关人物，不使用无法视觉化的抽象描述。对白应符合人物身份、自然口语和实际时长；若原对白过长，保留原文并提出精简建议，不擅自替换。
商品类内容不得编造功效、销量、认证或价格。参考图中的主体特征应保持一致。不要声称已生成素材。
只输出 JSON：{"title":"","concept":"","subjects":[],"setting":"","beats":[{"start":0,"end":0,"visual":"","action":"","dialogue":""}],"visualStyle":"","audio":"","constraints":[],"warnings":[]}
图片任务的 beats 可为空。视频 beats 的时间区间不得超出目标时长。
```

### 6.3 ImagePromptAgent

``` text
你是专业 AI 图片提示词工程师和视觉设计师。根据创作需求、创意方案、参考图描述和目标模型能力，输出可直接用于图片模型的提示词。
依次描述主体、外观、姿态、场景、构图、景别、光线、色彩、材质和风格。使用具体可见的描述，不堆砌无意义质量词。
图生图或编辑任务明确需要修改的区域和保持不变的元素；不得凭空声称已观察到未提供的图像。用户要求文字时准确保留文字，不自行添加水印、标识或字幕。只有模型支持负面提示词时才生成该字段。
参数独立输出，不在提示词内伪造模型控制语法。默认中文，目标模型明确要求其他语言时转换，画面文字仍保留原语言。
只输出 JSON：{"prompt":"","negativePrompt":null,"parameters":{"aspectRatio":null,"resolution":null},"referenceRoles":[],"warnings":[]}
```

### 6.4 VideoPromptAgent

``` text
你是专业 AI 视频导演、摄影指导和视频提示词工程师。根据用户需求、创意方案、参考素材和模型能力生成可执行的视频提示词。
明确主体及一致性、场景、动作、动作顺序、景别、机位、运镜、光线、风格、节奏和结尾画面。时长较短时减少镜头与动作数量，避免不可能完成的动作密度。用户要求单镜头时不得自行切镜。
对白明确说话人、语言、口音（仅在用户指定时）和自然停顿；原生音频受模型能力约束，不支持时给出警告，不承诺口型同步。参考图用于主体或首尾帧时保持其关键外观和空间关系。
保持用户原始创意及明确限制，不增加无关人物，不虚构模型能力，不编造参数。默认不添加字幕和水印，用户明确要求时例外。负面提示词仅在支持时输出。
只输出 JSON：{"prompt":"","negativePrompt":null,"parameters":{"duration":null,"aspectRatio":null,"resolution":null,"generateAudio":null},"shots":[{"start":0,"end":0,"visual":"","camera":"","dialogue":"","audio":""}],"referenceRoles":[],"warnings":[]}
镜头时间不得重叠或超出总时长。模型不支持分镜参数时，shots 仅用于展示和构建自然语言 prompt，不直接传给模型。
```

## 7. 核心类型与接口

``` typescript
export type MediaType = 'image' | 'video';
export type Mode = 'text' | 'image' | 'edit' | 'first-last-frame';
export interface ModelCapabilities {
  mediaType: MediaType;
  modes: Mode[];
  aspectRatios?: string[];
  durations?: number[];
  resolutions?: string[];
  maxReferences: number;
  nativeAudio: boolean;
  negativePrompt: boolean;
  cancellation: boolean;
  idempotency: boolean;
}
export interface MediaRequest {
  requestId: string;
  model: string;
  mediaType: MediaType;
  mode: Mode;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  references: { assetId: string; role: 'reference'|'first'|'last'|'mask' }[];
}
export interface ProviderResult {
  remoteId?: string;
  state: 'queued'|'running'|'succeeded'|'failed'|'cancelled';
  outputs?: { url?: string; base64?: string; mimeType?: string }[];
  error?: { code: string; message: string };
  cost?: { amount: number; currency: string; source: 'reported'|'estimated' };
}
export interface MediaProvider {
  id: string;
  capabilities(model: string): Promise<ModelCapabilities>;
  submit(request: MediaRequest): Promise<ProviderResult>;
  query?(remoteId: string): Promise<ProviderResult>;
  cancel?(remoteId: string): Promise<void>;
}
```

Provider 负责协议转换、认证、错误映射；GenerationService 与 ProviderRegistry 负责模型选择、能力校验及统一调用。参考图由 AssetService 解析为 Provider 所需上传文件、URL 或 base64，不将本地路径直接发送给上游。未声明的能力视为未知，不默认支持。

## 8. 模型接入与配置管理（V1 P0）

### 8.1 配置归属与入口

文本模型复用 DSH 当前会话模型；图片、视频模型由插件独立配置；音频仅预留。安装后从 DSH 插件设置进入 MetaOntic Media，若 SDK 不支持自定义设置面板，则使用原生命令 `/media settings` 和可信交互式配置；不启动 Web 服务。设置面板和命令均为拟定设计，阶段 0 核验后实现至少一种可用入口。若没有安全密钥输入控件，使用环境变量引用，不在聊天中要求输入密钥。

| 设置页 | 字段与操作 |
|---|---|
| 服务商 | 新增、编辑、启用、禁用、删除；名称、Base URL、协议、凭据引用、超时、连接测试 |
| 图片模型 | 手动添加、同步、启用、能力编辑、默认模型、默认画幅 |
| 视频模型 | 手动添加、同步、启用、能力编辑、默认模型、时长、画幅、原生音频 |
| 通用设置 | 文本模型来源（DSH）、确认策略、输出目录、轮询、并发、下载 |

### 8.2 Provider / Model / Defaults 三级结构

Provider 管理服务地址、凭据与各媒体类型适配器；Model 管理本地唯一 ID、真实上游模型 ID、能力及启用状态；Defaults 通过本地模型 ID 引用模型。一个服务商可同时提供多个图片和视频模型。多个服务商可以拥有相同的上游模型 ID，不得以该 ID 作为全局唯一键。

配置目录由宿主定位，不硬编码 DSH 安装路径。三个文件共享 schemaVersion；ConfigManager 负责校验、跨文件引用、加锁、原子提交及崩溃恢复（事务日志或版本目录加原子指针）。旧版单文件配置如已存在，先备份再迁移，失败保持原配置。

`config/providers.json` 示例：

```json
{
  "schemaVersion": 1,
  "providers": [
    {
      "id": "metaontic",
      "name": "MetaOntic AI",
      "enabled": true,
      "baseUrl": "https://example.com",
      "apiKeyRef": "env:METAONTIC_API_KEY",
      "adapters": {"image": "openai-image", "video": "newapi-video"},
      "timeoutMs": 60000
    }
  ]
}
```

`config/models.json` 示例：

```json
{
  "schemaVersion": 1,
  "models": [
    {
      "id": "metaontic-image",
      "name": "Seedream 示例",
      "providerId": "metaontic",
      "model": "REPLACE_WITH_REAL_IMAGE_MODEL_ID",
      "enabled": false,
      "capabilities": {"mediaType": "image", "modes": ["text", "image"], "maxReferences": 1, "nativeAudio": false, "negativePrompt": false, "cancellation": false, "idempotency": false}
    },
    {
      "id": "metaontic-video",
      "name": "Seedance 示例",
      "providerId": "metaontic",
      "model": "REPLACE_WITH_REAL_VIDEO_MODEL_ID",
      "enabled": false,
      "capabilities": {"mediaType": "video", "modes": ["text", "image"], "durations": [5, 10, 15], "aspectRatios": ["16:9", "9:16"], "maxReferences": 1, "nativeAudio": false, "negativePrompt": false, "cancellation": false, "idempotency": false}
    }
  ]
}
```

`config/settings.json` 示例：

```json
{
  "schemaVersion": 1,
  "defaults": {"text": {"source": "host"}, "image": {"modelId": null}, "video": {"modelId": null, "duration": 15, "aspectRatio": "16:9", "generateAudio": false}},
  "generation": {"requireConfirmation": true, "autoDownload": true, "autoEnhancePrompt": true},
  "tasks": {"pollIntervalMs": 5000, "maxPollIntervalMs": 30000, "pollDeadlineMs": 900000, "maxConcurrent": 2, "maxQueryRetries": 3},
  "storage": {"outputDir": "./media-output"},
  "limits": {"maxDownloadBytes": 524288000}
}
```

示例模型默认禁用，真实 ID、能力及协议验证后才启用并设置默认值。相对输出路径以插件数据目录为基准；外部目录须用户明确授权。配置的确认策略不得绕过第 17 章付费授权约束。

### 8.3 内部类型与服务契约

```typescript
interface ProviderConfig {
  id: string; name: string; enabled: boolean;
  baseUrl: string; apiKeyRef: string;
  adapters: Partial<Record<MediaType, string>>;
  timeoutMs: number;
}
interface ModelConfig {
  id: string; name: string; providerId: string;
  model: string; enabled: boolean;
  capabilities: ModelCapabilities;
}
interface ModelDiscoveryResult {
  remoteModelId: string;
  name?: string;
  mediaType?: MediaType;
  capabilities?: Partial<ModelCapabilities>;
}
interface ModelManagementService {
  list(mediaType?: MediaType): Promise<ModelConfig[]>;
  discover(providerId: string): Promise<ModelDiscoveryResult[]>;
  testConnection(providerId: string): Promise<{ok: boolean; message: string}>;
  resolve(mediaType: MediaType, mode: Mode, explicitId?: string, sessionId?: string): Promise<ModelConfig>;
}
```

ConfigManager 提供服务商与模型 CRUD、默认模型设置、配置快照、版本校验；CredentialManager 只向 HTTP 适配器提供密钥，禁止返回给 Agent。ProviderRegistry 按 providerId 和 mediaType 创建适配器；MediaRequest.model 在提交前转换为真实上游 ID，本地任务同时记录本地 modelId 与 providerId。运行中任务绑定原服务商和适配器快照，不随默认配置变化；凭据仅记录引用。存在未完成任务的服务商不得直接删除，须先处理任务；删除默认模型前必须清除或重新设置默认引用。

### 8.4 同步、测试与模型选择

- 同步优先使用渠道已验证的模型列表接口（如支持 `/v1/models`），不支持时提供手动添加。同步先展示差异再确认写入，不自动删除已有模型，不覆盖人工确认的能力。未知媒体类型或能力的模型保持禁用，待人工配置。
- 连通性测试使用非生成接口；若渠道无免费验证接口，显示无法验证，不自动提交付费任务。区分认证失败、网络失败、协议不兼容与能力未验证。
- 模型选择顺序：本次明确指定 → 当前会话指定 → 插件默认 → 展示符合能力的候选供用户选择。显式指定模型不兼容时返回错误，不静默降级。校验启用状态、媒体类型、模式、画幅、时长、参考图数量和音频能力。
- 生成前展示服务商、模型、参数及费用（未知明确标记）；模型、参数或服务商变化使旧确认失效。V1 不实现自动价格路由或故障切换。

### 8.5 协议、安全与验收

图片适配器可支持 OpenAI 风格 `/v1/images/generations` 与 `/v1/images/edits`，以渠道实际支持为准。视频提交、查询路径、字段、状态及鉴权由适配器实现，不假定所有 New API 部署一致。API Key 使用环境变量或已验证的宿主安全存储，不写入 JSON、日志或提示词；配置导出仅含凭据引用。修改服务地址、密钥、默认模型等操作必须由可信用户交互授权，不允许 Agent 静默修改。地址变更需重新验证，禁止将原凭据自动发送至不同来源的重定向目标。

P0：服务商 CRUD、凭据引用、连通性测试、手动添加模型、支持时同步列表、能力配置、默认模型、配置持久化及 DSH 内设置入口。P1：价格配置、自动路由、故障切换（另行设计）。

## 9. 任务状态、恢复与并发

  状态                            含义
  ------------------------------- ------------------------------
  DRAFT / AWAITING_CONFIRMATION   草稿 / 待确认
  QUEUED / SUBMITTING             已入队 / 提交中
  SUBMISSION_UNKNOWN              提交结果不确定，禁止盲目重发
  RUNNING                         上游处理中
  PAUSED                          本地停止轮询，远端可能仍运行
  DOWNLOADING                     已生成，下载中
  SUCCEEDED                       文件验证并保存成功
  FAILED                          明确失败，记录阶段
  CANCELLED                       未提交即取消或上游确认取消

提交前原子保存 requestId、参数快照与确认记录。收到 remoteId 后立即持久化。若提交超时且无 remoteId，只有上游支持幂等键或可查证未创建时才允许自动重试，否则标记 SUBMISSION_UNKNOWN 并提示人工核查。轮询网络错误可指数退避，尊重 Retry-After；超出本地等待时间进入 PAUSED 而非认定远端失败。重启时恢复有 remoteId 的非终态任务。下载失败仅重试下载，不重新生成。明确生成失败后的再次付费提交须重新确认。

V1 采用本地并发队列（默认2），同任务加锁，防止多个会话重复执行。宿主退出不承诺后台继续运行；下次启动恢复。取消轮询不等于取消远端生成或退款。

## 10. 数据与素材管理

``` text
<plugin-data>/
├── config/
│   ├── providers.json
│   ├── models.json
│   └── settings.json
├── tasks/<task-id>.json
├── projects/<project-id>/
│   ├── project.json
│   ├── intent.json
│   ├── creative.json
│   ├── prompts/<revision>.json
│   ├── references/
│   └── output/
├── assets/<asset-id>.json
└── logs/
```

V1 选择 JSON 文件存储以减少依赖，采用临时文件写入、原子 rename、跨进程锁及 schemaVersion；不依赖 Docker 或数据库。未来可通过 Repository 接口迁移 SQLite。

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  实体                                关键字段
  ----------------------------------- ------------------------------------------------------------------------------------------------------------------------------------
  Project                             id, title, mediaType, createdAt, updatedAt, schemaVersion

  Task                                id, projectId, requestId, providerId, model, state, remoteId, requestSnapshot, confirmation, attempts, error, timestamps, assetIds

  Asset                               id, projectId, taskId, relativePath, mimeType, size, sha256, source, createdAt

  Usage                               taskId, providerId, model, textTokens, mediaCount, reportedCost, estimatedCost, currency
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

下载使用流式写入、大小限制、超时及内容类型/文件签名校验；成功后原子移动。文件名由系统生成，禁止路径穿越和符号链接逃逸。临时 URL 不作为永久素材。历史记录支持查看、重新使用提示词及删除本地素材（删除前确认）。

## 11. 安全、异常与可观测性

-   API 密钥脱敏；不记录完整认证头、base64 或敏感签名 URL。
-   默认 HTTPS；自定义私有服务地址须显式允许。下载 URL 限制协议、重定向次数与目标地址，防止访问未经授权的内网及元数据服务。
-   参考图上传前展示发送范围；仅上传用户选定文件，不扫描整个工作区。
-   不执行模型输出的命令；Agent 输出必须经过 schema 和参数校验。
-   日志包含 traceId、taskId、providerId、阶段、耗时、错误码；费用未知显示未知，不记为零。
-   错误分类：CONFIG_INVALID、AUTH_FAILED、UNSUPPORTED_CAPABILITY、RATE_LIMITED、SUBMISSION_UNKNOWN、REMOTE_FAILED、DOWNLOAD_FAILED、STORAGE_FAILED、CONTENT_REJECTED。
-   429/临时网络错误可按阶段安全重试；401/403、参数错误、内容拒绝不自动重试；错误信息脱敏后展示可执行建议。

## 12. 宿主集成与构建发布

`platform/dsh` 是唯一直接依赖宿主 SDK 的目录。定义 HostBridge 抽象，包含注册命令/工具、获取文本模型能力、确认操作、展示进度、读取安全配置、定位数据目录和释放资源。应用层使用模拟 HostBridge 可独立测试。

构建建议使用 TypeScript 编译器或宿主推荐打包工具，依赖尽量少；运行时 schema 校验可使用 Zod，测试可使用 Vitest（均为建议选型）。package.json 的 name 为 dsh-metaontic-media，版本 1.0.0。发布前执行类型检查、测试、构建、npm pack 检查，确保不包含密钥、生成素材和本地配置。实际 manifest、插件入口、安装命令及 npm 包名可用性需在 DSH SDK 与 npm 上核验，不在此虚构。

## 13. 测试与验收

  场景              验收标准
  ----------------- ------------------------------------------
  文生图            合法参数、成功保存图片并返回路径
  图生图            正确传递参考图且不泄露无关文件
  文生视频          提交、查询、下载、保存全链路成功
  图生视频/首尾帧   能力匹配，引用角色正确；不支持则拒绝提交
  提示词模式        结构化输出，无媒体付费请求
  用户取消确认      无媒体请求
  提交超时          不重复扣费式盲重试
  进程重启          已知 remoteId 的任务可恢复
  下载失败          可单独恢复下载
  并发              不超过配置上限，同任务不重复提交
  异常配置          密钥错误、能力冲突有明确提示
  设置入口          DSH 内完成服务商与默认模型配置，重启后保留
  模型同步          不支持时可手动添加；未知能力不自动启用
  模型切换          旧确认失效；运行中任务不受默认模型变化影响
  连接测试          不发起付费生成；密钥不出现在工具输出
  配置删除          默认引用及未完成任务得到保护
  安全              日志无密钥，路径穿越与恶意下载地址被拒绝

单元测试覆盖 schema、状态机、参数转换和错误分类；集成测试使用模拟 HTTP 服务覆盖同步图片、异步视频、429、超时、失败及恢复；真实模型冒烟测试使用用户授权的测试密钥及预算。发布门槛：P0 用例全部通过、无已知严重安全问题、至少一个真实图片渠道与一个真实视频渠道验证通过。

## 14. 开发实施计划

  ------------------------------------------------------------------------------------------------------------
  阶段                    交付物                                                       参考工期
  ----------------------- ------------------------------------------------------------ -----------------------
  0                       核验 DSH SDK、New API 协议、包名；建立最小插件               1--2日

  1                       类型、配置管理、模型同步、ProviderRegistry、图片/视频 Provider、模拟服务   2--3日

  2                       4个专业提示词定义、宿主集成、结构化校验                      2--3日

  3                       任务持久化、恢复、下载、素材管理                             2--3日

  4                       宿主设置入口、命令、交互、测试、README、发布                           2--3日
  ------------------------------------------------------------------------------------------------------------

单人开发粗估9--14个工作日，取决于宿主 SDK 和渠道协议成熟度。优先跑通不经过 Agent 的直接生成链路，再接入创意增强，最后完善恢复及安全。

## 15. V1 交付清单与后续扩展

交付 TypeScript 源码、JavaScript 构建产物、配置示例、四个 Agent 提示词及 schema、模型适配器、任务与素材管理、测试、安装使用文档和变更日志。V1.1 可扩展分镜、人物资产及轻量业务编排；V1.2 增加音频、FFmpeg 合成；V2 再扩展商品批量创作。

## 16. 待确认事项与设计假设

本方案基于已确定的项目名称、TS/JS 技术栈和图片/视频优先策略，未读取现有插件源码，也未验证 DSH SDK、npm 注册状态或真实 New API 视频接口。JSON 存储、四 Agent、默认并发2、人工付费确认、工期及命令名称均为本方案建议，并非宿主既有能力。编码前需确认宿主设置面板及安全凭据能力、宿主生命周期、文本模型调用机制、插件注册规范、实际模型 ID、鉴权、提交/查询协议、计费及幂等支持。本文为实施设计，不代表代码已经开发或测试通过。

## 17. DSH 工具契约与授权边界

以下工具名称和 TypeScript 接口均为插件内部设计契约，不是已验证的 DSH SDK 方法。实际工具注册通过 platform/dsh 映射。

  ----------------------------------------------------------------------------------------------------------------------------
  工具                   输入                                   输出                                    副作用
  ---------------------- -------------------------------------- --------------------------------------- ----------------------
  media_prepare          idea, mediaType, references, options   draftId, prompt, parameters, warnings   保存草稿，无媒体费用

  media_models           mediaType                              models, capabilities                    无生成费用

  media_config_status    无                                     脱敏配置及缺失项                         只读，无密钥

  media_model_test       providerId                             连通性及诊断                             非付费测试

  media_generate_image   draftId, approvalId                    taskId, state, assets                   可能扣费

  media_generate_video   draftId, approvalId                    taskId, state, assets                   可能扣费

  media_task_status      taskId                                 state, progress（可空）, assets         查询，不重新提交

  media_task_resume      taskId                                 state, assets                           恢复查询或下载

  media_task_retry       taskId, approvalId（新提交时必需）     taskId, state                           可能扣费

  media_task_cancel      taskId                                 localState, remoteState                 可能取消远端

  media_assets           projectId, cursor                      items, nextCursor                       只读
  ----------------------------------------------------------------------------------------------------------------------------

工具返回统一结构：

``` typescript
export type ToolResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };
```

确认记录由可信宿主交互产生，不允许 Agent 自行构造 approvalId。记录绑定会话、草稿 ID、请求参数哈希、有效期与费用说明；提交前在锁内消费确认记录。若宿主没有可信确认机制，阶段 0 必须确定可验证的用户显式执行入口；在完成前禁用付费生成工具。不能仅凭模型输出的 confirmed=true 执行扣费。

## 18. 宿主生命周期与集成契约

内部适配契约示例（不是 DSH SDK）：

``` typescript
interface HostBridge {
  registerTool(definition: InternalToolDefinition): Promise<() => void>;
  registerPrompt?(definition: InternalPromptDefinition): Promise<() => void>;
  getDataDirectory(): Promise<string>;
  notify(message: string): Promise<void>;
}
```

InternalToolDefinition 包含 name、description、输入 schema、handler；InternalPromptDefinition 包含 id、version、systemPrompt、输出 schema。实际 SDK 若不支持动态卸载，则依宿主生命周期处理，不伪造注销函数。

初始化顺序：读取配置 → 校验数据目录 → 创建 repository → 装配 provider → 注册工具和提示词 → 恢复任务索引。退出时停止本地轮询、释放锁、取消本地网络等待；不得自动取消远端生成。再次启动只恢复查询和下载，不自动发起新的付费生成。

阶段 0 必须使用真实 DSH 安装环境完成最小插件验证：确认版本、原生设置入口或命令替代方案、安全凭据存储、插件入口、manifest、模块格式、工具注册、原生模型/提示词能力、文件路径呈现、确认机制、退出行为。记录实际 SDK 示例与版本到 docs/host-integration.md。若宿主没有长时间运行工具的能力，提交后立即返回 taskId，由后续状态查询恢复；不承诺后台任务。

## 19. 交互验收示例

场景 A：用户输入"生成15秒横屏乡村搞笑视频，两个老人讨论退休金"。DSH 解析意图并使用创意和视频提示词定义，展示对白、镜头、模型能力及费用（未知时明确未知）。用户确认后提交，返回本地 taskId。生成完成后返回本地 MP4 路径。若 DSH 支持媒体预览则附预览，否则仅返回路径。

场景 B：用户输入"只优化这段视频提示词，不生成"。DSH 使用专业提示词定义并返回结果，整个过程不得调用媒体提交工具。

场景 C：用户指定一张参考图生成视频。仅上传该文件；展示上游服务地址及参考图用途；模型不支持图生视频时提供可选模型，不静默切换。

场景 D：生成过程中退出 DSH。重新进入后查询原 taskId；有 remoteId 则继续查询，无 remoteId 且提交结果未知则提示核查，不重新扣费。

## 20. AI 辅助编码实施约束

先实现最小宿主插件与模拟 Provider，再实现真实 Provider；先通过直接生成测试，再增加专业提示词。每个阶段提交可运行代码、测试与 README 更新。禁止虚构 SDK、接口地址、模型 ID、计费字段；未验证协议必须保留显式 TODO 并阻止真实提交。禁止新增独立 Web 服务、Python、Docker、通用 Agent runtime 或 DAG 引擎。所有新依赖须说明用途。真实渠道测试须有用户授权的密钥与预算。V1 发布前必须在真实 DSH 中完成安装、自然语言调用、确认、图片与视频生成、退出恢复、卸载的端到端验收。


## 21. 首次配置与模型管理验收流程

1. 安装并启用插件，在 DSH 中进入 MetaOntic Media 设置（或已验证的命令入口）。
2. 添加服务商，选择图片/视频协议适配器，填写 API 地址与安全凭据引用。
3. 执行非付费连接测试；失败时保留草稿并展示脱敏诊断。
4. 同步模型列表或手动添加真实模型 ID，确认能力后启用。
5. 分别设置默认图片、视频模型；文本模型继续使用 DSH 当前模型。
6. 保存并重启 DSH，验证配置恢复。输入自然语言创作请求，展示默认模型与参数，用户确认后生成。
7. 修改默认模型并发起下一次创作，验证旧任务仍使用原配置，且新模型需重新确认。

## 22. 修订记录

- V1.0-r2：明确 DSH 原生插件架构，移除独立 Agent runtime 和通用工作流引擎。
- V1.0-r3：将模型管理提升为 P0，补充 DSH 内设置入口、Provider/Model/Defaults 三级配置、凭据安全、同步与测试、配置生命周期、目录、工具契约和验收标准。保留原有四个 Agent 完整提示词及图片视频业务设计。

本次仅更新设计文档，未实现代码或验证实际 DSH SDK；设置面板、命令注册及模型协议仍须在阶段 0 验证。
