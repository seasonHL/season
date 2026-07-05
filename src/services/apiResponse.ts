import { ChatResponse, ToolCall } from "../types";

export const parseToolCalls = (message: any): ToolCall[] | undefined => {
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) return undefined;

  return message.tool_calls.map((tc: any) => ({
    id: tc.id,
    type: "function",
    function: {
      name: tc.function.name,
      arguments: typeof tc.function.arguments === "string"
        ? tc.function.arguments
        : JSON.stringify(tc.function.arguments)
    }
  }));
};

export const parseChatResponse = (data: any): ChatResponse => {
  let content = "";
  let toolCalls: ToolCall[] | undefined;
  let reasoningContent: string | undefined;
  let finishReason: string | undefined;
  let outputTokens: number | undefined;

  if (typeof data === "string") {
    content = data;
  }
  else if (data.content && Array.isArray(data.content)) {
    const textContent = data.content.find((c: any) => c.type === "text");
    content = textContent?.text || "";

    const toolUse = data.content.filter((c: any) => c.type === "tool_use");
    if (toolUse.length > 0) {
      toolCalls = toolUse.map((t: any) => ({
        id: t.id,
        type: "function",
        function: {
          name: t.name,
          arguments: typeof t.input === "string" ? t.input : JSON.stringify(t.input)
        }
      }));
    }
    finishReason = data.stop_reason || undefined;
    outputTokens = data.usage?.output_tokens || undefined;
  }
  else if (data.choices && data.choices[0]?.message) {
    const message = data.choices[0].message;
    content = message.content || "";
    reasoningContent = message.reasoning_content || undefined;
    toolCalls = parseToolCalls(message);
    finishReason = data.choices[0].finish_reason || undefined;
    outputTokens = data.usage?.completion_tokens || undefined;
  }
  else {
    throw new Error("Invalid response format");
  }

  return {
    content,
    tool_calls: toolCalls,
    reasoning_content: reasoningContent,
    finish_reason: finishReason,
    output_tokens: outputTokens,
  };
};

export const mergeToolCallDelta = (toolCalls: ToolCall[], deltaToolCall: any) => {
  const index = deltaToolCall.index ?? toolCalls.length;
  const current = toolCalls[index] || {
    id: deltaToolCall.id || "",
    type: "function" as const,
    function: {
      name: "",
      arguments: ""
    }
  };

  toolCalls[index] = {
    id: deltaToolCall.id || current.id,
    type: "function",
    function: {
      name: deltaToolCall.function?.name || current.function.name,
      arguments: `${current.function.arguments}${deltaToolCall.function?.arguments || ""}`
    }
  };
};
