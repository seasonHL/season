import { AgentSafetyGuard } from "./safety";
import { ToolRegistry } from "./tools";
import type {
  AgentMessage,
  AgentRunWithToolsOptions,
  AgentToolCall,
  AgentToolResult,
  AgentToolRunResult,
  AgentTurnResult,
} from "./types";

export interface AgentLoopRuntime<TTaskRequest, TContext> {
  getIterations(): number;
  getMaxIterations(): number;
  getMessages(): AgentMessage[];
  appendUserMessage(content: string): AgentMessage;
  appendToolResults(results: Array<{ toolCall: AgentToolCall; result: AgentToolResult }>): AgentMessage[];
  appendMessages(messages: AgentMessage[]): void;
  nextTurn(stream: boolean, onStreamUpdate: AgentRunWithToolsOptions<TTaskRequest, TContext>["onStreamUpdate"]): Promise<AgentTurnResult<TTaskRequest>>;
  createId(): string;
  toolRegistry: ToolRegistry<TTaskRequest, TContext>;
  safetyGuard: AgentSafetyGuard;
}

export async function runAgentLoop<TTaskRequest, TContext>(
  runtime: AgentLoopRuntime<TTaskRequest, TContext>,
  options: AgentRunWithToolsOptions<TTaskRequest, TContext>
): Promise<AgentTurnResult<TTaskRequest>> {
  if (options.userInput !== undefined) {
    runtime.appendUserMessage(options.userInput);
  }

  let result: AgentTurnResult<TTaskRequest> = {
    toolCalls: [],
    messages: runtime.getMessages(),
  };
  let pendingBudgetNudgeMessage: AgentMessage | undefined;

  while (runtime.getIterations() < runtime.getMaxIterations()) {
    result = await runtime.nextTurn(options.stream !== false, options.onStreamUpdate);

    if (result.assistantMessage) {
      await options.onAssistantMessage?.(result.assistantMessage, runtime.getMessages());
    }

    if (isMaxTokensFinish(result.finishReason)) {
      const recoveryMessage = runtime.safetyGuard.createTruncationRecoveryMessage(runtime.createId);
      if (!recoveryMessage) {
        throw new Error("Agent stopped because model output was repeatedly truncated");
      }
      runtime.appendMessages([recoveryMessage]);
      continue;
    }

    if (result.assistantMessage) {
      const budgetStatus = runtime.safetyGuard.checkTokenBudget(
        result.outputTokens,
        `${result.assistantMessage.content}${result.assistantMessage.reasoning_content || ""}`
      );

      if (budgetStatus.status === "stop") {
        throw new Error(budgetStatus.message || "Agent stopped because output budget had diminishing returns");
      }

      if (budgetStatus.status === "nudge" && budgetStatus.message) {
        pendingBudgetNudgeMessage = runtime.safetyGuard.createBudgetNudgeMessage(
          budgetStatus.message,
          runtime.createId
        );
      }
    }

    if (result.toolCalls.length === 0) {
      if (pendingBudgetNudgeMessage) {
        runtime.appendMessages([pendingBudgetNudgeMessage]);
      }
      return result;
    }

    const needsApproval = result.toolCalls.some((item) =>
      runtime.toolRegistry.requiresApproval(item, options.context)
    );
    if (needsApproval) {
      const approved = await options.requestApproval?.(result.toolCalls);
      if (!approved) {
        const rejectedResults = result.toolCalls.map((item) => ({
          ...item,
          result: {
            success: false,
            error: "用户拒绝执行该操作",
          },
        }));
        runtime.appendToolResults(rejectedResults);
        await options.onToolCallsFinished?.(rejectedResults, runtime.getMessages());
        continue;
      }
    }

    await options.onToolCallsStarted?.(result.toolCalls);
    const toolResults: AgentToolRunResult<TTaskRequest>[] = [];
    const postToolMessages: AgentMessage[] = [];
    let loopBreakMessage: string | undefined;

    for (let i = 0; i < result.toolCalls.length; i++) {
      const item = result.toolCalls[i];
      const toolResult = await runtime.toolRegistry.execute(item, options.context);
      const loopStatus = runtime.safetyGuard.checkToolResult(item.toolCall, toolResult);
      const finalToolResult = loopStatus.status === "critical"
        ? {
            success: false,
            error: `Tool loop blocked: ${loopStatus.message}`,
          }
        : toolResult;

      toolResults.push({ ...item, result: finalToolResult });
      await options.onToolCallFinished?.(item, finalToolResult, i);

      if (loopStatus.status === "warn" && loopStatus.message) {
        postToolMessages.push(runtime.safetyGuard.createLoopWarningMessage(loopStatus.message, runtime.createId));
      }

      if (loopStatus.status === "break") {
        loopBreakMessage = loopStatus.message || "Agent stopped because tools made no progress";
        break;
      }
    }

    runtime.appendToolResults(toolResults);
    if (pendingBudgetNudgeMessage) {
      postToolMessages.push(pendingBudgetNudgeMessage);
      pendingBudgetNudgeMessage = undefined;
    }
    if (postToolMessages.length > 0) {
      runtime.appendMessages(postToolMessages);
    }
    await options.onToolCallsFinished?.(toolResults, runtime.getMessages());

    if (loopBreakMessage) {
      throw new Error(loopBreakMessage);
    }
  }

  throw new Error(`Agent exceeded ${runtime.getMaxIterations()} iterations`);
}

const isMaxTokensFinish = (finishReason?: string) =>
  finishReason === "max_tokens" || finishReason === "length";
