# 数据流与关键流程

## 应用启动流程

```mermaid
sequenceDiagram
  participant Main as src/main.tsx
  participant Config as ConfigProvider
  participant App as App
  participant Conv as useConversations
  participant Rust as Tauri commands

  Main->>Config: render ConfigProvider
  Config->>Rust: invoke("load_config")
  Main->>App: render App
  App->>Conv: useConversations()
  Conv->>Rust: invoke("load_conversations")
  Rust-->>Conv: conversations
  App->>Conv: select first or create new
```

## 配置保存流程

```mermaid
sequenceDiagram
  participant Settings
  participant Config as ConfigContext
  participant Rust as save_config
  participant Store as config.json

  Settings->>Config: saveConfig({ base_url, api_key, model })
  Config->>Rust: invoke("save_config", { config })
  Rust->>Store: set base_url/api_key/model
  Rust->>Store: save()
  Config-->>Settings: update local config
```

## 普通聊天流程

```mermaid
sequenceDiagram
  participant User
  participant Chat as ChatArea
  participant API as sendChatMessage
  participant LLM as External LLM API

  User->>Chat: 输入消息并发送
  Chat->>Chat: 追加 user message
  Chat->>API: sendChatMessage(config, ChatRequest)
  API->>LLM: POST /chat/completions
  LLM-->>API: assistant content
  API-->>Chat: ChatResponse
  Chat->>Chat: 追加 assistant message
  Chat->>App: onSaveConversation(messages, tasks)
```

## 工具调用与本地任务执行流程

```mermaid
sequenceDiagram
  participant User
  participant Chat as ChatArea
  participant API as sendChatMessage
  participant Confirm as TaskConfirmation
  participant TaskHook as useTaskExecutor
  participant Rust as execute_task
  participant Local as Local FS/Shell

  User->>Chat: 发送请求
  Chat->>API: 请求 LLM，携带 tools
  API-->>Chat: assistant message + tool_calls
  Chat->>Chat: parseToolCallToTaskRequest()
  Chat->>Confirm: 显示待执行任务
  User->>Confirm: 确认执行
  Confirm->>Chat: onConfirm()
  Chat->>TaskHook: executeTask(action)
  TaskHook->>Rust: invoke("execute_task", { request })
  Rust->>Rust: is_path_safe 或 is_command_allowed
  Rust->>Local: read/write/command
  Local-->>Rust: output/error
  Rust-->>TaskHook: TaskResult
  TaskHook-->>Chat: result
  Chat->>Chat: 生成 tool message
  Chat->>API: 携带 tool message 继续请求
```

## 对话保存流程

`ChatArea` 不直接调用 Tauri 保存。它通过 `onSaveConversation(messages, tasks)` 将最新状态交给 `App`:

1. `ChatArea` 内部消息或任务变化后调用 `onSaveConversation`。
2. `App` 将其暂存在 `pendingMessages` / `pendingTasks`。
3. 用户切换视图、新建对话、切换对话或窗口卸载时，`App.savePendingChanges()` 调用 `useConversations.saveConversation()`。
4. `saveConversation()`:
   - 用第一条消息生成标题。
   - 更新 `updated_at`。
   - 将 Date 转为 ISO 字符串。
   - 调用 Tauri `save_conversation`。
   - 更新本地对话列表并按更新时间排序。

## Store 数据形状

### `config.json`

```json
{
  "base_url": "https://api.example.com",
  "api_key": "sk-...",
  "model": "deepseek-v4-pro"
}
```

### `conversations.json`

```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "新对话",
      "messages": [],
      "tasks": [],
      "created_at": "2026-07-01T00:00:00.000Z",
      "updated_at": "2026-07-01T00:00:00.000Z"
    }
  ]
}
```

## 任务状态流转

```mermaid
stateDiagram-v2
  [*] --> pending: LLM tool call parsed
  pending --> executing: user confirms
  executing --> completed: TaskResult.success = true
  executing --> failed: TaskResult.success = false
  completed --> [*]
  failed --> [*]
```

当前 `ChatArea` 创建任务时直接进入 `EXECUTING`，确认弹窗中的 pending 状态主要存在于前端局部 `pendingToolCalls`。

