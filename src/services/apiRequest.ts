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

export const createRequestBody = (request: ChatRequest, stream: boolean): Record<string, any> => {
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
