import { AgentMessage as CoreAgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { Static, Type } from "@sinclair/typebox";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const TOOLS: Tool[] = [
  {
    name: "FileRead",
    description: "读取本地文件内容。适用于查看文本文件、配置文件、代码文件等。注意：只返回文本内容，图片等二进制文件无法读取。",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要读取的文件路径，建议使用绝对路径"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "FileWrite",
    description: "写入内容到本地文件。如果文件不存在会创建新文件，如果文件已存在会覆盖原内容。适用于创建或更新文本文件、代码文件、配置文件等。",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要写入的文件路径，建议使用绝对路径"
        },
        content: {
          type: "string",
          description: "要写入的文件内容"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "ExecuteCommand",
    description: "执行系统终端命令。适用于运行脚本、编译代码、安装依赖、git 操作等。支持的命令：echo, ls, cat, pwd, git, node, npm, cargo, python, python3",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "要执行的命令名称，如 'ls', 'git', 'node' 等"
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "命令参数数组，如 ['-la'], ['status'], ['--version'] 等"
        }
      },
      required: ["command", "args"]
    }
  }
];

export const SYSTEM_PROMPT = `你是一个智能桌面助手，可以帮助用户完成各种任务。

## 你的能力
- 读取和理解本地文件内容
- 创建和编辑本地文件
- 执行系统命令（仅限于安全操作）
- 回答问题和进行对话

## 工具使用原则
1. 当用户请求需要执行操作时（读取文件、执行命令等），你应该主动调用相应工具
2. 调用工具时，提供完整准确的参数
3. 工具执行完成后，根据结果向用户汇报
4. 如果工具执行失败，友好地向用户解释错误原因并提供解决方案

## 文件操作安全提示
- 只能访问用户的 Documents、Desktop、Downloads 目录下的文件
- 命令执行仅限于白名单内的命令（ls, cat, git, node, npm 等）
- 禁止执行任何可能损害系统的命令

## 回复格式要求
- 对话内容直接以文本形式回复
- 需要执行操作时，使用工具调用，不要在回复中嵌入 <task> 标签
- 保持回复简洁、有条理，使用中文`;

export interface Config {
  base_url: string;
  api_key: string;
  model: string;
}

export type View = "chat" | "settings";
export interface ChatRequest {
  model: string;
  messages: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
      };
    };
  }>;
  tool_choice?: string | { type: "function"; function: { name: string } };
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
  error?: string;
}

const FileReadSchema = Type.Object({
 type: Type.Literal("FileRead"),
 payload: Type.Object({
 path: Type.String(),
 }),
});
const FileWriteSchema = Type.Object({
 type: Type.Literal("FileWrite"),
 payload: Type.Object({
 path: Type.String(),
 content: Type.String(),
 }),
});
const ExecuteCommandSchema = Type.Object({
 type: Type.Literal("ExecuteCommand"),
 payload: Type.Object({
 command: Type.String(),
 args: Type.Array(Type.String()),
 }),
});
export type TaskActionSchema = typeof FileReadSchema | typeof FileWriteSchema | typeof ExecuteCommandSchema;
export type TaskAction = Static<TaskActionSchema>;
export interface TaskRequest {
 action: TaskAction;
}
export interface TaskResult {
 success: boolean;
 data?: string;
 error?: string;
}
export enum TaskStatus {
 PENDING = "pending",
 EXECUTING = "executing",
 COMPLETED = "completed",
 FAILED = "failed",
}
export interface Task {
 id: string;
 task_request: TaskRequest;
 status: TaskStatus;
 result?: TaskResult;
 created_at: Date;
 updated_at: Date;
}
export interface Conversation {
 id: string;
 title: string;
 messages: Message[];
 tasks: Task[];
 created_at: Date;
 updated_at: Date;
}
export type AgentMessage = CoreAgentMessage;
export type AppAgentTool = AgentTool<TaskActionSchema, TaskResult>;