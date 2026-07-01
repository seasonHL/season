export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

/**
 * 模型返回的函数调用描述。
 */
export interface AgentToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 应用内部保存的完整消息。
 */
export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: Date;
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

/**
 * 工具执行后的标准结果。
 */
export interface AgentToolResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * 发送给 Provider 的最小消息结构。
 *
 * 本地专用字段如 id、timestamp 会在转换时被剥离。
 */
export interface AgentChatMessage {
  role: AgentMessageRole;
  content: string | null;
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

/**
 * OpenAI-compatible 的工具定义。
 */
export interface AgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * Provider 请求参数。
 */
export interface AgentProviderRequest {
  model: string;
  messages: AgentChatMessage[];
  tools?: AgentToolDefinition[];
  tool_choice?: string | { type: "function"; function: { name: string } };
  stream?: boolean;
}

/**
 * Provider 返回的标准响应。
 */
export interface AgentProviderResponse {
  content: string;
  tool_calls?: AgentToolCall[];
  reasoning_content?: string;
}

/**
 * 模型服务适配器。
 *
 * 具体 API 的 URL、鉴权、响应格式差异都应收敛在 Provider 内部。
 */
export interface AgentProvider {
  name: string;
  complete(request: AgentProviderRequest): Promise<AgentProviderResponse>;
}

/**
 * 已解析为应用层任务的工具调用。
 */
export interface AgentToolCallRequest<TTaskRequest> {
  toolCall: AgentToolCall;
  taskRequest: TTaskRequest;
}

/**
 * 单轮 Agent 执行结果。
 */
export interface AgentTurnResult<TTaskRequest> {
  assistantMessage?: AgentMessage;
  toolCalls: Array<AgentToolCallRequest<TTaskRequest>>;
  messages: AgentMessage[];
  answer?: string;
}

/**
 * Agent 初始化参数。
 *
 * TTaskRequest 允许上层应用把通用函数调用映射成自己的可执行任务格式，
 * 避免 agent-core 依赖桌面端的具体动作类型。
 */
export interface AgentOptions<TTaskRequest> {
  model: string;
  provider: AgentProvider;
  systemPrompt: string;
  tools?: AgentToolDefinition[];
  initialMessages?: AgentMessage[];
  maxIterations?: number;
  parseToolCall?: (toolCall: AgentToolCall) => TTaskRequest | null;
  createId?: () => string;
}
