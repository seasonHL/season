# Desktop Agent Code Wiki

本文档集面向后续维护者，基于当前仓库代码整理 Desktop Agent 的架构、模块职责、关键类型与运行方式。

## 文档导航

- [项目概览](./01-project-overview.md): 产品定位、技术栈、目录结构与入口。
- [整体架构](./02-architecture.md): 前端、Tauri 后端、外部 LLM API 与本地能力的边界。
- [模块职责](./03-modules.md): 组件、hooks、service、types、Rust 命令逐模块说明。
- [数据流与关键流程](./04-flows.md): 启动、配置、对话、工具调用确认、任务执行与持久化流程。
- [关键类、类型与函数](./05-api-reference.md): 主要 TypeScript 类型、Rust 数据结构和核心函数速查。
- [依赖关系与运行方式](./06-development.md): 依赖说明、开发运行、构建、配置、安全边界与维护建议。

## 一句话总结

Desktop Agent 是一个基于 Tauri 2 + React 19 + TypeScript 的桌面 AI 助手。前端负责聊天界面、配置页、对话管理和工具调用确认；Rust/Tauri 后端负责本地配置与对话持久化、受限文件读写和受限命令执行；外部 LLM 服务采用 OpenAI-compatible `/chat/completions` 风格，并对包含 `anthropic` 的 Base URL 做了 `/v1/messages` 路径适配。

## 当前主要能力

- 多对话管理: 创建、选择、删除、自动生成标题、按更新时间排序。
- AI 聊天: 读取设置中的 Base URL、API Key、模型名后发起请求。
- 工具调用: 支持 `FileRead`、`FileWrite`、`ExecuteCommand` 三类本地任务。
- 人工确认: LLM 返回工具调用后，前端弹出确认窗口，用户确认后才调用 Tauri 执行。
- 本地持久化: 使用 `tauri-plugin-store` 保存 `config.json` 和 `conversations.json`。

## 重要实现现状

- `src/contexts/ConfigContext.tsx` 是当前组件使用的配置上下文；`src/hooks/useConfig.ts` 也存在一套类似逻辑，但当前主要组件没有直接使用它。
- `src/services/api.ts` 中保留了 `@earendil-works/pi-agent-core` 的 `createAgent` 适配函数，但当前聊天主路径使用的是 `sendChatMessage` + 手动工具确认流程。
- `src-tauri/src/lib.rs` 中注册了 `greet` 命令，但前端当前没有调用。
- Rust 后端只初始化了 `opener`、`store`、`http`、`shell` 插件；`src-tauri/Cargo.toml` 声明了 `tauri-plugin-fs`，但 `run()` 当前未初始化 fs 插件。

