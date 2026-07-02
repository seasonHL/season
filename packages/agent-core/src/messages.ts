import type {
  AgentChatMessage,
  AgentContextCompactionOptions,
  AgentMessage,
  AgentToolCall,
  AgentToolResult,
} from "./types";

const DEFAULT_PRESERVE_RECENT_TOOL_RESULTS = 4;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 12_000;
const DEFAULT_MAX_TOTAL_MESSAGE_CHARS = 160_000;
const DEFAULT_TRUNCATED_MARKER = "[truncated: tool output exceeded context limit]";
const DEFAULT_COMPACTED_MARKER = "[compacted: old tool output removed to free context]";

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
  messages: AgentMessage[],
  compaction: AgentContextCompactionOptions = {}
): AgentChatMessage[] {
  const systemMessage: AgentChatMessage = {
    role: "system",
    content: systemPrompt,
  };

  return [
    systemMessage,
    ...compactMessagesForContext(messages, compaction).map((message) => {
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

function compactMessagesForContext(
  messages: AgentMessage[],
  options: AgentContextCompactionOptions
): AgentMessage[] {
  if (options.enabled === false) return messages;

  const preserveRecentToolResults =
    options.preserveRecentToolResults ?? DEFAULT_PRESERVE_RECENT_TOOL_RESULTS;
  const maxToolResultChars = options.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
  const maxTotalMessageChars = options.maxTotalMessageChars ?? DEFAULT_MAX_TOTAL_MESSAGE_CHARS;
  const truncatedMarker = options.truncatedMarker ?? DEFAULT_TRUNCATED_MARKER;
  const compactedMarker = options.compactedMarker ?? DEFAULT_COMPACTED_MARKER;
  const compacted = messages.map((message) => ({ ...message }));
  let seenRecentToolResults = 0;

  for (let index = compacted.length - 1; index >= 0; index--) {
    const message = compacted[index];
    if (message.role !== "tool") continue;

    seenRecentToolResults += 1;
    if (seenRecentToolResults <= preserveRecentToolResults) continue;

    if (message.content.length > maxToolResultChars) {
      message.content = truncateToolResult(message.content, maxToolResultChars, truncatedMarker);
    }
  }

  let totalChars = estimateMessageChars(compacted);
  if (totalChars <= maxTotalMessageChars) return compacted;

  for (const message of compacted) {
    if (totalChars <= maxTotalMessageChars) break;
    if (message.role !== "tool") continue;
    if (message.content === compactedMarker) continue;

    const previousLength = message.content.length;
    message.content = compactedMarker;
    totalChars -= Math.max(0, previousLength - compactedMarker.length);
  }

  return compacted;
}

function truncateToolResult(content: string, maxChars: number, marker: string): string {
  if (content.length <= maxChars) return content;

  const target = Math.max(0, maxChars - marker.length - 2);
  const preferredCut = Math.floor(target * 0.7);
  const newlineIndex = content.lastIndexOf("\n", preferredCut);
  const cutIndex = newlineIndex > target * 0.5 ? newlineIndex : target;

  return `${content.slice(0, cutIndex).trimEnd()}\n\n${marker}`;
}

function estimateMessageChars(messages: AgentMessage[]): number {
  return messages.reduce((total, message) => {
    const toolCallChars = message.tool_calls
      ? JSON.stringify(message.tool_calls).length
      : 0;
    return total + message.content.length + toolCallChars + (message.reasoning_content?.length ?? 0);
  }, 0);
}

/**
 * 默认消息 id 生成器。
 */
export function defaultCreateId(): string {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}
