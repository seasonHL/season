import {
  createAssistantMessage,
  createToolMessage,
  defaultCreateId,
  toChatMessages,
} from "./messages";
import type {
  AgentMessage,
  AgentOptions,
  AgentProvider,
  AgentToolCall,
  AgentToolDefinition,
  AgentToolResult,
  AgentTurnResult,
} from "./types";

/**
 * 轻量级 Agent 循环。
 *
 * 负责维护消息历史、调用模型 Provider，并把模型返回的工具调用转换成应用层任务。
 * TTaskRequest 由上层应用定义，agent-core 不关心具体任务如何执行。
 */
export class Agent<TTaskRequest = unknown> {
  private history: AgentMessage[];
  private iterations = 0;
  private readonly model: string;
  private readonly provider: AgentProvider;
  private readonly systemPrompt: string;
  private readonly tools: AgentToolDefinition[];
  private readonly maxIterations: number;
  private readonly parseToolCall?: (toolCall: AgentToolCall) => TTaskRequest | null;
  private readonly createId: () => string;

  constructor(options: AgentOptions<TTaskRequest>) {
    this.model = options.model;
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt;
    this.tools = options.tools || [];
    this.history = [...(options.initialMessages || [])];
    this.maxIterations = options.maxIterations ?? 8;
    this.parseToolCall = options.parseToolCall;
    this.createId = options.createId || defaultCreateId;
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
    const toolCalls = (response.tool_calls || []).flatMap((toolCall) => {
      const taskRequest = this.parseToolCall?.(toolCall);
      return taskRequest ? [{ toolCall, taskRequest }] : [];
    });

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
    };
  }
}
