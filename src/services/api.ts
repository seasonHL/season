import { ChatRequest, ChatResponse, ToolCall } from "../types";

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
    let reasoningContent: string | undefined;

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
      reasoningContent = message.reasoning_content || undefined;
      
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

    return { content, tool_calls: toolCalls, reasoning_content: reasoningContent };
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: "",
      error: errorMessage
    };
  }
};
