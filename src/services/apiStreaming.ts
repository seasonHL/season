import { ChatResponse, ToolCall } from "../types";
import { ModelApiError } from "./apiErrors";
import { mergeToolCallDelta } from "./apiResponse";

export type ChatStreamChunk = {
  content_delta?: string;
  reasoning_content_delta?: string;
};

const STREAM_STALL_TIMEOUT_MS = 30_000;
const STREAM_WATCHDOG_INTERVAL_MS = 5_000;

export const readChatStream = async (
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: ChatStreamChunk) => void
): Promise<ChatResponse> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoningContent = "";
  let finishReason: string | undefined;
  let outputTokens: number | undefined;
  let lastDataAt = Date.now();
  let streamTimedOut = false;
  const toolCalls: ToolCall[] = [];

  const watchdog = window.setInterval(() => {
    if (Date.now() - lastDataAt > STREAM_STALL_TIMEOUT_MS) {
      streamTimedOut = true;
      void reader.cancel("stream stalled");
    }
  }, STREAM_WATCHDOG_INTERVAL_MS);

  const handleEvent = (eventText: string) => {
    const dataLines = eventText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    for (const dataLine of dataLines) {
      if (!dataLine || dataLine === "[DONE]") continue;

      let payload: any;
      try {
        payload = JSON.parse(dataLine);
      }
      catch {
        throw new ModelApiError("Invalid streaming response format", {
          kind: "retryable",
        });
      }

      const delta = payload.choices?.[0]?.delta;
      finishReason = payload.choices?.[0]?.finish_reason || finishReason;
      outputTokens = payload.usage?.completion_tokens || outputTokens;
      if (!delta) continue;

      const contentDelta = delta.content || "";
      const reasoningDelta = delta.reasoning_content || "";

      if (contentDelta) {
        content += contentDelta;
      }

      if (reasoningDelta) {
        reasoningContent += reasoningDelta;
      }

      if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
        delta.tool_calls.forEach((toolCall: any) => mergeToolCallDelta(toolCalls, toolCall));
      }

      if (contentDelta || reasoningDelta) {
        onChunk({
          content_delta: contentDelta || undefined,
          reasoning_content_delta: reasoningDelta || undefined
        });
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      lastDataAt = Date.now();
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      events.forEach(handleEvent);
    }
  }
  finally {
    window.clearInterval(watchdog);
  }

  if (streamTimedOut) {
    throw new ModelApiError("Streaming response stalled for 30 seconds", {
      kind: "retryable",
    });
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleEvent(buffer);
  }

  const completedToolCalls = toolCalls.filter((toolCall) => toolCall.id || toolCall.function.name);

  return {
    content,
    tool_calls: completedToolCalls.length > 0 ? completedToolCalls : undefined,
    reasoning_content: reasoningContent || undefined,
    finish_reason: finishReason,
    output_tokens: outputTokens,
  };
};
