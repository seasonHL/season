# 关键类、类型与函数

## TypeScript 类型

### `Message`

位置: `src/types/index.ts`

表示聊天消息。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 前端生成的 UUID |
| `role` | `"user" \| "assistant" \| "system" \| "tool"` | 消息角色 |
| `content` | `string` | 文本内容 |
| `timestamp` | `Date` | 本地时间 |
| `tool_calls` | `ToolCall[]?` | assistant 发起的工具调用 |
| `tool_call_id` | `string?` | tool 消息对应的调用 ID |
| `reasoning_content` | `string?` | 模型返回的思考内容字段 |

### `ToolCall`

OpenAI function tool call 形状。

```ts
interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}
```

### `TaskAction`

由 TypeBox schema 推导出的联合类型，支持三类动作:

- `FileRead`: `{ path }`
- `FileWrite`: `{ path, content }`
- `ExecuteCommand`: `{ command, args }`

序列化形状使用 tag/content 风格:

```json
{
  "type": "FileRead",
  "payload": {
    "path": "/Users/name/Documents/file.txt"
  }
}
```

### `Task`

记录一次本地任务执行。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | UUID |
| `task_request` | `TaskRequest` | 任务请求 |
| `status` | `TaskStatus` | `pending`、`executing`、`completed`、`failed` |
| `result` | `TaskResult?` | 执行结果 |
| `created_at` | `Date` | 创建时间 |
| `updated_at` | `Date` | 更新时间 |

### `Conversation`

会话聚合根。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | UUID |
| `title` | `string` | 会话标题，默认或由首条消息生成 |
| `messages` | `Message[]` | 消息列表 |
| `tasks` | `Task[]` | 任务列表 |
| `created_at` | `Date` | 创建时间 |
| `updated_at` | `Date` | 更新时间 |

## 工具定义

`TOOLS` 定义了暴露给 LLM 的三个工具:

| 工具 | 参数 | 后端动作 |
| --- | --- | --- |
| `FileRead` | `path` | 读取文本文件 |
| `FileWrite` | `path`, `content` | 写入文本内容 |
| `ExecuteCommand` | `command`, `args` | 执行白名单命令 |

`SYSTEM_PROMPT` 规定助手能力、安全提示和中文回复格式。前端每次请求都会将它作为 system message 放在消息列表前。

## `src/services/api.ts`

### `buildApiUrl(baseUrl)`

规范化 Base URL:

- 空字符串返回空字符串。
- 去掉结尾 `/`。
- 包含 `anthropic` 时拼接 `/v1/messages`。
- 其他情况拼接 `/chat/completions`。

### `convertToolsToOpenAIFormat()`

将内部 `TOOLS` 转为 OpenAI-compatible `tools` 数组:

```ts
{
  type: "function",
  function: {
    name,
    description,
    parameters
  }
}
```

### `sendChatMessage(baseUrl, apiKey, request)`

发送 LLM 请求并兼容解析几类响应:

- 字符串响应。
- Anthropic-like `content: [{ type: "text" }, { type: "tool_use" }]`。
- OpenAI-like `choices[0].message`。

返回统一 `ChatResponse`:

```ts
{
  content: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
  error?: string;
}
```

注意: 当前 Anthropic-like `tool_use` 解析分支中使用了 `data.content.find(...)` 后再 `.map(...)` 的写法，实际若 `toolUse` 是单个对象会有风险。若后续重点支持 Anthropic 响应，应优先修正并补测试。

### `parseToolCallToTaskRequest(toolCall)`

将 `ToolCall.function.name` 与 JSON 参数转换为内部 `TaskRequest`。未知工具、缺少必填参数或 JSON 解析失败时返回 `null`。

### `parseTaskFromResponse(content)` / `extractTextWithoutTask(content)`

兼容旧式 `<task>...</task>` 文本协议。当前主路径使用 OpenAI tool calls，这两个函数更像兼容遗留实现。

### `executeTaskWithAgent(action)`

当前直接委托给内部 `executeTaskAction()`，最终调用 Tauri `execute_task`。

### `createAgent(apiKey, onEvent)`

创建 `@earendil-works/pi-agent-core` 的 `Agent` 实例并订阅事件。当前聊天主路径没有直接使用该 agent 驱动完整对话。

## `src/hooks/useConversations.ts`

### `loadConversations()`

从 Rust store 加载所有对话，处理日期字段，并按更新时间倒序排序。

### `createConversation()`

创建空会话:

- `id`: `crypto.randomUUID()`
- `title`: `新对话`
- `messages`: `[]`
- `tasks`: `[]`

创建后立即调用 `save_conversation`，并插入本地列表头部。

### `saveConversation(conversation, messages, tasks)`

保存会话并更新本地状态:

- 用第一条消息截取 30 个字符作为标题。
- 更新时间为当前时间。
- Date 字段序列化为 ISO 字符串。
- 调用 `save_conversation`。
- 更新本地列表并排序。

## Rust 命令

位置: `src-tauri/src/lib.rs`

### `save_config(app, config)`

保存 `base_url`、`api_key`、`model` 到 `config.json`。

### `load_config(app)`

读取配置，缺省值:

- `base_url`: `""`
- `api_key`: `""`
- `model`: `"deepseek-v4-pro"`

### `execute_task(request)`

根据 `TaskAction` 执行本地能力:

- `FileRead`: `fs::read_to_string`
- `FileWrite`: `fs::write`
- `ExecuteCommand`: `std::process::Command::new(command).args(args).output()`

所有分支返回 `TaskResult`，而不是抛出异常给前端。

### `save_conversation(app, conversation)`

读取 `conversations.json` 中的数组，按 `id` upsert 对话，然后保存。

### `load_conversations(app)`

读取并返回所有对话。排序在前端完成。

### `load_conversation(app, id)`

按 `id` 查找单个对话，未找到返回 `"Conversation not found"`。

### `delete_conversation(app, id)`

过滤掉指定 `id` 并保存。

### `is_path_safe(path)`

绝对路径必须位于用户 Home 下:

- `Documents`
- `Desktop`
- `Downloads`

相对路径当前直接允许。

### `is_command_allowed(command, args)`

命令必须在白名单内，同时参数不能包含危险执行选项。
