import { ChatRequest, ChatResponse } from "../types";
import { ModelApiError, normalizeError } from "./apiErrors";
import { assertOkResponse, buildApiUrl, createHeaders, createRequestBody } from "./apiRequest";
import { parseChatResponse } from "./apiResponse";
import { ChatStreamChunk, readChatStream } from "./apiStreaming";
import { withRetry } from "./retry";

export { buildApiUrl } from "./apiRequest";
export { isRetryableModelErrorMessage } from "./apiErrors";

export const sendChatMessage = async (
  baseUrl: string,
  apiKey: string,
  request: ChatRequest,
  useApiKeyHeader = false
): Promise<ChatResponse> => {
  try {
    if (!baseUrl) {
      return {
        content: "",
        error: "请先在设置页面配置 API 地址"
      };
    }

    return await withRetry(() => sendSingleChatRequest(baseUrl, apiKey, request, useApiKeyHeader));
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: "",
      error: errorMessage
    };
  }
};

export const sendChatMessageStream = async (
  baseUrl: string,
  apiKey: string,
  request: ChatRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  useApiKeyHeader = false
): Promise<ChatResponse> => {
  try {
    if (!baseUrl) {
      return {
        content: "",
        error: "请先在设置页面配置 API 地址"
      };
    }

    let overloadedCount = 0;
    let streamResponse: ChatResponse | undefined;

    try {
      streamResponse = await withRetry(
        () => sendSingleStreamingRequest(baseUrl, apiKey, request, onChunk, useApiKeyHeader),
        {
          onRetryableError: (error) => {
            if (error.status === 529) {
              overloadedCount += 1;
            }
          },
        }
      );
    }
    catch (error) {
      const normalizedError = normalizeError(error);
      if (normalizedError.kind !== "retryable") {
        throw normalizedError;
      }
    }

    if (streamResponse) {
      return streamResponse;
    }

    return await withRetry(
      () => sendSingleChatRequest(baseUrl, apiKey, { ...request, stream: false }, useApiKeyHeader),
      { maxRetries: 2, initialOverloadedCount: overloadedCount }
    );
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: "",
      error: errorMessage
    };
  }
};

const sendSingleChatRequest = async (
  baseUrl: string,
  apiKey: string,
  request: ChatRequest,
  useApiKeyHeader: boolean
): Promise<ChatResponse> => {
  const response = await fetch(buildApiUrl(baseUrl), {
    method: "POST",
    headers: createHeaders(apiKey, useApiKeyHeader),
    body: JSON.stringify(createRequestBody(request, request.stream ?? false, baseUrl))
  });

  await assertOkResponse(response);
  return parseChatResponse(await response.json());
};

const sendSingleStreamingRequest = async (
  baseUrl: string,
  apiKey: string,
  request: ChatRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  useApiKeyHeader: boolean
): Promise<ChatResponse> => {
  const response = await fetch(buildApiUrl(baseUrl), {
    method: "POST",
    headers: createHeaders(apiKey, useApiKeyHeader),
    body: JSON.stringify(createRequestBody(request, true, baseUrl))
  });

  await assertOkResponse(response);

  if (!response.body) {
    throw new ModelApiError("Streaming response body is empty", {
      kind: "retryable",
    });
  }

  return readChatStream(response.body, onChunk);
};
