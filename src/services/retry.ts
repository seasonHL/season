import { MAX_529_RETRIES, ModelApiError, normalizeError } from "./apiErrors";

const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getRetryDelayMs = (attempt: number, retryAfterMs?: number) => {
  if (retryAfterMs !== undefined) {
    return retryAfterMs;
  }

  const exponentialDelay = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MAX_RETRY_DELAY_MS
  );
  return exponentialDelay + Math.floor(Math.random() * BASE_RETRY_DELAY_MS);
};

const shouldRetry = (error: ModelApiError, attempt: number, maxRetries: number, overloadedCount: number) => {
  if (error.kind !== "retryable") return false;
  if (attempt >= maxRetries) return false;
  if (error.status === 529 && overloadedCount >= MAX_529_RETRIES) return false;
  return true;
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; initialOverloadedCount?: number; onRetryableError?: (error: ModelApiError) => void } = {}
): Promise<T> => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  let overloadedCount = options.initialOverloadedCount ?? 0;

  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    }
    catch (error) {
      const normalizedError = normalizeError(error);
      if (normalizedError.status === 529) {
        overloadedCount += 1;
      }
      options.onRetryableError?.(normalizedError);

      if (!shouldRetry(normalizedError, attempt, maxRetries, overloadedCount)) {
        throw normalizedError;
      }

      await sleep(getRetryDelayMs(attempt + 1, normalizedError.retryAfterMs));
    }
  }
};
