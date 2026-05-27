# Desktop Agent

一个基于 Tauri + React + TypeScript 构建的桌面助手应用。

## 项目介绍

Desktop Agent 是一个功能强大的桌面助手应用，结合了 AI 聊天对话和本地任务执行能力。它使用 Tauri 作为跨平台框架，提供了轻量级、高性能的桌面应用体验，同时支持对话管理和本地任务执行。

## 功能特性

- 🤖 AI 对话聊天
- 💬 多对话管理（创建、选择、删除对话）
- 📋 任务执行（文件读写、命令执行）
- ⚙️ 配置管理
- 🎨 现代化的用户界面
- 📱 响应式布局
- 🪟 可调整大小的窗口

## 技术栈

- **前端框架**: React 19 + TypeScript
- **桌面框架**: Tauri 2
- **构建工具**: Vite 7
- **样式**: Tailwind CSS 4
- **样式后处理**: PostCSS + Autoprefixer

## 安装和运行说明

### 环境要求

- Node.js (推荐使用最新 LTS 版本)
- Rust (用于 Tauri 编译)
- 操作系统: macOS, Windows, Linux

### 安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd desktop-agent-tauri
```

2. 安装依赖
```bash
npm install
```

### 开发模式运行

启动开发服务器:
```bash
npm run tauri dev
```

这将同时启动前端开发服务器和 Tauri 应用。

### 前端开发
如果只运行前端:
```bash
npm run dev
```

### 构建应用

构建前端:
```bash
npm run build
```

打包桌面应用:
```bash
npm run tauri build
```

## 配置说明

### 应用配置

应用的主要配置文件是 `src-tauri/tauri.conf.json`，包含以下配置项：

- `productName`: 应用名称
- `version`: 应用版本
- `identifier`: 应用标识符
- 窗口配置: 大小、标题、可调整大小等

### API 配置

在设置页面中可以配置后端 API 地址，用于 AI 对话和任务执行。

## 项目结构

```
desktop-agent-tauri/
├── src/                  # 前端源代码
│   ├── components/      # React 组件
│   ├── hooks/        # React hooks
│   ├── services/     # API 服务
│   ├── types/       # TypeScript 类型定义
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/       # Tauri 后端代码
│   ├── src/         # Rust 源代码
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

## 开发建议

- 推荐使用 VS Code 配合以下扩展进行开发：
- Tauri 扩展
- Rust Analyzer
- TypeScript 支持

## License

MIT
