import type { AgentToolCall, AgentToolDefinition } from "@season/agent-core";
import type { TaskRequest } from "../types";

export const toolDefinitions: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "FileRead",
      description:
        "读取本地文件内容。适用于查看文本文件、配置文件、代码文件等。注意：只返回文本内容，图片等二进制文件无法读取。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要读取的文件路径，建议使用绝对路径",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "FileWrite",
      description:
        "写入内容到本地文件。如果文件不存在会创建新文件，如果文件已存在会覆盖原内容。适用于创建或更新文本文件、代码文件、配置文件等。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要写入的文件路径，建议使用绝对路径",
          },
          content: {
            type: "string",
            description: "要写入的文件内容",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ExecuteCommand",
      description:
        "执行系统终端命令。适用于运行脚本、编译代码、安装依赖、git 操作等。支持的命令：echo, ls, cat, pwd, git, node, npm, cargo, python, python3",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "要执行的命令名称，如 'ls', 'git', 'node' 等",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "命令参数数组，如 ['-la'], ['status'], ['--version'] 等",
          },
        },
        required: ["command", "args"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "MemoryRead",
      description:
        "读取本地长期记忆。仅当用户询问你记得什么、要求回忆偏好或需要确认已保存信息时使用。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "MemoryWrite",
      description:
        "把用户明确要求记住的稳定偏好、个人信息或项目上下文写入长期记忆。不要保存敏感信息，除非用户明确要求。",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "要保存到长期记忆的一条简洁事实或偏好",
          },
        },
        required: ["content"],
      },
    },
  },
];

export function parseToolCallToTaskRequest(
  toolCall: AgentToolCall
): TaskRequest | null {
  try {
    const { name, arguments: argsStr } = toolCall.function;
    const args = JSON.parse(argsStr);

    switch (name) {
      case "FileRead":
        if (!args.path) return null;
        return {
          action: {
            type: "FileRead",
            payload: { path: args.path },
          },
        };

      case "FileWrite":
        if (!args.path || !args.content) return null;
        return {
          action: {
            type: "FileWrite",
            payload: {
              path: args.path,
              content: args.content,
            },
          },
        };

      case "ExecuteCommand":
        if (!args.command) return null;
        return {
          action: {
            type: "ExecuteCommand",
            payload: {
              command: args.command,
              args: args.args || [],
            },
          },
        };

      case "MemoryRead":
        return {
          action: {
            type: "MemoryRead",
            payload: {},
          },
        };

      case "MemoryWrite":
        if (!args.content) return null;
        return {
          action: {
            type: "MemoryWrite",
            payload: {
              content: args.content,
            },
          },
        };

      default:
        console.warn(`Unknown tool name: ${name}`);
        return null;
    }
  } catch (error) {
    console.error("Failed to parse tool call:", error);
    return null;
  }
}
