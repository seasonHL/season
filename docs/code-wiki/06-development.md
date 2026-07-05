# 依赖关系与运行方式

## Node 依赖

主要运行依赖来自 `package.json`:

| 依赖 | 用途 |
| --- | --- |
| `react` / `react-dom` | 前端 UI |
| `@tauri-apps/api` | 前端调用 Tauri commands |
| `@tauri-apps/plugin-opener` | Tauri opener 插件前端 API |
| `@earendil-works/pi-agent-core` | Agent 类型与适配能力 |
| `@sinclair/typebox` | 定义任务 action schema 并推导类型 |
| `@tailwindcss/postcss`、`tailwindcss`、`autoprefixer` | 样式处理 |

主要开发依赖:

- `vite`
- `typescript`
- `@vitejs/plugin-react`
- `@tauri-apps/cli`
- React 类型包

## Rust 依赖

来自 `src-tauri/Cargo.toml`:

| 依赖 | 用途 |
| --- | --- |
| `tauri` | 桌面应用框架 |
| `tauri-plugin-store` | JSON store 持久化 |
| `tauri-plugin-http` | Tauri HTTP 插件 |
| `tauri-plugin-shell` | Shell 权限插件 |
| `tauri-plugin-opener` | 打开外部资源 |
| `tauri-plugin-fs` | 文件系统插件声明，当前未在 `run()` 初始化 |
| `serde` / `serde_json` | 数据结构序列化 |
| `dirs` | 定位用户 Home 目录 |

## 开发环境要求

- Node.js，建议 LTS。
- pnpm。
- Rust toolchain。
- Tauri 2 支持的系统依赖。

## 安装依赖

```bash
pnpm install
```

## 启动前端开发服务器

```bash
pnpm dev
```

Vite dev server 固定端口为 `1420`，配置在 `vite.config.ts`。

## 启动 Tauri 桌面应用

```bash
pnpm tauri dev
```

Tauri 配置中的 `beforeDevCommand` 当前是:

```bash
npm run dev
```

这意味着即使项目使用 pnpm，Tauri dev 会通过 npm 脚本启动 Vite。若团队希望统一包管理器，可以考虑改为 `pnpm dev`。

## 构建前端

```bash
pnpm build
```

该脚本先运行 TypeScript 编译检查，再执行 Vite 构建:

```bash
tsc && vite build
```

## 打包桌面应用

```bash
pnpm tauri build
```

Tauri 构建配置:

- `beforeBuildCommand`: `npm run build`
- `frontendDist`: `../dist`
- bundle targets: `all`

## 配置说明

应用配置由设置页写入 `config.json`:

- `Base URL`: LLM API 地址。
- `API Key`: 作为 Bearer Token 发送。
- `模型名称`: 传入请求体的 `model`。

URL 拼接规则:

- `https://api.example.com` -> `https://api.example.com/chat/completions`
- `https://api.example.com/anthropic` -> `https://api.example.com/anthropic/v1/messages`

## 本地任务安全限制

### 文件路径

绝对路径只允许:

- `~/Documents`
- `~/Desktop`
- `~/Downloads`

相对路径当前允许，并以应用进程工作目录解析。若需要更严格安全模型，建议后续明确禁止相对路径或将其规范化后再判断。

### 命令白名单

允许命令:

```text
echo, ls, cat, pwd, git, node, npm, cargo, python, python3
```

禁止参数:

```text
-e, -c, --eval, -exec, --execute
```

同时禁止 `-e=` 和 `-c=` 前缀。

## 维护建议

- 如果继续以 OpenAI-compatible tool calls 为主，可以删除或隔离 `<task>` 文本协议相关函数，避免双协议混淆。
- 如果要正式支持 Anthropic 原生响应，需要修正 `sendChatMessage()` 中 `tool_use` 解析分支并补充测试。
- `useConfig.ts` 与 `ConfigContext.tsx` 有重复职责，建议保留一种配置来源。
- `TaskExecution` 组件当前不是主渲染路径，可以考虑接入或移除。
- `tauri-plugin-fs` 在 Cargo 中声明但未初始化，若不使用可移除依赖；若要使用其前端 API，应在 `run()` 中初始化。
- Tauri 配置中的 `npm run dev/build` 与仓库 pnpm 工作流不完全一致，可统一为 pnpm。

