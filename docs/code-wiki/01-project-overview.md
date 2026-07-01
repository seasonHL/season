# 项目概览

## 项目定位

Desktop Agent 是一个桌面端 AI 助手应用，目标是把聊天式 AI 交互与本地任务执行结合起来。用户可以进行普通对话，也可以让模型提出文件读写或命令执行类操作；这些操作会先进入确认弹窗，用户确认后才由 Tauri 后端在本机执行。

## 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 桌面容器 | Tauri 2 | 跨平台桌面应用壳与 Rust 命令桥接 |
| 前端 | React 19 + TypeScript | 聊天、设置、对话列表与任务确认界面 |
| 构建 | Vite 7 | 前端开发服务器与生产构建 |
| 样式 | Tailwind CSS 4 + PostCSS | 通过 utility class 构建界面 |
| 本地存储 | `tauri-plugin-store` | 保存 API 配置和对话历史 |
| 本地执行 | Rust `std::fs` / `std::process::Command` | 受限文件读写与命令执行 |
| Agent/工具类型 | `@earendil-works/pi-agent-core`、TypeBox | Agent 类型、工具 schema 类型定义 |

## 仓库目录

```text
.
├── src/                         # React 前端源码
│   ├── components/              # UI 组件
│   ├── contexts/                # React Context
│   ├── hooks/                   # 状态与 Tauri 调用 hooks
│   ├── services/                # LLM API 与工具转换逻辑
│   ├── types/                   # TypeScript 业务类型与工具定义
│   ├── App.tsx                  # 前端应用主组件
│   ├── main.tsx                 # React 挂载入口
│   └── index.css                # 全局样式
├── src-tauri/                   # Tauri/Rust 后端
│   ├── src/
│   │   ├── main.rs              # Rust 二进制入口
│   │   └── lib.rs               # Tauri Builder、命令与本地能力实现
│   ├── capabilities/default.json# Tauri 权限能力声明
│   ├── tauri.conf.json          # Tauri 应用、窗口、构建配置
│   └── Cargo.toml               # Rust 依赖
├── package.json                 # Node 依赖与脚本
├── vite.config.ts               # Vite/Tauri dev server 配置
├── tailwind.config.js           # Tailwind 扫描与主题扩展
└── README.md                    # 项目基础说明
```

## 应用入口

- 前端入口: `src/main.tsx`
  - 使用 `ReactDOM.createRoot` 挂载到 `#root`。
  - 外层包裹 `ConfigProvider`，让聊天和设置页共享 API 配置。
- 前端主组件: `src/App.tsx`
  - 维护当前视图 `chat | settings`。
  - 接入 `useConversations()` 管理当前会话。
  - 在切换视图、新建或切换对话前保存待保存的 messages/tasks。
- Rust 入口: `src-tauri/src/main.rs`
  - 调用 `tauri_app_lib::run()`。
- Tauri 命令入口: `src-tauri/src/lib.rs`
  - 初始化插件。
  - 注册 `save_config`、`load_config`、`execute_task`、`save_conversation` 等命令。

