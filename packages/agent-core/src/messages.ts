import type {
  AgentChatMessage,
  AgentMessage,
  AgentToolCall,
  AgentToolResult,
} from "./types";

/**
 * 创建一条助手消息。
 *
 * 当模型只返回工具调用但没有文本内容时，使用默认文案方便前端展示。
 */
export function createAssistantMessage(
  input: {
    content?: string;
    toolCalls?: AgentToolCall[];
    reasoningContent?: string;
  },
  createId: () => string = defaultCreateId
): AgentMessage {
  return {
    id: createId(),
    role: "assistant",
    content: input.content || "正在执行工具...",
    timestamp: new Date(),
    tool_calls: input.toolCalls,
    reasoning_content: input.reasoningContent,
  };
}

/**
 * 将工具执行结果包装成模型可继续理解的 tool 消息。
 */
export function createToolMessage(
  toolCall: AgentToolCall,
  result: AgentToolResult,
  createId: () => string = defaultCreateId
): AgentMessage {
  return {
    id: createId(),
    role: "tool",
    content: result.success
      ? result.data || "操作成功完成"
      : `错误: ${result.error || "未知错误"}`,
    timestamp: new Date(),
    tool_call_id: toolCall.id,
  };
}

/**
 * 把本地消息历史转换为 OpenAI-compatible 的 chat messages。
 *
 * 本地消息包含 id、timestamp 等展示字段；发送给 Provider 前会在这里剥离。
 */
export function toChatMessages(
  systemPrompt: string,
  messages: AgentMessage[]
): AgentChatMessage[] {
  const systemMessage: AgentChatMessage = {
    role: "system",
    content: systemPrompt,
  };

  return [
    systemMessage,
    ...messages.map((message) => {
      const chatMessage: AgentChatMessage = {
        role: message.role,
        content: message.content,
      };

      if (message.role === "assistant" && message.tool_calls) {
        /**
         * 带工具调用的 assistant 消息允许 content 为 null。
         */
        chatMessage.content = message.content || null;
        chatMessage.tool_calls = message.tool_calls;
      }

      if (message.role === "tool" && message.tool_call_id) {
        chatMessage.tool_call_id = message.tool_call_id;
      }

      if (message.role === "assistant" && message.reasoning_content) {
        chatMessage.reasoning_content = message.reasoning_content;
      }

      return chatMessage;
    }),
  ].filter(
    (message) =>
      message.content ||
      message.tool_calls ||
      message.tool_call_id ||
      message.reasoning_content
  );
}

/**
 * 默认消息 id 生成器。
 */
export function defaultCreateId(): string {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}
