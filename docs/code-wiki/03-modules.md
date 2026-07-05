# 模块职责

## `src/App.tsx`

应用主协调组件。

- 状态:
  - `currentView`: 当前为聊天页或设置页。
  - `pendingMessages` / `pendingTasks`: ChatArea 上报但尚未写入 store 的会话变更。
- 依赖:
  - `useConversations()` 提供对话 CRUD。
  - `Sidebar` 负责导航。
  - `ChatArea` 负责聊天。
  - `Settings` 负责配置。
- 关键行为:
  - 首次加载时，如果没有当前对话则选择已有第一条，或创建新对话。
  - 切换视图、新建对话、切换对话前调用 `savePendingChanges()`。
  - `beforeunload` 时尝试保存待保存变更。

## `src/main.tsx`

React 挂载入口。

- 将 `App` 包裹在 `ConfigProvider` 中。
- 引入全局样式 `index.css`。

## `src/contexts/ConfigContext.tsx`

全局配置上下文。

- 保存 `Config`:
  - `base_url`
  - `api_key`
  - `model`
- 通过 Tauri 命令:
  - `load_config`
  - `save_config`
- 导出:
  - `ConfigProvider`
  - `useConfigContext()`

## `src/hooks/useConfig.ts`

独立配置 hook。功能与 `ConfigContext` 接近，但当前主要组件使用的是 `useConfigContext()`。如果后续要减少重复，可以考虑合并或删除未使用实现。

## `src/hooks/useConversations.ts`

对话持久化与选择状态管理。

- `loadConversations()`: 调用 `load_conversations`，加载后转换日期并按 `updated_at` 倒序排序。
- `createConversation()`: 生成新对话，立即调用 `save_conversation` 持久化。
- `selectConversation(id)`: 调用 `load_conversation` 并设为当前对话。
- `saveConversation(conversation, messages, tasks)`: 自动生成标题、序列化日期、保存并更新本地列表。
- `deleteConversation(id)`: 调用 `delete_conversation`，删除后重新加载列表。

## `src/hooks/useTaskExecutor.ts`

本地任务执行 hook。

- `executeTask(action)`: 直接调用 Tauri `execute_task`。
- `executeTaskAgent(action)`: 调用 `executeTaskWithAgent()`，目前最终也委托到 Tauri `execute_task`。

## `src/services/api.ts`

LLM API 与工具转换模块。

- URL 与请求:
  - `buildApiUrl(baseUrl)`
  - `sendChatMessage(baseUrl, apiKey, request)`
- 工具定义转换:
  - `convertToolsToOpenAIFormat()`
- 工具调用解析:
  - `parseToolCallToTaskRequest(toolCall)`
  - `parseTaskFromResponse(content)`，兼容旧式 `<task>...</task>` 文本协议。
  - `extractTextWithoutTask(content)`，移除旧式 task 标签。
- Agent 适配:
  - `createAgent(apiKey, onEvent)`
  - `executeTaskWithAgent(action)`
  - `createToolMessage(toolCallId, toolName, result)`

## `src/types/index.ts`

业务类型、工具定义和系统提示词集中地。

- 对话相关:
  - `Message`
  - `ToolCall`
  - `Conversation`
- 配置与 API:
  - `Config`
  - `ChatRequest`
  - `ChatResponse`
- 任务相关:
  - `TaskAction`
  - `TaskRequest`
  - `TaskResult`
  - `TaskStatus`
  - `Task`
- LLM 工具:
  - `TOOLS`
  - `SYSTEM_PROMPT`

## `src/components/Sidebar.tsx`

左侧导航栏。

- 显示应用标题、对话历史和设置入口。
- 支持新建对话、选择对话、删除对话。
- 根据更新时间格式化显示时间。

## `src/components/ChatArea.tsx`

聊天主界面和工具执行编排核心。

- 管理消息、任务、输入框、loading、错误提示。
- 发送用户消息后调用 `continueConversation()`。
- LLM 返回普通回复时追加 assistant message。
- LLM 返回 tool calls 时:
  - 追加包含 `tool_calls` 的 assistant message。
  - 将 tool calls 转换为 `TaskRequest`。
  - 弹出 `TaskConfirmation`。
- 用户确认后:
  - 依次调用 `executeTask()`。
  - 生成 tool role 消息。
  - 更新任务状态。
  - 再次调用 `continueConversation()`，让模型基于工具结果继续回答。

## `src/components/TaskConfirmation.tsx`

工具调用确认弹窗。

- 按任务类型展示图标、颜色、操作说明和参数。
- 支持批量确认或全部拒绝。
- 当前支持展示:
  - 文件读取路径
  - 文件写入路径与内容
  - 命令与参数

## `src/components/TaskExecution.tsx`

任务执行结果展示卡片。

- 根据 `TaskStatus` 展示状态图标和文案。
- 展示成功输出或失败错误。
- 当前文件中定义了组件，但 `ChatArea` 主要以内联工具结果气泡展示执行状态。

## `src/components/Settings.tsx`

配置页。

- 编辑并保存:
  - Base URL
  - API Key
  - 模型名称
- 调用 `useConfigContext().saveConfig()`。
- 保存成功后显示短暂成功提示。

## `src-tauri/src/lib.rs`

Tauri 后端核心。

- 数据结构:
  - `Config`
  - `TaskAction`
  - `TaskRequest`
  - `TaskResult`
  - `Message`
  - `Task`
  - `Conversation`
- 命令:
  - `save_config`
  - `load_config`
  - `execute_task`
  - `save_conversation`
  - `load_conversations`
  - `load_conversation`
  - `delete_conversation`
  - `greet`
- 辅助校验:
  - `is_command_allowed`
  - `is_path_safe`
- 启动:
  - `run()` 初始化插件并注册命令。

