import {
  createAssistantMessage,
  createToolMessage,
  defaultCreateId,
  toChatMessages,
} from "./messages";
import { AgentSafetyGuard } from "./safety";
import { ToolRegistry } from "./tools";
import type {
  AgentMessage,
  AgentOptions,
  AgentProvider,
  AgentProviderRequest,
  AgentToolCall,
  AgentToolDefinition,
  AgentToolResult,
  AgentRunWithToolsOptions,
  AgentStreamUpdate,
  AgentToolRunResult,
  AgentTurnResult,
} from "./types";

/**
 * 轻量级 Agent 循环。
 *
 * 负责维护消息历史、调用模型 Provider，并把模型返回的工具调用转换成应用层任务。
 * TTaskRequest 由上层应用定义，agent-core 不关心具体任务如何执行。
 */
export class Agent<TTaskRequest = unknown, TContext = unknown> {
  private history: AgentMessage[];
  private iterations = 0;
  private readonly model: string;
  private readonly provider: AgentProvider;
  private readonly systemPrompt: string;
  private readonly tools: AgentToolDefinition[];
  private readonly toolRegistry: ToolRegistry<TTaskRequest, TContext>;
  private readonly maxIterations: number;
  private readonly parseToolCall?: (toolCall: AgentToolCall) => TTaskRequest | null;
  private readonly createId: () => string;
  private readonly safetyGuard: AgentSafetyGuard;

  constructor(options: AgentOptions<TTaskRequest, TContext>) {
    this.model = options.model;
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt;
    this.toolRegistry = new ToolRegistry<TTaskRequest, TContext>(options.toolRuntimes || []);
    this.tools = options.tools || this.toolRegistry.definitions;
    this.history = [...(options.initialMessages || [])];
    this.maxIterations = options.maxIterations ?? 8;
    this.parseToolCall = options.parseToolCall;
    this.createId = options.createId || defaultCreateId;
    this.safetyGuard = new AgentSafetyGuard(options.safety);
  }

  get messages(): AgentMessage[] {
    return [...this.history];
  }

  /**
   * 返回只读历史引用，适合内部调试或只读展示。
   */
  getHistory(): readonly AgentMessage[] {
    return this.history;
  }

  setMessages(messages: AgentMessage[]) {
    this.history = [...messages];
    this.iterations = 0;
    this.safetyGuard.reset();
  }

  appendUserMessage(content: string): AgentMessage {
    const input = content.trim();
    if (!input) {
      throw new Error("User input cannot be empty");
    }

    const message: AgentMessage = {
      id: this.createId(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    this.history = [...this.history, message];
    return message;
  }

  /**
   * 将工具执行结果追加为 tool 消息。
   *
   * 工具结果需要先进入对话历史，模型才能基于结果继续生成回答。
   */
  appendToolResults(
    results: Array<{ toolCall: AgentToolCall; result: AgentToolResult }>
  ): AgentMessage[] {
    const toolMessages = results.map(({ toolCall, result }) =>
      this.createToolMessage(toolCall, result)
    );
    this.history = [...this.history, ...toolMessages];
    return toolMessages;
  }

  async run(userInput: string): Promise<AgentTurnResult<TTaskRequest>>;
  async run(): Promise<AgentTurnResult<TTaskRequest>>;
  async run(userInput?: string): Promise<AgentTurnResult<TTaskRequest>> {
    if (userInput !== undefined) {
      this.appendUserMessage(userInput);
    }
    return this.nextTurn();
  }

  async runStream(
    onUpdate: (update: AgentStreamUpdate) => void,
    userInput?: string
  ): Promise<AgentTurnResult<TTaskRequest>> {
    if (userInput !== undefined) {
      this.appendUserMessage(userInput);
    }
    return this.nextTurnStream(onUpdate);
  }

  async runWithToolsStream(
    options: AgentRunWithToolsOptions<TTaskRequest, TContext>
  ): Promise<AgentTurnResult<TTaskRequest>> {
    if (options.userInput !== undefined) {
      this.appendUserMessage(options.userInput);
    }

    let result: AgentTurnResult<TTaskRequest> = {
      toolCalls: [],
      messages: this.messages,
    };
    let pendingBudgetNudgeMessage: AgentMessage | undefined;

    while (this.iterations < this.maxIterations) {
      result = options.stream === false
        ? await this.nextTurn()
        : await this.nextTurnStream(options.onStreamUpdate || (() => {}));

      if (result.assistantMessage) {
        await options.onAssistantMessage?.(result.assistantMessage, this.messages);
      }

      if (this.isMaxTokensFinish(result.finishReason)) {
        const recoveryMessage = this.safetyGuard.createTruncationRecoveryMessage(this.createId);
        if (!recoveryMessage) {
          throw new Error("Agent stopped because model output was repeatedly truncated");
        }
        this.history = [...this.history, recoveryMessage];
        continue;
      }

      if (result.assistantMessage) {
        const budgetStatus = this.safetyGuard.checkTokenBudget(
          result.outputTokens,
          `${result.assistantMessage.content}${result.assistantMessage.reasoning_content || ""}`
        );

        if (budgetStatus.status === "stop") {
          throw new Error(budgetStatus.message || "Agent stopped because output budget had diminishing returns");
        }

        if (budgetStatus.status === "nudge" && budgetStatus.message) {
          pendingBudgetNudgeMessage = this.safetyGuard.createBudgetNudgeMessage(budgetStatus.message, this.createId);
        }
      }

      if (result.toolCalls.length === 0) {
        if (pendingBudgetNudgeMessage) {
          this.history = [...this.history, pendingBudgetNudgeMessage];
          pendingBudgetNudgeMessage = undefined;
        }
        return result;
      }

      const needsApproval = result.toolCalls.some((item) =>
        this.toolRegistry.requiresApproval(item, options.context)
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
          this.appendToolResults(rejectedResults);
          await options.onToolCallsFinished?.(rejectedResults, this.messages);
          continue;
        }
      }

      await options.onToolCallsStarted?.(result.toolCalls);
      const toolResults: AgentToolRunResult<TTaskRequest>[] = [];
      const postToolMessages: AgentMessage[] = [];
      let loopBreakMessage: string | undefined;

      for (let i = 0; i < result.toolCalls.length; i++) {
        const item = result.toolCalls[i];
        const toolResult = await this.toolRegistry.execute(item, options.context);
        const loopStatus = this.safetyGuard.checkToolResult(item.toolCall, toolResult);
        const finalToolResult = loopStatus.status === "critical"
          ? {
              success: false,
              error: `Tool loop blocked: ${loopStatus.message}`,
            }
          : toolResult;

        toolResults.push({ ...item, result: finalToolResult });
        await options.onToolCallFinished?.(item, finalToolResult, i);

        if (loopStatus.status === "warn" && loopStatus.message) {
          postToolMessages.push(this.safetyGuard.createLoopWarningMessage(loopStatus.message, this.createId));
        }

        if (loopStatus.status === "break") {
          loopBreakMessage = loopStatus.message || "Agent stopped because tools made no progress";
          break;
        }
      }

      this.appendToolResults(toolResults);
      if (pendingBudgetNudgeMessage) {
        postToolMessages.push(pendingBudgetNudgeMessage);
        pendingBudgetNudgeMessage = undefined;
      }
      if (postToolMessages.length > 0) {
        this.history = [...this.history, ...postToolMessages];
      }
      await options.onToolCallsFinished?.(toolResults, this.messages);

      if (loopBreakMessage) {
        throw new Error(loopBreakMessage);
      }
    }

    throw new Error(`Agent exceeded ${this.maxIterations} iterations`);
  }

  async continue(messages: AgentMessage[]): Promise<AgentTurnResult<TTaskRequest>> {
    this.setMessages(messages);
    return this.nextTurn();
  }

  async continueWithToolResults(
    messages: AgentMessage[],
    results: Array<{ toolCall: AgentToolCall; result: AgentToolResult }>
  ): Promise<AgentTurnResult<TTaskRequest>> {
    this.setMessages(messages);
    this.appendToolResults(results);
    return this.nextTurn();
  }

  createToolMessage(
    toolCall: AgentToolCall,
    result: AgentToolResult
  ): AgentMessage {
    return Agent.createToolMessage(toolCall, result, this.createId);
  }

  static createAssistantMessage(
    input: {
      content?: string;
      toolCalls?: AgentToolCall[];
      reasoningContent?: string;
    },
    createId: () => string = defaultCreateId
  ): AgentMessage {
    return createAssistantMessage(input, createId);
  }

  static createToolMessage(
    toolCall: AgentToolCall,
    result: AgentToolResult,
    createId: () => string = defaultCreateId
  ): AgentMessage {
    return createToolMessage(toolCall, result, createId);
  }

  private async nextTurn(): Promise<AgentTurnResult<TTaskRequest>> {
    if (this.iterations >= this.maxIterations) {
      throw new Error(`Agent exceeded ${this.maxIterations} iterations`);
    }
    this.iterations += 1;

    const response = await this.provider.complete({
      model: this.model,
      messages: toChatMessages(this.systemPrompt, this.history),
      tools: this.tools,
      stream: false,
    });

    /**
     * 工具调用的解析留给上层应用处理，Provider 只负责返回模型原始意图。
     */
    const toolCalls = this.resolveToolCalls(response.tool_calls || []);

    if (!response.content && toolCalls.length === 0) {
      return { toolCalls, messages: this.messages };
    }

    const assistantMessage = Agent.createAssistantMessage(
      {
        content: response.content,
        toolCalls: response.tool_calls,
        reasoningContent: response.reasoning_content,
      },
      this.createId
    );
    this.history = [...this.history, assistantMessage];

    return {
      assistantMessage,
      toolCalls,
      messages: this.messages,
      answer: toolCalls.length === 0 ? assistantMessage.content.trim() : undefined,
      finishReason: response.finish_reason,
      outputTokens: response.output_tokens,
    };
  }

  private async nextTurnStream(
    onUpdate: (update: AgentStreamUpdate) => void
  ): Promise<AgentTurnResult<TTaskRequest>> {
    if (!this.provider.stream) {
      return this.nextTurn();
    }

    if (this.iterations >= this.maxIterations) {
      throw new Error(`Agent exceeded ${this.maxIterations} iterations`);
    }
    this.iterations += 1;

    const request = this.createProviderRequest(true);
    const assistantMessage: AgentMessage = {
      id: this.createId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    this.history = [...this.history, assistantMessage];

    const response = await this.provider.stream(request, (chunk) => {
      if (chunk.content_delta) {
        assistantMessage.content += chunk.content_delta;
      }

      if (chunk.reasoning_content_delta) {
        assistantMessage.reasoning_content = `${assistantMessage.reasoning_content || ""}${chunk.reasoning_content_delta}`;
      }

      onUpdate({ message: { ...assistantMessage } });
    });

    const toolCalls = this.resolveToolCalls(response.tool_calls || []);

    assistantMessage.content = response.content || (toolCalls.length > 0 ? "正在执行工具..." : "");
    assistantMessage.tool_calls = response.tool_calls;
    assistantMessage.reasoning_content = response.reasoning_content;

    if (!assistantMessage.content && toolCalls.length === 0) {
      this.history = this.history.filter((message) => message.id !== assistantMessage.id);
      return { toolCalls, messages: this.messages };
    }

    onUpdate({ message: { ...assistantMessage } });

    return {
      assistantMessage,
      toolCalls,
      messages: this.messages,
      answer: toolCalls.length === 0 ? assistantMessage.content.trim() : undefined,
      finishReason: response.finish_reason,
      outputTokens: response.output_tokens,
    };
  }

  private createProviderRequest(stream: boolean): AgentProviderRequest {
    return {
      model: this.model,
      messages: toChatMessages(this.systemPrompt, this.history),
      tools: this.tools,
      stream,
    };
  }

  private resolveToolCalls(toolCalls: AgentToolCall[]) {
    return toolCalls.flatMap((toolCall) => {
      const taskRequest = this.parseToolCall?.(toolCall);
      if (taskRequest) return [{ toolCall, taskRequest }];

      const resolved = this.toolRegistry.resolve(toolCall);
      return resolved ? [resolved] : [];
    });
  }

  private isMaxTokensFinish(finishReason?: string) {
    return finishReason === "max_tokens" || finishReason === "length";
  }
}
