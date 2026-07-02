import type {
  AgentMessage,
  AgentSafetyOptions,
  AgentToolCall,
  AgentToolResult,
} from "./types";

type LoopStatus = "ok" | "warn" | "critical" | "break";
type BudgetStatus = "ok" | "nudge" | "stop";

const DEFAULT_WARNING_THRESHOLD = 10;
const DEFAULT_CRITICAL_THRESHOLD = 20;
const DEFAULT_BREAK_THRESHOLD = 30;
const DEFAULT_TOKEN_BUDGET = 30_000;
const DEFAULT_NUDGE_RATIO = 0.9;
const DEFAULT_LOW_INCREMENT_THRESHOLD = 500;
const DEFAULT_MIN_TOTAL_FOR_DIMINISHING_RETURNS = 5_000;
const DEFAULT_LOW_INCREMENT_STREAK_LIMIT = 2;
const DEFAULT_TRUNCATION_RECOVERY_ATTEMPTS = 3;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(",")}}`;
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const fingerprintToolCall = (toolCall: AgentToolCall) =>
  hashString(`${toolCall.function.name}:${stableStringify(parseArguments(toolCall.function.arguments))}`);

const parseArguments = (argumentsText: string) => {
  try {
    return JSON.parse(argumentsText);
  } catch {
    return argumentsText;
  }
};

const fingerprintResult = (result: AgentToolResult) =>
  hashString(stableStringify(result.success ? result.data || "" : result.error || ""));

const estimateTokens = (content: string) => Math.ceil(content.length / 4);

export class AgentSafetyGuard {
  private readonly options: AgentSafetyOptions;
  private readonly loopHistory = new Map<string, { count: number; lastResultFingerprint: string }>();
  private noProgressCount = 0;
  private totalOutputTokens = 0;
  private lowIncrementStreak = 0;
  private budgetNudgeInjected = false;
  private loopWarningInjected = false;
  private truncationRecoveryCount = 0;

  constructor(options: AgentSafetyOptions = {}) {
    this.options = options;
  }

  reset() {
    this.loopHistory.clear();
    this.noProgressCount = 0;
    this.totalOutputTokens = 0;
    this.lowIncrementStreak = 0;
    this.budgetNudgeInjected = false;
    this.loopWarningInjected = false;
    this.truncationRecoveryCount = 0;
  }

  checkToolResult(toolCall: AgentToolCall, result: AgentToolResult): { status: LoopStatus; message?: string } {
    if (this.options.loopDetection?.enabled === false) {
      return { status: "ok" };
    }

    const warningThreshold = this.options.loopDetection?.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
    const criticalThreshold = this.options.loopDetection?.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD;
    const breakThreshold = this.options.loopDetection?.breakThreshold ?? DEFAULT_BREAK_THRESHOLD;
    const callFingerprint = fingerprintToolCall(toolCall);
    const resultFingerprint = fingerprintResult(result);
    const entry = this.loopHistory.get(callFingerprint) || {
      count: 0,
      lastResultFingerprint: "",
    };

    if (entry.lastResultFingerprint === resultFingerprint) {
      entry.count += 1;
      this.noProgressCount += 1;
    } else {
      entry.count = 1;
      entry.lastResultFingerprint = resultFingerprint;
    }

    this.loopHistory.set(callFingerprint, entry);

    if (this.noProgressCount >= breakThreshold) {
      return {
        status: "break",
        message: `Agent stopped after ${this.noProgressCount} no-progress tool calls.`,
      };
    }

    if (entry.count >= criticalThreshold) {
      return {
        status: "critical",
        message: `${toolCall.function.name} repeated ${entry.count} times with the same result.`,
      };
    }

    if (entry.count >= warningThreshold && !this.loopWarningInjected) {
      this.loopWarningInjected = true;
      return {
        status: "warn",
        message: `${toolCall.function.name} is repeating with no visible progress.`,
      };
    }

    return { status: "ok" };
  }

  createLoopWarningMessage(message: string, createId: () => string): AgentMessage {
    return {
      id: createId(),
      role: "system",
      content: `[LOOP_WARNING] ${message} You are repeating the same tool call and getting the same result. Change strategy, use a broader tool, inspect a different signal, or explain why you are blocked.`,
      timestamp: new Date(),
    };
  }

  checkTokenBudget(outputTokens?: number, content = ""): { status: BudgetStatus; message?: string } {
    const maxOutputTokens = this.options.tokenBudget?.maxOutputTokens ?? DEFAULT_TOKEN_BUDGET;
    const nudgeRatio = this.options.tokenBudget?.nudgeRatio ?? DEFAULT_NUDGE_RATIO;
    const lowIncrementThreshold = this.options.tokenBudget?.lowIncrementThreshold ?? DEFAULT_LOW_INCREMENT_THRESHOLD;
    const minTotal = this.options.tokenBudget?.minTotalForDiminishingReturns ?? DEFAULT_MIN_TOTAL_FOR_DIMINISHING_RETURNS;
    const lowStreakLimit = this.options.tokenBudget?.lowIncrementStreakLimit ?? DEFAULT_LOW_INCREMENT_STREAK_LIMIT;
    const increment = outputTokens ?? estimateTokens(content);

    this.totalOutputTokens += increment;

    if (this.totalOutputTokens > minTotal) {
      if (increment < lowIncrementThreshold) {
        this.lowIncrementStreak += 1;
      } else {
        this.lowIncrementStreak = 0;
      }

      if (this.lowIncrementStreak >= lowStreakLimit) {
        return {
          status: "stop",
          message: `Agent stopped after ${this.lowIncrementStreak} low-yield turns under ${lowIncrementThreshold} output tokens.`,
        };
      }
    }

    if (!this.budgetNudgeInjected && this.totalOutputTokens >= maxOutputTokens * nudgeRatio) {
      this.budgetNudgeInjected = true;
      return {
        status: "nudge",
        message: `Output budget is ${Math.round((this.totalOutputTokens / maxOutputTokens) * 100)}% used (${this.totalOutputTokens}/${maxOutputTokens}).`,
      };
    }

    return { status: "ok" };
  }

  createBudgetNudgeMessage(message: string, createId: () => string): AgentMessage {
    return {
      id: createId(),
      role: "system",
      content: `[BUDGET_NUDGE] ${message} Continue the task with concise, high-value output. Do not summarize earlier work unless it is necessary to finish.`,
      timestamp: new Date(),
    };
  }

  createTruncationRecoveryMessage(createId: () => string): AgentMessage | null {
    const maxAttempts = this.options.truncationRecovery?.maxAttempts ?? DEFAULT_TRUNCATION_RECOVERY_ATTEMPTS;
    this.truncationRecoveryCount += 1;

    if (this.truncationRecoveryCount > maxAttempts) {
      return null;
    }

    const instruction = this.truncationRecoveryCount === 1
      ? "Continue directly from the cutoff point. Do not apologize, do not recap, and split the remaining work into smaller chunks."
      : "The output was truncated again. Be much more concise and provide only the key conclusions or the next required tool call.";

    return {
      id: createId(),
      role: "system",
      content: `[TRUNCATION_RECOVERY] ${instruction}`,
      timestamp: new Date(),
    };
  }
}
