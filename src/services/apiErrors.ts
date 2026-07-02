export type FailureKind = "retryable" | "non_retryable";

export class ModelApiError extends Error {
  readonly status?: number;
  readonly kind: FailureKind;
  readonly retryAfterMs?: number;

  constructor(message: string, options: { status?: number; kind: FailureKind; retryAfterMs?: number }) {
    super(message);
    this.name = "ModelApiError";
    this.status = options.status;
    this.kind = options.kind;
    this.retryAfterMs = options.retryAfterMs;
  }
}

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 402, 403, 404, 422]);
const RETRYABLE_NETWORK_PATTERNS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "ECONNRESET",
  "ETIMEDOUT",
  "timeout",
  "aborted",
];

export const MAX_529_RETRIES = 3;

export const parseRetryAfterMs = (value: string | null): number | undefined => {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return undefined;
};

export const classifyStatus = (status: number): FailureKind => {
  if (NON_RETRYABLE_STATUS_CODES.has(status)) return "non_retryable";
  if (RETRYABLE_STATUS_CODES.has(status)) return "retryable";
  return status >= 500 ? "retryable" : "non_retryable";
};

export const normalizeError = (error: unknown): ModelApiError => {
  if (error instanceof ModelApiError) return error;

  const message = error instanceof Error ? error.message : "Unknown error occurred";
  const isRetryableNetworkError = RETRYABLE_NETWORK_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );

  return new ModelApiError(message, {
    kind: isRetryableNetworkError ? "retryable" : "non_retryable",
  });
};

export const isRetryableModelErrorMessage = (message: string) => {
  const statusMatch = message.match(/HTTP\s+(\d{3})/);
  if (statusMatch) {
    return classifyStatus(Number(statusMatch[1])) === "retryable";
  }

  return RETRYABLE_NETWORK_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
};
