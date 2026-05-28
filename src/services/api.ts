import { Agent, AgentEvent, convertToLlm, type AgentMessage } from "@earendil-works/pi-agent-core";
import { ChatRequest, ChatResponse, TaskAction, TaskRequest, TaskResult, TOOLS, SYSTEM_PROMPT, ToolCall } from "../types";
import { invoke } from "@tauri-apps/api/core";

export type { AgentEvent };

export const buildApiUrl = (baseUrl: string): string => {
  if (!baseUrl) return "";
  let url = baseUrl.trim();
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  if (url.includes("anthropic")) {
    return `${url}/v1/messages`;
  }
  return `${url}/chat/completions`;
};

export const convertToolsToOpenAIFormat = () => {
  return TOOLS.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.parameters.properties,
        required: tool.parameters.required || []
      }
    }
  }));
};

export const sendChatMessage = async (
  baseUrl: string,
  apiKey: string,
  request: ChatRequest
): Promise<ChatResponse> => {
  try {
    if (!baseUrl) {
      return {
        content: "",
        error: "请先在设置页面配置 API 地址"
      };
    }

    const apiUrl = buildApiUrl(baseUrl);
    console.log(`构建的 API URL: ${apiUrl}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const requestBody: Record<string, any> = {
      model: request.model,
      messages: request.messages,
      stream: request.stream ?? false
    };

    if (request.tools && request.tools.length > 0) {
      requestBody.tools = request.tools;
      requestBody.tool_choice = request.tool_choice || "auto";
    }

    console.log(`API 请求头:`, headers);
    console.log(`API 请求体:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API 响应错误 - 状态码: ${response.status}`);
      console.error(`API 响应内容: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let content = "";
    let toolCalls: ToolCall[] | undefined;

    if (typeof data === "string") {
      content = data;
    }
    else if (data.content && Array.isArray(data.content)) {
      const textContent = data.content.find((c: any) => c.type === "text");
      content = textContent?.text || "";
      
      const toolUse = data.content.find((c: any) => c.type === "tool_use");
      if (toolUse) {
        toolCalls = toolUse.map((t: any) => ({
          id: t.id,
          type: "function",
          function: {
            name: t.name,
            arguments: typeof t.input === "string" ? t.input : JSON.stringify(t.input)
          }
        }));
      }
    }
    else if (data.choices && data.choices[0]?.message) {
      const message = data.choices[0].message;
      content = message.content || "";
      
      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        toolCalls = message.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === "string" 
              ? tc.function.arguments 
              : JSON.stringify(tc.function.arguments)
          }
        }));
      }
    }
    else {
      throw new Error("Invalid response format");
    }

    return { content, tool_calls: toolCalls };
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: "",
      error: errorMessage
    };
  }
};

export const parseToolCallToTaskRequest = (toolCall: ToolCall): TaskRequest | null => {
  try {
    const { name, arguments: argsStr } = toolCall.function;
    const args = JSON.parse(argsStr);

    switch (name) {
      case "FileRead":
        if (!args.path) return null;
        return {
          action: {
            type: "FileRead",
            payload: { path: args.path }
          }
        };

      case "FileWrite":
        if (!args.path || !args.content) return null;
        return {
          action: {
            type: "FileWrite",
            payload: {
              path: args.path,
              content: args.content
            }
          }
        };

      case "ExecuteCommand":
        if (!args.command) return null;
        return {
          action: {
            type: "ExecuteCommand",
            payload: {
              command: args.command,
              args: args.args || []
            }
          }
        };

      default:
        console.warn(`Unknown tool name: ${name}`);
        return null;
    }
  }
  catch (error) {
    console.error("Failed to parse tool call:", error);
    return null;
  }
};

export const parseTaskFromResponse = (content: string): TaskRequest | null => {
  try {
    const taskRegex = /<task>([\s\S]*?)<\/task>/;
    const match = content.match(taskRegex);
    if (!match) {
      return null;
    }
    const taskJson = JSON.parse(match[1].trim());
    let action: TaskAction;
    switch (taskJson.type) {
      case "FileRead":
        action = {
          type: "FileRead",
          payload: { path: taskJson.path }
        };
        break;
      case "FileWrite":
        action = {
          type: "FileWrite",
          payload: {
            path: taskJson.path,
            content: taskJson.content
          }
        };
        break;
      case "ExecuteCommand":
        action = {
          type: "ExecuteCommand",
          payload: {
            command: taskJson.command,
            args: taskJson.args || []
          }
        };
        break;
      default:
        return null;
    }
    return { action };
  }
  catch {
    return null;
  }
};

export const extractTextWithoutTask = (content: string): string => {
  return content.replace(/<task>[\s\S]*?<\/task>/, "").trim();
};

const executeTaskAction = async (action: TaskAction): Promise<TaskResult> => {
  try {
    const request: TaskRequest = { action };
    const result = await invoke<TaskResult>('execute_task', { request });
    return result;
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const createAgent = (apiKey: string, onEvent: (event: AgentEvent) => void) => {
  const agent = new Agent({
    convertToLlm: (messages: AgentMessage[]) => convertToLlm(messages),
    getApiKey: () => apiKey,
    toolExecution: "sequential",
    beforeToolCall: async (context) => {
      console.log("准备执行工具:", context.toolCall);
      return undefined;
    },
    afterToolCall: async (context) => {
      console.log("工具执行完成:", context.result);
      return undefined;
    },
  });
  const unsubscribe = agent.subscribe((event) => {
    onEvent(event);
  });
  return { agent, unsubscribe };
};

export const executeTaskWithAgent = async (action: TaskAction): Promise<TaskResult> => {
  return executeTaskAction(action);
};

export const createToolMessage = (
  toolCallId: string,
  toolName: string,
  result: TaskResult
) => ({
  role: "tool" as const,
  content: result.success 
    ? result.data || "操作成功完成"
    : `错误: ${result.error || "未知错误"}`,
  tool_call_id: toolCallId
});

export {
  TOOLS,
  SYSTEM_PROMPT
};
