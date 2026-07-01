import { ChatRequest, ChatResponse, ToolCall } from "../types";

type ChatStreamChunk = {
  content_delta?: string;
  reasoning_content_delta?: string;
};

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

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: createHeaders(apiKey),
      body: JSON.stringify(createRequestBody(request, request.stream ?? false))
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API 响应错误 - 状态码: ${response.status}`);
      console.error(`API 响应内容: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return parseChatResponse(await response.json());
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: "",
      error: errorMessage
    };
  }
};

const createHeaders = (apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
};

const createRequestBody = (request: ChatRequest, stream: boolean): Record<string, any> => {
  const requestBody: Record<string, any> = {
    model: request.model,
    messages: request.messages,
    stream
  };

  if (request.tools && request.tools.length > 0) {
    requestBody.tools = request.tools;
    requestBody.tool_choice = request.tool_choice || "auto";
  }

  return requestBody;
};

const parseToolCalls = (message: any): ToolCall[] | undefined => {
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

const parseChatResponse = (data: any): ChatResponse => {
  let content = "";
  let toolCalls: ToolCall[] | undefined;
  let reasoningContent: string | undefined;

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
  }
  else if (data.choices && data.choices[0]?.message) {
    const message = data.choices[0].message;
    content = message.content || "";
    reasoningContent = message.reasoning_content || undefined;
    toolCalls = parseToolCalls(message);
  }
  else {
    throw new Error("Invalid response format");
  }

  return { content, tool_calls: toolCalls, reasoning_content: reasoningContent };
};

const mergeToolCallDelta = (toolCalls: ToolCall[], deltaToolCall: any) => {
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

export const sendChatMessageStream = async (
  baseUrl: string,
  apiKey: string,
  request: ChatRequest,
  onChunk: (chunk: ChatStreamChunk) => void
): Promise<ChatResponse> => {
  try {
    if (!baseUrl) {
      return {
        content: "",
        error: "请先在设置页面配置 API 地址"
      };
    }

    const response = await fetch(buildApiUrl(baseUrl), {
      method: "POST",
      headers: createHeaders(apiKey),
      body: JSON.stringify(createRequestBody(request, true))
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API 响应错误 - 状态码: ${response.status}`);
      console.error(`API 响应内容: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Streaming response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let reasoningContent = "";
    const toolCalls: ToolCall[] = [];

    const handleEvent = (eventText: string) => {
      const dataLines = eventText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === "[DONE]") continue;

        const payload = JSON.parse(dataLine);
        const delta = payload.choices?.[0]?.delta;
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

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      events.forEach(handleEvent);
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      handleEvent(buffer);
    }

    const completedToolCalls = toolCalls.filter((toolCall) => toolCall.id || toolCall.function.name);

    return {
      content,
      tool_calls: completedToolCalls.length > 0 ? completedToolCalls : undefined,
      reasoning_content: reasoningContent || undefined
    };
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: "",
      error: errorMessage
    };
  }
};
