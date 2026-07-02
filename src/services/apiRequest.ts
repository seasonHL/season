import { ChatRequest } from "../types";
import { classifyStatus, ModelApiError, parseRetryAfterMs } from "./apiErrors";

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

export const createHeaders = (apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
};

type CacheableTextBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

const supportsOpenAICompatibleCacheControl = (baseUrl: string, model: string) => {
  const target = `${baseUrl} ${model}`.toLowerCase();
  return target.includes("dashscope") || target.includes("qwen");
};

const withEphemeralCacheControl = (text: string): CacheableTextBlock[] => [
  {
    type: "text",
    text,
    cache_control: { type: "ephemeral" },
  },
];

const addPromptCacheBreakpoints = (request: ChatRequest, baseUrl: string): ChatRequest => {
  if (!supportsOpenAICompatibleCacheControl(baseUrl, request.model)) {
    return request;
  }

  const messages = request.messages.map((message) => ({ ...message }));
  const systemIndex = messages.findIndex((message) => message.role === "system");
  if (systemIndex >= 0 && typeof messages[systemIndex].content === "string") {
    messages[systemIndex].content = withEphemeralCacheControl(messages[systemIndex].content);
  }

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "user" || typeof message.content !== "string") continue;
    messages[index].content = withEphemeralCacheControl(message.content);
    break;
  }

  return { ...request, messages };
};

export const createRequestBody = (
  request: ChatRequest,
  stream: boolean,
  baseUrl = ""
): Record<string, any> => {
  const cacheAwareRequest = addPromptCacheBreakpoints(request, baseUrl);
  const requestBody: Record<string, any> = {
    model: cacheAwareRequest.model,
    messages: cacheAwareRequest.messages,
    stream
  };

  if (cacheAwareRequest.tools && cacheAwareRequest.tools.length > 0) {
    requestBody.tools = cacheAwareRequest.tools;
    requestBody.tool_choice = cacheAwareRequest.tool_choice || "auto";
  }

  return requestBody;
};

export const assertOkResponse = async (response: Response) => {
  if (response.ok) return;

  const errorText = await response.text();
  console.error(`API 响应错误 - 状态码: ${response.status}`);
  console.error(`API 响应内容: ${errorText}`);
  throw new ModelApiError(`HTTP ${response.status}: ${errorText}`, {
    status: response.status,
    kind: classifyStatus(response.status),
    retryAfterMs: parseRetryAfterMs(response.headers.get("Retry-After")),
  });
};
